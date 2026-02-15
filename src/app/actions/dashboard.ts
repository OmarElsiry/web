'use server';

import getPrisma from '@/lib/prisma';

export async function getDashboardStats() {
    const prisma = getPrisma();

    // Parallelize queries for performance
    // Parallelize queries for performance
    const [
        totalRevenue, totalRefunds,
        inventoryCount,
        salesToday, refundsToday,
        recentSales,
        activeVehicles,
        weeklyInvoices, weeklyRefunds
    ] = await Promise.all([
        // 1. Total Revenue (Invoices)
        prisma.invoice.aggregate({
            _sum: { totalAmount: true }
        }),
        // 1b. Total Refunds
        prisma.refund.aggregate({
            _sum: { totalAmount: true }
        }),

        // 2. Active Inventory
        prisma.inventory.aggregate({
            _sum: { quantity: true }
        }),

        // 3. Sales Today
        prisma.invoice.aggregate({
            _sum: { totalAmount: true },
            where: {
                date: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        }),
        // 3b. Refunds Today
        prisma.refund.aggregate({
            _sum: { totalAmount: true },
            where: {
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        }),

        // 4. Recent Sales
        prisma.invoice.findMany({
            take: 5,
            orderBy: { date: 'desc' },
            include: {
                user: {
                    select: { name: true, username: true }
                },
                items: true
            }
        }),

        // 5. Active Vehicles
        prisma.location.count({
            where: { type: 'VEHICLE' }
        }),

        // 6. Weekly Invoices
        (async () => {
            const dailyData = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const start = new Date(date.setHours(0, 0, 0, 0));
                const end = new Date(date.setHours(23, 59, 59, 999));
                const res = await prisma.invoice.aggregate({
                    _sum: { totalAmount: true },
                    where: { date: { gte: start, lte: end } }
                });
                dailyData.push({ start, amount: Number(res._sum.totalAmount || 0) });
            }
            return dailyData;
        })(),
        // 6b. Weekly Refunds
        (async () => {
            const dailyData = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const start = new Date(date.setHours(0, 0, 0, 0));
                const end = new Date(date.setHours(23, 59, 59, 999));
                const res = await prisma.refund.aggregate({
                    _sum: { totalAmount: true },
                    where: { createdAt: { gte: start, lte: end } }
                });
                dailyData.push({ amount: Number(res._sum.totalAmount || 0) });
            }
            return dailyData;
        })()
    ]);

    // Format Weekly Data
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyFormatted = weeklyInvoices.map((day, idx) => ({
        day: dayNames[new Date(day.start).getDay()],
        amount: day.amount - (weeklyRefunds[idx]?.amount || 0)
    }));

    return {
        revenue: Number(totalRevenue._sum.totalAmount || 0) - Number(totalRefunds._sum.totalAmount || 0),
        activeInventory: inventoryCount._sum.quantity || 0,
        salesToday: Number(salesToday._sum.totalAmount || 0) - Number(refundsToday._sum.totalAmount || 0),
        recentSales: recentSales.map(inv => ({
            ...inv,
            totalAmount: Number(inv.totalAmount),
            items: inv.items.map(item => ({
                ...item,
                unitPrice: Number(item.unitPrice),
                subtotal: Number(item.subtotal)
            }))
        })),
        activeVehicles,
        weeklyData: weeklyFormatted
    };
}
