'use server';

import getPrisma from '@/lib/prisma';

interface DateRange {
    startDate?: string;
    endDate?: string;
}

export async function getProfitReport({ startDate, endDate }: DateRange = {}) {
    const prisma = getPrisma();
    
    let whereClause = '';
    const params: any[] = [];
    
    if (startDate && endDate) {
        // We use string interpolation for the where clause since Prisma's $queryRawUnsafe 
        // handles the actual parameter bindings safely via $1, $2
        whereClause = 'WHERE "Invoice"."status" = \'ACCEPTED\' AND "Invoice"."date" >= $1 AND "Invoice"."date" <= $2';
        params.push(
            new Date(startDate), 
            new Date(new Date(endDate).setHours(23, 59, 59))
        );
    } else {
        whereClause = 'WHERE "Invoice"."status" = \'ACCEPTED\'';
    }
    
    // We run the raw queries to prevent memory leaks from loading all items into memory
    const revenueRes = await prisma.$queryRawUnsafe<any[]>(`
        SELECT SUM("totalAmount") as "totalRevenue" 
        FROM "Invoice" 
        ${whereClause}
    `, ...params);

    const costRes = await prisma.$queryRawUnsafe<any[]>(`
        SELECT SUM("InvoiceItem"."quantity" * "Product"."costPrice") as "totalCost"
        FROM "InvoiceItem"
        JOIN "Invoice" ON "Invoice"."id" = "InvoiceItem"."invoiceId"
        JOIN "Product" ON "Product"."id" = "InvoiceItem"."productId"
        ${whereClause}
    `, ...params);

    const recentSalesRes = await prisma.invoice.findMany({
        where: {
            status: 'ACCEPTED',
            ...(startDate && endDate ? {
                date: {
                    gte: new Date(startDate),
                    lte: new Date(new Date(endDate).setHours(23, 59, 59))
                }
            } : {})
        },
        take: 5,
        orderBy: { date: 'desc' },
        select: {
            id: true,
            date: true,
            customerName: true,
            totalAmount: true
        }
    });

    const expensesRes = await prisma.expense.aggregate({
        _sum: { amount: true },
        where: startDate && endDate ? {
            date: {
                gte: new Date(startDate),
                lte: new Date(new Date(endDate).setHours(23, 59, 59))
            }
        } : undefined
    });

    const totalRevenue = Number(revenueRes[0]?.totalRevenue || 0);
    const totalCost = Number(costRes[0]?.totalCost || 0);
    const totalExpenses = Number(expensesRes._sum.amount || 0);
    const netProfit = totalRevenue - totalCost - totalExpenses;

    return {
        totalRevenue,
        totalCost,
        totalExpenses,
        netProfit,
        recentSales: recentSalesRes.map(sale => ({
            ...sale,
            totalAmount: Number(sale.totalAmount)
        }))
    };
}
