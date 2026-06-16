'use server';

import getPrisma from '@/lib/prisma';
import { PrismaClient } from '@/generated/client';

// Update type definition if not global, but for now we'll imply it from usage
export async function getInvoices() {
    const prisma: PrismaClient = getPrisma();

    // Fetch latest 50 for now (pagination can be added later)
    const invoices = await prisma.invoice.findMany({
        take: 50,
        orderBy: { date: 'desc' },
        include: {
            user: {
                select: { id: true, name: true, username: true, phone: true, address: true }
            },
            items: {
                include: {
                    product: true
                }
            },
            refunds: {
                include: { items: true }
            }
        }
    });

    return invoices.map(inv => {
        const refundedQtyMap = new Map<string, number>();
        inv.refunds?.forEach(ref => {
            ref.items.forEach(ri => {
                const current = refundedQtyMap.get(ri.productId) || 0;
                refundedQtyMap.set(ri.productId, current + Number(ri.quantity));
            });
        });

        return {
            ...inv,
            totalAmount: Number(inv.totalAmount),
            previousBalance: Number(inv.previousBalance || 0),
            amountPaid: Number(inv.amountPaid || 0),
            currentBalance: Number(inv.currentBalance || 0),
            items: inv.items.map(item => ({
                ...item,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                subtotal: Number(item.subtotal),
                refundableQuantity: Math.max(0, Number(item.quantity) - (refundedQtyMap.get(item.productId) || 0))
            }))
        };
    });
}

export async function getInvoiceById(id: string) {
    const prisma: PrismaClient = getPrisma();
    const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
            user: {
                select: { id: true, name: true, username: true, phone: true, address: true } // Employee/User details
            },
            customer: true,
            items: {
                include: {
                    product: {
                        include: {
                            category: true
                        }
                    }
                }
            },
            refunds: {
                include: { items: true }
            }
        }
    });

    if (!invoice) return null;

    const refundedQtyMap = new Map<string, number>();
    invoice.refunds?.forEach(ref => {
        ref.items.forEach(ri => {
            const current = refundedQtyMap.get(ri.productId) || 0;
            refundedQtyMap.set(ri.productId, current + Number(ri.quantity));
        });
    });

    return {
        ...invoice,
        totalAmount: Number(invoice.totalAmount),
        previousBalance: Number(invoice.previousBalance || 0),
        amountPaid: Number(invoice.amountPaid || 0),
        currentBalance: Number(invoice.currentBalance || 0),
        items: invoice.items.map(item => ({
            ...item,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.subtotal),
            refundableQuantity: Math.max(0, Number(item.quantity) - (refundedQtyMap.get(item.productId) || 0)),
            // Ensure product fields are accessible
            productCode: item.product.sku,
            productName: item.product.name,
            productUnit: item.product.unit,
            categoryName: item.product.category?.name
        }))
    };
}

export async function updateInvoice(
    invoiceId: string,
    data: {
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
        paymentMethod?: 'CASH' | 'CREDIT' | 'INSTAPAY';
        amountPaid?: number;
        previousBalance?: number;
        date?: string | Date;
        items?: Array<{
            id: string;
            productId: string;
            quantity: number;
            unitPrice: number;
        }>;
    }
) {
    if (!invoiceId) return { success: false, error: 'Invoice ID is required.' };

    const prisma: PrismaClient = getPrisma();

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Get existing invoice with items
            const existing = await tx.invoice.findUnique({
                where: { id: invoiceId },
                include: { items: true, customer: true }
            });

            if (!existing) throw new Error('Invoice not found.');

            // 2. Handle item changes + inventory
            let newTotalAmount = Number(existing.totalAmount);

            if (data.items !== undefined) {
                newTotalAmount = 0;
                const incomingItems = data.items;
                const loc = await tx.location.findFirst();
                const incomingExistingIds = incomingItems.filter(i => !i.id.startsWith('new-')).map(i => i.id);

                // --- REMOVED items: delete + restore stock ---
                const removedItems = existing.items.filter(ei => !incomingExistingIds.includes(ei.id));
                for (const removed of removedItems) {
                    if (loc) {
                        const inv = await tx.inventory.findFirst({ where: { productId: removed.productId, locationId: loc.id } });
                        if (inv) await tx.inventory.update({ where: { id: inv.id }, data: { quantity: Number(inv.quantity) + Number(removed.quantity) } });
                    }
                    await tx.invoiceItem.delete({ where: { id: removed.id } });
                }

                // --- EXISTING items: update qty/price + adjust stock ---
                for (const updatedItem of incomingItems.filter(i => !i.id.startsWith('new-'))) {
                    const existingItem = existing.items.find(i => i.id === updatedItem.id);
                    if (!existingItem) continue;

                    const qtyDelta = Number(existingItem.quantity) - updatedItem.quantity;
                    if (qtyDelta !== 0 && loc) {
                        const inventory = await tx.inventory.findFirst({ where: { productId: updatedItem.productId, locationId: loc.id } });
                        if (inventory) {
                            const newStock = Number(inventory.quantity) + qtyDelta;
                            if (newStock < 0) {
                                const product = await tx.product.findUnique({ where: { id: updatedItem.productId } });
                                throw new Error(`Insufficient stock for ${product?.name || updatedItem.productId}. Available: ${Number(inventory.quantity)}`);
                            }
                            await tx.inventory.update({ where: { id: inventory.id }, data: { quantity: newStock } });
                        }
                    }

                    const newSubtotal = updatedItem.quantity * updatedItem.unitPrice;
                    await tx.invoiceItem.update({
                        where: { id: updatedItem.id },
                        data: { quantity: updatedItem.quantity, unitPrice: updatedItem.unitPrice, subtotal: newSubtotal }
                    });
                    newTotalAmount += newSubtotal;
                }

                // --- NEW items: create + deduct stock ---
                for (const newItem of incomingItems.filter(i => i.id.startsWith('new-'))) {
                    if (loc) {
                        const inventory = await tx.inventory.findFirst({ where: { productId: newItem.productId, locationId: loc.id } });
                        if (inventory) {
                            const newStock = Number(inventory.quantity) - newItem.quantity;
                            if (newStock < 0) {
                                const product = await tx.product.findUnique({ where: { id: newItem.productId } });
                                throw new Error(`Insufficient stock for ${product?.name || newItem.productId}. Available: ${Number(inventory.quantity)}`);
                            }
                            await tx.inventory.update({ where: { id: inventory.id }, data: { quantity: newStock } });
                        }
                    }
                    const subtotal = newItem.quantity * newItem.unitPrice;
                    await tx.invoiceItem.create({
                        data: { invoiceId, productId: newItem.productId, quantity: newItem.quantity, unitPrice: newItem.unitPrice, subtotal }
                    });
                    newTotalAmount += subtotal;
                }
            }

            // 3. Calculate balance
            const amountPaid = data.amountPaid ?? Number(existing.amountPaid);
            const previousBalance = data.previousBalance ?? Number(existing.previousBalance);
            const currentBalance = previousBalance + newTotalAmount - amountPaid;

            // 4. Update the invoice itself
            const updatedInvoice = await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    totalAmount: newTotalAmount,
                    amountPaid,
                    previousBalance,
                    currentBalance,
                    ...(data.date && { date: new Date(data.date) }),
                    ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
                    ...(data.customerName !== undefined && { customerName: data.customerName || null }),
                    ...(data.customerPhone !== undefined && { customerPhone: data.customerPhone || null }),
                    ...(data.customerAddress !== undefined && { customerAddress: data.customerAddress || null }),
                },
                include: { items: true }
            });

            // 5. Update customer balance if linked
            if (existing.customerId) {
                // Customer balance = latest invoice's currentBalance (running total)
                const latestInvoice = await tx.invoice.findFirst({
                    where: { customerId: existing.customerId },
                    orderBy: { date: 'desc' },
                    select: { currentBalance: true }
                });

                if (latestInvoice) {
                    await tx.customer.update({
                        where: { id: existing.customerId },
                        data: { balance: Number(latestInvoice.currentBalance) }
                    });
                }
            }

            return updatedInvoice;
        }, { timeout: 15000 });

        // Revalidate all dependent paths
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/dashboard');
        revalidatePath('/invoices');
        revalidatePath('/analytics');
        revalidatePath('/profits');
        revalidatePath('/customers');
        revalidatePath('/sales');

        return {
            success: true,
            invoice: {
                ...result,
                totalAmount: Number(result.totalAmount),
                items: result.items.map(it => ({
                    ...it,
                    quantity: Number(it.quantity),
                    unitPrice: Number(it.unitPrice),
                    subtotal: Number(it.subtotal)
                }))
            }
        };
    } catch (error: any) {
        console.error('Failed to update invoice:', error);
        return { success: false, error: error.message || 'Failed to update invoice.' };
    }
}

export async function undoInvoice(invoiceId: string, userId?: string) {
    if (!invoiceId) return { success: false, error: 'Invoice ID is required.' };

    const prisma: PrismaClient = getPrisma();

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Get existing invoice with items and customer
            const existing = await tx.invoice.findUnique({
                where: { id: invoiceId },
                include: { items: true, refunds: true }
            });

            if (!existing) throw new Error('Invoice not found.');

            if (existing.refunds && existing.refunds.length > 0) {
                throw new Error('Cannot undo an invoice that has associated refunds. Please delete or revert the refunds first.');
            }

            const loc = await tx.location.findFirst();

            // 2. Restore inventory
            if (loc) {
                for (const item of existing.items) {
                    const inventory = await tx.inventory.findFirst({
                        where: { productId: item.productId, locationId: loc.id }
                    });
                    if (inventory) {
                        await tx.inventory.update({
                            where: { id: inventory.id },
                            data: { quantity: Number(inventory.quantity) + Number(item.quantity) }
                        });
                    }
                }
            }

            // 3. Revert Customer Balance
            if (existing.customerId) {
                const customer = await tx.customer.findUnique({ where: { id: existing.customerId } });
                if (customer) {
                    // Reverse the effect of this invoice on the customer's balance
                    // invoice added (totalAmount - amountPaid) to the balance
                    const netAddition = Number(existing.totalAmount) - Number(existing.amountPaid || 0);
                    const newBalance = Number(customer.balance) - netAddition;
                    await tx.customer.update({
                        where: { id: existing.customerId },
                        data: { balance: newBalance }
                    });
                }
            }

            // 4. Create opposite Transaction for Inventory tracking
            if (loc) {
                 await tx.transaction.create({
                    data: {
                        type: 'RETURN', // Since there's no UNDO, RETURN or REFUND_RESTOCK
                        toLocationId: loc.id, // items coming back into location
                        createdById: userId || existing.userId,
                        notes: `Undo Invoice #${existing.id}`,
                        items: {
                            create: existing.items.map(item => ({
                                productId: item.productId,
                                quantity: item.quantity
                            }))
                        }
                    }
                });
            }

            // 5. Delete Invoice Items
            await tx.invoiceItem.deleteMany({
                where: { invoiceId }
            });

            // 6. Delete Invoice
            await tx.invoice.delete({
                where: { id: invoiceId }
            });
        }, { timeout: 15000 });

        // 7. Audit Log
        try {
            const { logActivity } = await import('./audit');
            await logActivity(
                'DELETE',
                `Undid invoice #${invoiceId}`,
                userId
            );
        } catch (e) {
            console.error('Failed to log activity:', e);
        }

        const { revalidatePath } = await import('next/cache');
        revalidatePath('/dashboard');
        revalidatePath('/invoices');
        revalidatePath('/analytics');
        revalidatePath('/profits');
        revalidatePath('/customers');
        revalidatePath('/sales');
        revalidatePath('/inventory');
        revalidatePath('/inventory/transactions');
        revalidatePath('/logs');

        return { success: true };
    } catch (error: any) {
        console.error('Failed to undo invoice:', error);
        return { success: false, error: error.message || 'Failed to undo invoice.' };
    }
}
