'use server';

import getPrisma from '@/lib/prisma';

export async function getInvoices() {
    const prisma = getPrisma();

    // Fetch latest 50 for now (pagination can be added later)
    const invoices = await prisma.invoice.findMany({
        take: 50,
        orderBy: { date: 'desc' },
        include: {
            user: {
                select: { name: true, username: true }
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
