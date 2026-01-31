'use server';

import getPrisma from '@/lib/prisma';

export async function getDashboardStats() {
    const prisma = getPrisma();

    // Parallelize queries for performance
    const [totalRevenue, inventoryCount, salesToday, recentSales, activeVehicles, weeklyData] = await Promise.all([
        // 1. Total Revenue (Sum of all invoices)
        prisma.invoice.aggregate({
            _sum: { totalAmount: true }
        }),

        // 2. Active Inventory (Sum of quantity across all stock)
        prisma.inventory.aggregate({
            _sum: { quantity: true }
        }),

        // 3. Sales Today (Sum of totalAmount for invoices created today)
        prisma.invoice.aggregate({
            _sum: { totalAmount: true },
            where: {
                date: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        }),

        // 4. Recent Sales (Latest 5 invoices)
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

        // 6. Daily sales for last 7 days
        (async () => {
            const days = 7;
            const dailyData = [];
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const startOfDay = new Date(date.setHours(0, 0, 0, 0));
                const endOfDay = new Date(date.setHours(23, 59, 59, 999));

                const daySales = await prisma.invoice.aggregate({
                    _sum: { totalAmount: true },
                    where: {
                        date: { gte: startOfDay, lte: endOfDay }
                    }
                });

                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                dailyData.push({
                    day: dayNames[new Date(startOfDay).getDay()],
                    amount: Number(daySales._sum.totalAmount || 0)
                });
            }
            return dailyData;
        })()
    ]);

    return {
        revenue: Number(totalRevenue._sum.totalAmount || 0),
        activeInventory: inventoryCount._sum.quantity || 0,
        salesToday: Number(salesToday._sum.totalAmount || 0),
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
        weeklyData: weeklyData
    };
}
