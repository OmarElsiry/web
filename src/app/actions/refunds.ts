/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import getPrisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { PrismaClient } from '@/generated/client';

// Types
type RefundItemInput = {
    productId: string;
    quantity: number;
    unitPrice: number;
    condition: 'NEW' | 'DEFECTIVE';
};

type CreateRefundInput = {
    invoiceId?: string;
    userId: string;
    items: RefundItemInput[];
    reason?: string;
};

async function verifyInvoiceQuantities(tx: any, invoiceId: string, items: RefundItemInput[]) {
    const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { items: true, refunds: { include: { items: true } } }
    });

    if (!invoice) throw new Error("Invoice not found.");

    const refundedQtyMap = new Map<string, number>();
    invoice.refunds.forEach((ref: any) => {
        ref.items.forEach((ri: any) => {
            const current = refundedQtyMap.get(ri.productId) || 0;
            refundedQtyMap.set(ri.productId, current + ri.quantity);
        });
    });

    for (const item of items) {
        const invoiceItem = invoice.items.find((ii: any) => ii.productId === item.productId);
        if (!invoiceItem) throw new Error(`Product ${item.productId} not found on invoice.`);

        const alreadyRefunded = refundedQtyMap.get(item.productId) || 0;
        if (alreadyRefunded + item.quantity > invoiceItem.quantity) {
            throw new Error(`Refund quantity for product ${item.productId} exceeds the original invoice quantity.`);
        }
    }
}

async function processRefundStockUpdates(tx: any, items: RefundItemInput[], userId: string, invoiceId?: string, reason?: string) {
    const reasonSuffix = reason ? ` - ${reason}` : '';
    const warehouse = await tx.location.findFirst({
        where: { type: 'WAREHOUSE' }
    });

    if (!warehouse) throw new Error("No warehouse found to restock items.");

    for (const item of items) {
        // Always update Product's total refund stat
        await tx.product.update({
            where: { id: item.productId },
            data: {
                totalRefunded: { increment: item.quantity },
                // If defective, update the defective stock counter
                ...(item.condition === 'DEFECTIVE' ? { defectiveStock: { increment: item.quantity } } : {})
            }
        });

        if (item.condition === 'NEW') {
            // Return to Sellable Stock (In Warehouse)
            await tx.inventory.upsert({
                where: {
                    productId_locationId: {
                        productId: item.productId,
                        locationId: warehouse.id
                    }
                },
                update: { quantity: { increment: item.quantity } },
                create: {
                    productId: item.productId,
                    locationId: warehouse.id,
                    quantity: item.quantity
                }
            });

            // Log Movement as RESTOCK
            await tx.transaction.create({
                data: {
                    type: 'REFUND_RESTOCK',
                    toLocationId: warehouse.id,
                    createdById: userId,
                    notes: `Refund Restock for Invoice #${invoiceId || 'N/A'}${reasonSuffix}`,
                    items: {
                        create: [{
                            productId: item.productId,
                            quantity: item.quantity
                        }]
                    }
                }
            });
        } else if (item.condition === 'DEFECTIVE') {
            // Log Movement as DEFECTIVE
            await tx.transaction.create({
                data: {
                    type: 'REFUND_DEFECTIVE',
                    createdById: userId,
                    notes: `Defective Refund for Invoice #${invoiceId || 'N/A'}${reasonSuffix}`,
                    items: {
                        create: [{
                            productId: item.productId,
                            quantity: item.quantity
                        }]
                    }
                }
            });
        }
    }
}

export async function createRefund(data: CreateRefundInput) {
    const prisma: PrismaClient = getPrisma();
    const { invoiceId, userId, items, reason } = data;

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    try {
        await prisma.$transaction(async (tx) => {
            // 0. Verify quantities if linked to an invoice (Security & Integrity Check)
            if (invoiceId) {
                await verifyInvoiceQuantities(tx, invoiceId, items);
            }

            // 1. Create Refund Record with its items
            await tx.refund.create({
                data: {
                    totalAmount,
                    reason,
                    invoiceId: invoiceId || null,
                    userId,
                    items: {
                        create: items.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            condition: item.condition
                        }))
                    }
                }
            });

            // 2. Process Stock & Product Level Updates
            await processRefundStockUpdates(tx, items, userId, invoiceId, reason);
        });

        revalidatePath('/invoices');
        revalidatePath('/products');
        revalidatePath('/analytics');
        return { success: true };
    } catch (error) {
        console.error('Refund creation failed:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to create refund' };
    }
}

export async function getRefunds() {
    const prisma: PrismaClient = getPrisma();
    try {
        const refunds = await prisma.refund.findMany({
            include: {
                user: true,
                items: {
                    include: { product: true }
                },
                invoice: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return refunds.map((ref: any) => ({
            ...ref,
            totalAmount: Number(ref.totalAmount),
            items: (ref.items || []).map((item: any) => ({
                ...item,
                unitPrice: Number(item.unitPrice)
            }))
        }));
    } catch (error) {
        console.error("Error fetching refunds:", error);
        return [];
    }
}
