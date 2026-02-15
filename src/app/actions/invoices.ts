'use server';

import { getPrisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// Update type definition if not global, but for now we'll imply it from usage
export async function getInvoices() {
    const prisma = getPrisma();

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
            }
        }
    });

    return invoices.map(inv => ({
        ...inv,
        totalAmount: Number(inv.totalAmount),
        items: inv.items.map(item => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.subtotal)
        }))
    }));
}

export async function getInvoiceById(id: string) {
    const prisma = getPrisma();
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
            }
        }
    });

    if (!invoice) return null;

    return {
        ...invoice,
        totalAmount: Number(invoice.totalAmount),
        items: invoice.items.map(item => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            subtotal: Number(item.subtotal),
            // Ensure product fields are accessible
            productCode: item.product.sku,
            productName: item.product.name,
            productUnit: item.product.unit,
            categoryName: item.product.category?.name
        }))
    };
}
