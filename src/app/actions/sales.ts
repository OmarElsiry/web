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

export async function processSale(
    items: { productId: string, quantity: number }[],
    paymentMethod: 'CASH' | 'CREDIT' | 'INSTAPAY',
    buyerInfo?: { customerName?: string, customerPhone?: string, customerAddress?: string },
    userId?: string
) {
    const prisma = getPrisma();

    // 1. Calculate Total & Validate Stock
    let totalAmount = 0;
    const invoiceItemsData: { productId: string, quantity: number, unitPrice: number, subtotal: number }[] = [];

    // We need a location for stock deduction. 
    // Ideally this comes from the user's session/branch.
    // Self-healing: If no location exists, create a default one.
    let location = await prisma.location.findFirst();

    if (!location) {
        location = await prisma.location.create({
            data: {
                name: "Main Warehouse",
                type: "WAREHOUSE"
            }
        });
    }

    for (const item of items) {
        const product = await prisma.product.findUnique({
            where: { id: item.productId }
        });

        if (!product) throw new Error(`Product ${item.productId} not found`);

        const price = Number(product.baseSellingPrice);
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

            // B. CREATE INVOICE with buyer/seller info
            const newInvoice = await tx.invoice.create({
                data: {
                    totalAmount,
                    paymentMethod,
                    customerName: buyerInfo?.customerName || null,
                    customerPhone: buyerInfo?.customerPhone || null,
                    customerAddress: buyerInfo?.customerAddress || null,
                    userId: userId || null,
                    items: {
                        create: invoiceItemsData
                    }
                },
                include: {
                    items: true
                }
            });

            return newInvoice;

        }, {
            timeout: 10000 // Ensure transaction doesn't hang
        });

        revalidatePath('/dashboard');
        revalidatePath('/inventory');
        revalidatePath('/sales');

        return {
            success: true,
            invoice: {
                ...invoice,
                totalAmount: Number(invoice.totalAmount),
                items: invoice.items.map(item => ({
                    ...item,
                    unitPrice: Number(item.unitPrice),
                    subtotal: Number(item.subtotal)
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
