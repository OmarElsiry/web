/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import getPrisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getProducts() {
    const prisma = getPrisma();

    // Get default location for stock lookup
    const location = await prisma.location.findFirst();

    // Get all products with category
    const products = await prisma.product.findMany({
        include: { category: true }
    });

    // Get inventory for all products at once
    const inventories = location ? await prisma.inventory.findMany({
        where: { locationId: location.id }
    }) : [];

    // Map inventory to a lookup
    const stockMap = new Map(inventories.map(inv => [inv.productId, inv.quantity]));

    return products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        baseSellingPrice: Number(p.baseSellingPrice),
        costPrice: Number(p.costPrice),
        categoryId: p.categoryId,
        category: p.category,
        stock: stockMap.get(p.id) || 0
    }));
}

export async function getCategories() {
    const prisma = getPrisma();
    return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

export async function getStaffList() {
    const prisma = getPrisma();
    // Fetch users who are likely staff (e.g., ADMIN or READ_ONLY, or just all users)
    // For now, fetch all users.
    return prisma.user.findMany({
        select: { id: true, username: true, name: true, role: true },
        orderBy: { name: 'asc' }
    });
}

export async function processSale(
    items: { productId: string, quantity: number, unitPrice?: number }[],
    paymentMethod: 'CASH' | 'CREDIT' | 'INSTAPAY',
    buyerInfo?: { customerName?: string, customerPhone?: string, customerAddress?: string },
    userId?: string,
    staffId?: string,
    amountPaid?: number,
    customerId?: string
) {
    const prisma = getPrisma();

    // Determine who gets credit for the sale (Staff ID if selected, otherwise logged-in user)
    const sellerId = staffId || userId;

    // 1. Calculate Total & Validate Stock
    let totalAmount = 0;
    const invoiceItemsData: { productId: string, quantity: number, unitPrice: number, subtotal: number }[] = [];

    for (const item of items) {
        const product = await prisma.product.findUnique({
            where: { id: item.productId }
        });

        if (!product) throw new Error(`Product ${item.productId} not found`);

        const price = item.unitPrice !== undefined ? item.unitPrice : Number(product.baseSellingPrice);
        totalAmount += price * item.quantity;

        invoiceItemsData.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: price,
            subtotal: price * item.quantity
        });
    }

    // 2. Transaction
    try {
        const invoice = await prisma.$transaction(async (tx) => {
            // Find or create location
            let loc = await tx.location.findFirst();
            if (!loc) {
                loc = await tx.location.create({
                    data: { name: "Main Warehouse", type: "WAREHOUSE" }
                });
            }

            // A. VALIDATE STOCK & PREPARE UPDATES
            for (const item of items) {
                const inventory = await tx.inventory.findFirst({
                    where: { productId: item.productId, locationId: loc.id }
                });

                const available = inventory ? inventory.quantity : 0;
                if (available < item.quantity) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    throw new Error(`Insufficient stock for ${product?.name || item.productId}. Available: ${available}, Required: ${item.quantity}`);
                }

                // Update Inventory (Decrement)
                await tx.inventory.update({
                    where: { id: inventory!.id },
                    data: { quantity: { decrement: item.quantity } }
                });
            }

            // B. RESOLVE CUSTOMER & BALANCE
            let finalCustomerId = customerId;
            let previousBalance = 0;

            if (!finalCustomerId && buyerInfo?.customerName) {
                const name = buyerInfo.customerName as string;
                const phone = buyerInfo.customerPhone || null;

                // Try to resolve customer by name/phone, or create if not found
                const customer = await tx.customer.upsert({
                    where: {
                        name_phone: {
                            name: name as any,
                            phone: phone as any
                        }
                    },
                    update: {},
                    create: {
                        name,
                        phone: phone as string | null,
                        address: buyerInfo.customerAddress || null
                    }
                });
                finalCustomerId = customer.id;
                previousBalance = Number(customer.balance);
            } else if (finalCustomerId) {
                const customer = await tx.customer.findUnique({ where: { id: finalCustomerId } });
                previousBalance = customer ? Number(customer.balance) : 0;
            }

            const paid = amountPaid ?? (paymentMethod === 'CREDIT' ? 0 : totalAmount);
            const currentBalance = previousBalance + totalAmount - paid;

            // Update Customer Balance
            if (finalCustomerId) {
                await tx.customer.update({
                    where: { id: finalCustomerId },
                    data: { balance: currentBalance }
                });
            }

            // C. CREATE INVOICE with AR metrics
            const newInvoice = await tx.invoice.create({
                data: {
                    totalAmount,
                    paymentMethod,
                    customerName: buyerInfo?.customerName || null,
                    customerPhone: buyerInfo?.customerPhone || null,
                    customerAddress: buyerInfo?.customerAddress || null,
                    customerId: finalCustomerId || null,
                    previousBalance,
                    amountPaid: paid,
                    currentBalance,
                    userId: sellerId || null,
                    items: {
                        create: invoiceItemsData
                    }
                },
                include: {
                    items: true
                }
            });

            // C. CREATE TRANSACTION (Stock Movement Log)
            await tx.transaction.create({
                data: {
                    type: 'SALE',
                    fromLocationId: loc.id,
                    createdById: sellerId, // Attribute to Staff or User
                    items: {
                        create: items.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity
                        }))
                    }
                }
            });

            return newInvoice;

        }, {
            timeout: 10000
        });

        // 3. Audit Log (Async, non-blocking)
        try {
            const { logActivity } = await import('./audit');
            const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
            const attributionSuffix = staffId ? ` (Attributed to Staff: ${staffId})` : '';
            const actionDetails = `Processed sale #${invoice.id} - ${itemCount} items. Total: ${invoice.totalAmount}${attributionSuffix}`;

            await logActivity(
                'SALE',
                actionDetails,
                userId
            );
        } catch (e) {
            console.error('Failed to log activity:', e);
        }

        revalidatePath('/dashboard');
        revalidatePath('/inventory');
        revalidatePath('/sales');
        revalidatePath('/logs');
        revalidatePath('/inventory/transactions');

        return {
            success: true,
            invoice: {
                ...invoice,
                totalAmount: Number(invoice.totalAmount),
                items: invoice.items.map(it => ({
                    ...it,
                    unitPrice: Number(it.unitPrice),
                    subtotal: Number(it.subtotal)
                }))
            }
        };
    } catch (error: any) {
        console.error("Sale processing failed:", error);
        return {
            success: false,
            error: error.message || "An unexpected error occurred during the sale."
        };
    }
}
