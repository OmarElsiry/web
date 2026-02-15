'use server';

import { getPrisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
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
