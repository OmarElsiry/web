import { NextRequest, NextResponse } from 'next/server';
import getPrisma from '@/lib/prisma';
import { createObjectCsvStringifier } from 'csv-writer';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'daily' or 'monthly'

    const prisma = getPrisma();
    const now = new Date();
    
    let startDate: Date;
    let endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    if (type === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    }

    try {
        const invoices = await prisma.invoice.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                customer: true,
                items: {
                    include: { product: true }
                }
            },
            orderBy: { date: 'desc' }
        });

        const csvStringifier = createObjectCsvStringifier({
            header: [
                { id: 'id', title: 'INVOICE ID' },
                { id: 'date', title: 'DATE' },
                { id: 'customer', title: 'CUSTOMER' },
                { id: 'totalAmount', title: 'TOTAL AMOUNT' },
                { id: 'paymentMethod', title: 'PAYMENT METHOD' },
            ]
        });

        const records = invoices.map(inv => ({
            id: inv.id,
            date: new Date(inv.date).toISOString().split('T')[0],
            customer: inv.customer?.name || inv.customerName || 'Walk-in',
            totalAmount: Number(inv.totalAmount).toFixed(2),
            paymentMethod: inv.paymentMethod
        }));

        const csvString = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

        return new NextResponse(csvString, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="sales_export_${type}_${now.toISOString().split('T')[0]}.csv"`,
                'Cache-Control': 'no-store'
            }
        });
    } catch (error) {
        console.error('Export error:', error);
        return new NextResponse('Internal Server Error', { 
            status: 500,
            headers: { 'Cache-Control': 'no-store' }
        });
    }
}
