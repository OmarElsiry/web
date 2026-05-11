/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import getPrisma from '@/lib/prisma';


interface DateRange {
    startDate?: string;
    endDate?: string;
}

export async function getBuyerReport({ startDate, endDate }: DateRange) {
    const prisma = getPrisma();
    const whereInvoice: any = {};
    const whereRefund: any = {};

    if (startDate && endDate) {
        const dateRange = {
            gte: new Date(startDate),
            lte: new Date(new Date(endDate).setHours(23, 59, 59))
        };
        whereInvoice.date = dateRange;
        whereRefund.createdAt = dateRange;
    }

    const [invoices, refunds] = await Promise.all([
        prisma.invoice.findMany({
            where: whereInvoice,
            select: {
                id: true,
                customerName: true,
                customerPhone: true,
                customerAddress: true,
                totalAmount: true,
                date: true,
                items: true
            },
            orderBy: { date: 'desc' }
        }),
        prisma.refund.findMany({
            where: whereRefund,
            include: {
                items: true,
                invoice: true
            }
        })
    ]);

    // Build product name lookup
    const products = await prisma.product.findMany({ select: { id: true, name: true } });
    const productNameMap = new Map(products.map(p => [p.id, p.name]));

    // Aggregate by Customer (Name + Phone as key)
    const buyerMap = new Map();

    invoices.forEach(inv => {
        const key = `${inv.customerName || 'Unknown'}-${inv.customerPhone || ''}`;
        if (!buyerMap.has(key)) {
            buyerMap.set(key, {
                name: inv.customerName || 'Unknown',
                phone: inv.customerPhone || 'N/A',
                address: inv.customerAddress || '',
                totalSpent: 0,
                visitCount: 0,
                lastVisit: inv.date,
                purchaseHistory: new Map()
            });
        }
        const buyer = buyerMap.get(key);
        buyer.totalSpent += Number(inv.totalAmount);
        buyer.visitCount += 1;
        if (!buyer.address && inv.customerAddress) buyer.address = inv.customerAddress;
        if (new Date(inv.date) > new Date(buyer.lastVisit)) {
            buyer.lastVisit = inv.date;
        }
        // Aggregate purchase history
        const items = inv.items as any[];
        if (Array.isArray(items)) {
            items.forEach(item => {
                const pName = productNameMap.get(item.productId) || item.name || 'Unknown';
                const existing = buyer.purchaseHistory.get(pName) || 0;
                buyer.purchaseHistory.set(pName, existing + (Number(item.quantity) || 0));
            });
        }
    });

    // Subtract Refunds from Buyers
    refunds.forEach(ref => {
        const name = ref.invoice?.customerName || 'Unknown';
        const phone = ref.invoice?.customerPhone || 'N/A';
        const key = `${name}-${phone === 'N/A' ? '' : phone}`;

        const buyer = buyerMap.get(key);
        if (buyer) {
            buyer.totalSpent -= Number(ref.totalAmount);
            // We don't necessarily subtract visitCount unless we consider refund a "negative visit"
            // But we should subtract quantities from purchase history
            ref.items.forEach((item: any) => {
                const pName = productNameMap.get(item.productId) || 'Unknown';
                const existing = buyer.purchaseHistory.get(pName) || 0;
                buyer.purchaseHistory.set(pName, Math.max(0, existing - (Number(item.quantity) || 0)));
            });
        }
    });

    return Array.from(buyerMap.values()).map(b => ({
        ...b,
        purchaseHistory: Array.from(b.purchaseHistory.entries() as IterableIterator<[string, number]>).map(([name, qty]) => ({ name, quantity: qty })).sort((a, b) => b.quantity - a.quantity)
    })).sort((a, b) => b.totalSpent - a.totalSpent);
}

export async function getProductReport({ startDate, endDate }: DateRange) {
    const prisma = getPrisma();
    const whereInvoice: any = {};
    const whereRefund: any = {};

    if (startDate && endDate) {
        const dateRange = {
            gte: new Date(startDate),
            lte: new Date(new Date(endDate).setHours(23, 59, 59))
        };
        whereInvoice.date = dateRange;
        whereRefund.createdAt = dateRange;
    }

    const [invoices, refunds] = await Promise.all([
        prisma.invoice.findMany({
            where: whereInvoice,
            select: { items: true }
        }),
        prisma.refund.findMany({
            where: whereRefund,
            include: { items: true }
        })
    ]);

    const productMap = new Map();
    const products = await prisma.product.findMany({ select: { id: true, name: true, sku: true } });
    const productInfoMap = new Map(products.map(p => [p.id, p]));

    const processItem = (item: any, multiplier: number) => {
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
        const qty = (Number(item.quantity) || 0) * multiplier;
        stat.quantitySold += qty;
        const lineTotal = (Number(item.unitPrice || item.price) * (Number(item.quantity) || 0)) * multiplier;
        stat.revenue += lineTotal;
    };

    invoices.forEach(inv => {
        const items = inv.items as any[];
        if (Array.isArray(items)) items.forEach(item => processItem(item, 1));
    });

    refunds.forEach(ref => {
        ref.items.forEach(item => processItem(item, -1));
    });

    return Array.from(productMap.values()).sort((a, b) => b.quantitySold - a.quantitySold);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future analytics expansion
async function _getCustomerAnalytics() {
    const prisma = getPrisma();
    
    const customers = await prisma.customer.findMany({
        include: {
            invoices: {
                include: {
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    });

    return customers.map(c => {
        let totalSpent = 0;
        let lastVisit: Date | null = null;
        const purchaseHistory = new Map<string, number>();

        c.invoices.forEach(inv => {
            totalSpent += Number(inv.totalAmount);
            if (!lastVisit || new Date(inv.date) > new Date(lastVisit)) {
                lastVisit = inv.date;
            }
            inv.items.forEach(item => {
                const existing = purchaseHistory.get(item.product.name) || 0;
                purchaseHistory.set(item.product.name, existing + item.quantity);
            });
        });

        return {
            id: c.id,
            name: c.name,
            phone: c.phone || 'N/A',
            address: c.address || 'N/A',
            balance: Number(c.balance),
            totalSpent,
            visitCount: c.invoices.length,
            lastVisit,
            purchaseHistory: Array.from(purchaseHistory.entries())
                .map(([name, quantity]) => ({ name, quantity }))
                .sort((a, b) => b.quantity - a.quantity)
        };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
}
