import { NextResponse } from 'next/server';
import getPrisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';
import { createObjectCsvStringifier } from 'csv-writer'; // Use stringifier for Buffer operations
import { sendBackup } from '@/lib/services/telegram';

export async function GET(request: Request) {
    const prisma = getPrisma();
    // Optional: Add a secret key check for security
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    if (key !== process.env.CRON_SECRET && process.env.NODE_ENV === 'production') {
        // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const dateStr = new Date().toISOString().split('T')[0];

        // 1. Invoices
        const invoices = await prisma.invoice.findMany();
        const invoiceCsvWriter = createObjectCsvStringifier({
            header: [
                { id: 'id', title: 'ID' },
                { id: 'date', title: 'Date' },
                { id: 'totalAmount', title: 'Total' },
                { id: 'paymentMethod', title: 'Method' },
                { id: 'customerName', title: 'Customer' }
            ]
        });
        const invoiceCsv = invoiceCsvWriter.getHeaderString() + invoiceCsvWriter.stringifyRecords(invoices as any);

        await sendBackup(
            Buffer.from(invoiceCsv),
            `invoices-${dateStr}.csv`,
            `📊 Monthly Backup: Invoices - ${dateStr}`
        );

        // 2. Inventory
        const inventory = await prisma.inventory.findMany({ include: { product: true, location: true } });
        const inventoryCsvWriter = createObjectCsvStringifier({
            header: [
                { id: 'productName', title: 'Product' },
                { id: 'locationName', title: 'Location' },
                { id: 'quantity', title: 'Quantity' }
            ]
        });
        const inventoryRecords = inventory.map((i: any) => ({
            productName: i.product.name,
            locationName: i.location.name,
            quantity: i.quantity
        }));
        const inventoryCsv = inventoryCsvWriter.getHeaderString() + inventoryCsvWriter.stringifyRecords(inventoryRecords);

        await sendBackup(
            Buffer.from(inventoryCsv),
            `inventory-${dateStr}.csv`,
            `📦 Monthly Backup: Inventory - ${dateStr}`
        );

        return NextResponse.json(
            { success: true, message: 'Backups sent to Telegram' },
            { headers: { 'Cache-Control': 'no-store' } }
        );

    } catch (error: any) {
        console.error('Backup failed:', error);
        return NextResponse.json(
            { error: error.message }, 
            { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
    }
}
