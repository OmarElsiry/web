import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import getPrisma from '@/lib/prisma';
import { generateInvoicePdfBuffer } from '@/lib/services/pdf-generator';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const prisma = getPrisma();

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Build the query
    const whereClause: any = {};
    if (startDateStr || endDateStr) {
        whereClause.date = {};
        if (startDateStr) {
            whereClause.date.gte = new Date(startDateStr);
        }
        if (endDateStr) {
            const endDate = new Date(endDateStr);
            endDate.setHours(23, 59, 59, 999);
            whereClause.date.lte = endDate;
        }
    }

    try {
        const invoices = await prisma.invoice.findMany({
            where: whereClause,
            include: { 
                items: { include: { product: { include: { category: true } } } }, 
                user: { select: { name: true, username: true, phone: true, address: true } },
                customer: true
            },
            orderBy: { date: 'desc' }
        });

        if (invoices.length === 0) {
            return NextResponse.json({ error: 'No invoices found for the selected criteria' }, { status: 404 });
        }

        const zip = new JSZip();

        // Limit the number of invoices exported to prevent out-of-memory
        const maxExport = 200;
        const exportInvoices = invoices.slice(0, maxExport);

        for (const invoice of exportInvoices) {
            try {
                // generateInvoicePdfBuffer expects invoice.items[x].product to be populated
                const buffer = await generateInvoicePdfBuffer(invoice);
                
                // Add to zip
                const dateStr = invoice.date.toISOString().split('T')[0];
                const filename = `Invoice_${dateStr}_${invoice.id.slice(0, 8).toUpperCase()}.pdf`;
                zip.file(filename, buffer);
            } catch (err) {
                console.error(`Failed to generate PDF for invoice ${invoice.id}:`, err);
            }
        }

        const zipBuffer = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });

        return new NextResponse(zipBuffer as any, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="invoices-export-${new Date().toISOString().split('T')[0]}.zip"`,
                'Cache-Control': 'no-store, max-age=0'
            },
        });
    } catch (error) {
        console.error('ZIP Export Error:', error);
        return NextResponse.json({ error: 'Failed to generate ZIP export' }, { status: 500 });
    }
}
