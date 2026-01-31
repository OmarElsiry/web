'use server';

import getPrisma from '@/lib/prisma';


interface DateRange {
    startDate?: string;
    endDate?: string;
}

export async function getBuyerReport({ startDate, endDate }: DateRange) {
    const prisma = getPrisma();
    const where: any = {};

    if (startDate && endDate) {
        where.date = {
            gte: new Date(startDate),
            lte: new Date(new Date(endDate).setHours(23, 59, 59))
        };
    }

    const invoices = await prisma.invoice.findMany({
        where,
        select: {
            id: true,
            customerName: true,
            customerPhone: true,
            totalAmount: true,
            date: true,
            items: true // We might need to count items
        },
        orderBy: { date: 'desc' }
    });

    // Aggregate by Customer (Name + Phone as key)
    const buyerMap = new Map();

    invoices.forEach(inv => {
        const key = `${inv.customerName || 'Unknown'}-${inv.customerPhone || ''}`;
        if (!buyerMap.has(key)) {
            buyerMap.set(key, {
                name: inv.customerName || 'Unknown',
                phone: inv.customerPhone || 'N/A',
                totalSpent: 0,
                visitCount: 0,
                lastVisit: inv.date
            });
        }
        const buyer = buyerMap.get(key);
        buyer.totalSpent += Number(inv.totalAmount);
        buyer.visitCount += 1;
        // Keep latest date
        if (new Date(inv.date) > new Date(buyer.lastVisit)) {
            buyer.lastVisit = inv.date;
        }
    });

    return Array.from(buyerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
}

export async function getProductReport({ startDate, endDate }: DateRange) {
    const prisma = getPrisma();
    const where: any = {};

    if (startDate && endDate) {
        where.date = {
            gte: new Date(startDate),
            lte: new Date(new Date(endDate).setHours(23, 59, 59))
        };
    }

    const invoices = await prisma.invoice.findMany({
        where,
        select: {
            date: true,
            items: true
        }
    });

    // Aggregate by Product
    const productMap = new Map();

    // We need complete inventory list to show 0 sales items? Maybe later.
    // For now, show sold items.

    // To get product names properly, we might want to fetch products or trust the json in items.
    // The items JSON usually contains name, productId, etc.  
    // Let's assume structure: { productId: string, quantity: number, price: number, name?: string }

    const products = await prisma.product.findMany({ select: { id: true, name: true, sku: true } });
    const productInfoMap = new Map(products.map(p => [p.id, p]));

    invoices.forEach(inv => {
        const items = inv.items as any[];
        if (!Array.isArray(items)) return;

        items.forEach(item => {
            const pId = item.productId;
            if (!productMap.has(pId)) {
                const info = productInfoMap.get(pId);
                productMap.set(pId, {
                    id: pId,
                    name: info?.name || item.name || 'Unknown Product',
                    sku: info?.sku || 'N/A',
                    quantitySold: 0,
                    revenue: 0
                });
            }
            const stat = productMap.get(pId);
            stat.quantitySold += Number(item.quantity) || 0;
            // Revenue calculation might depend on if we stored line total or unit price
            // Assuming simplified: price * quantity
            // If item has total, use it.
            const lineTotal = item.price * item.quantity;
            stat.revenue += lineTotal;
        });
    });

    return Array.from(productMap.values()).sort((a, b) => b.quantitySold - a.quantitySold);
}
