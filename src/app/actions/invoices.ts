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
                refundedQtyMap.set(ri.productId, current + ri.quantity);
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
                unitPrice: Number(item.unitPrice),
                subtotal: Number(item.subtotal),
                refundableQuantity: Math.max(0, item.quantity - (refundedQtyMap.get(item.productId) || 0))
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
            refundedQtyMap.set(ri.productId, current + ri.quantity);
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
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.subtotal),
            refundableQuantity: Math.max(0, item.quantity - (refundedQtyMap.get(item.productId) || 0)),
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

            // 2. Handle item quantity/price changes + inventory deltas
            let newTotalAmount = Number(existing.totalAmount);

            if (data.items && data.items.length > 0) {
                newTotalAmount = 0;

                // Find default location for inventory
                const loc = await tx.location.findFirst();

                for (const updatedItem of data.items) {
                    const existingItem = existing.items.find(i => i.id === updatedItem.id);
                    if (!existingItem) continue;

                    const oldQty = existingItem.quantity;
                    const newQty = updatedItem.quantity;
                    const qtyDelta = oldQty - newQty; // positive = restored stock, negative = deducted

                    // Adjust inventory if quantity changed
                    if (qtyDelta !== 0 && loc) {
                        const inventory = await tx.inventory.findFirst({
                            where: { productId: updatedItem.productId, locationId: loc.id }
                        });

                        if (inventory) {
                            const newStock = inventory.quantity + qtyDelta;
                            if (newStock < 0) {
                                const product = await tx.product.findUnique({ where: { id: updatedItem.productId } });
                                throw new Error(`Insufficient stock for ${product?.name || updatedItem.productId}. Available: ${inventory.quantity}, Required increase: ${Math.abs(qtyDelta)}`);
                            }
                            await tx.inventory.update({
                                where: { id: inventory.id },
                                data: { quantity: newStock }
                            });
                        }
                    }

                    // Update invoice item
                    const newSubtotal = updatedItem.quantity * updatedItem.unitPrice;
                    await tx.invoiceItem.update({
                        where: { id: updatedItem.id },
                        data: {
                            quantity: updatedItem.quantity,
                            unitPrice: updatedItem.unitPrice,
                            subtotal: newSubtotal
                        }
                    });

                    newTotalAmount += newSubtotal;
                }
            }

            // 3. Calculate balance
            const amountPaid = data.amountPaid ?? Number(existing.amountPaid);
            const previousBalance = Number(existing.previousBalance);
            const currentBalance = previousBalance + newTotalAmount - amountPaid;

            // 4. Update the invoice itself
            const updatedInvoice = await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    totalAmount: newTotalAmount,
                    amountPaid,
                    currentBalance,
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
