'use server';

import getPrisma from '@/lib/prisma';

// Get all staff members with their basic info
export async function getStaffList() {
    const prisma = getPrisma();
    const staff = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            username: true,
            role: true,
            createdAt: true
        },
        orderBy: { name: 'asc' }
    });
    return staff;
}

// Get sales details for a specific staff member by period
export async function getStaffSalesDetail(
    userId: string,
    period: 'day' | 'week' | 'month' | '2months' | '6months' | 'all'
) {
    const prisma = getPrisma();

    const now = new Date();
    let startDate: Date | undefined;

    switch (period) {
        case 'day':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case '2months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            break;
        case '6months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            break;
        case 'all':
        default:
            startDate = undefined;
    }

    const invoices = await prisma.invoice.findMany({
        where: {
            userId,
            ...(startDate && { date: { gte: startDate } })
        },
        include: {
            items: {
                include: { product: true }
            }
        },
        orderBy: { date: 'desc' }
    });

    const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalTransactions = invoices.length;

    return {
        invoices,
        totalSales,
        totalTransactions,
        period
    };
}
