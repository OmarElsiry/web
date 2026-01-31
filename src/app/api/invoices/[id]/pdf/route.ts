import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { createClient } from '@/lib/supabase/server';
import getPrisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const prisma = getPrisma();
    const { id } = await params;

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: { items: { include: { product: true } }, user: true }
    });

    if (!invoice) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Generate PDF
    const validParams = await params; // Ensure await if needed by Next.js types

    const buffer = await new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // -- Content Generation (Ported from legacy) --
        doc.fillColor('#444444')
            .fontSize(20)
            .text('Coffee Distribution Co.', 50, 57)
            .fontSize(10)
            .text('123 Coffee Lane', 200, 65, { align: 'right' })
            .text('Cairo, Egypt', 200, 80, { align: 'right' })
            .moveDown();

        doc.fillColor('#000000').fontSize(20).text('INVOICE', 50, 160);

        doc.fontSize(10)
            .text(`Invoice Number: ${invoice.id.slice(0, 8).toUpperCase()}`, 50, 200)
            .text(`Invoice Date: ${new Date(invoice.date).toLocaleDateString()}`, 50, 215)
            .text(`Customer: ${invoice.customerName || 'Walk-in Customer'}`, 50, 230)
            .text(`Salesperson: ${invoice.user?.name || invoice.user?.username || 'N/A'}`, 50, 245)
            .moveDown();

        const tableTop = 330;
        doc.font('Helvetica-Bold');
        doc.text('Item', 50, tableTop);
        doc.text('Quantity', 280, tableTop, { width: 90, align: 'right' });
        doc.text('Unit Price', 370, tableTop, { width: 90, align: 'right' });
        doc.text('Total', 0, tableTop, { align: 'right' });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let i = 0;
        doc.font('Helvetica');
        for (const item of invoice.items) {
            const y = tableTop + 30 + (i * 30);
            doc.text(item.product.name, 50, y);
            doc.text(item.quantity.toString(), 280, y, { width: 90, align: 'right' });
            // item.unitPrice is Decimal, coerce to number if needed or use Number()
            doc.text(Number(item.unitPrice).toFixed(2), 370, y, { width: 90, align: 'right' });
            doc.text(Number(item.subtotal).toFixed(2), 0, y, { align: 'right' });
            i++;
        }

        doc.moveTo(50, tableTop + 30 + (i * 30)).lineTo(550, tableTop + 30 + (i * 30)).stroke();

        const subtotalPosition = tableTop + 30 + (i * 30) + 15;
        doc.font('Helvetica-Bold');
        doc.text('Grand Total:', 350, subtotalPosition, { width: 90, align: 'right' });
        doc.text(Number(invoice.totalAmount).toFixed(2), 0, subtotalPosition, { align: 'right' });

        doc.end();
    });

    return new NextResponse(buffer as any, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
        },
    });
}
