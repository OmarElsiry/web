import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { createClient } from '@/lib/supabase/server';
import getPrisma from '@/lib/prisma';
import path from 'path';
import fs from 'fs';
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
        include: { items: { include: { product: true } }, user: { select: { name: true, username: true, phone: true, address: true } } }
    });

    if (!invoice) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Generate PDF
    const buffer = await new Promise<Buffer>((resolve, reject) => {
        const fontPath = path.join(process.cwd(), 'public', 'Amiri-Regular.ttf');
        const hasArabicFont = fs.existsSync(fontPath);

        const doc = new PDFDocument({ 
            margin: 50,
            font: hasArabicFont ? fontPath : undefined
        });
        if (hasArabicFont) {
            doc.registerFont('ArabicFont', fontPath);
        }
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // -- Content Generation --
        const logoPath = path.join(process.cwd(), 'public', 'stash-logo.png');
        let titleX = 50;
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 45, { width: 80 });
            titleX = 140; // Shift text if logo exists
        }

        doc.fillColor('#444444')
            .fontSize(20)
            .text('STASH', titleX, 57)
            .fontSize(10)
            .text('123 Coffee Lane', 200, 65, { align: 'right' })
            .text('Cairo, Egypt', 200, 80, { align: 'right' })
            .moveDown();

        doc.fillColor('#000000').fontSize(20).text('INVOICE', 50, 130);

        // Invoice Details
        doc.fontSize(10)
            .text(`Invoice Number: ${invoice.id.slice(0, 8).toUpperCase()}`, 50, 170)
            .text(`Date & Time: ${new Date(invoice.date).toLocaleString()}`, 50, 185)
            .moveDown();

        // Salesperson (Recorded By)
        doc.fontSize(12).fillColor('#0055AA').text('Salesperson (Recorded By)', 50, 210);
        doc.fontSize(10).fillColor('#000000')
            .text(`Name: ${invoice.user?.name || invoice.user?.username || 'N/A'}`, 50, 230)
            .text(`Username: @${invoice.user?.username || 'N/A'}`, 250, 230)
            .text(`Phone: ${invoice.user?.phone || 'N/A'}`, 50, 245)
            .text(`Address: ${invoice.user?.address || 'N/A'}`, 250, 245);

        // Buyer Information
        doc.fontSize(12).fillColor('#AA5500').text('Buyer Information', 50, 275);
        doc.fontSize(10).fillColor('#000000')
            .text(`Name: ${invoice.customerName || 'Walk-in Customer'}`, 50, 295)
            .text(`Phone: ${invoice.customerPhone || 'N/A'}`, 250, 295)
            .text(`Address: ${invoice.customerAddress || 'N/A'}`, 50, 310)
            .moveDown();

        const tableTop = 350;
        doc.font(fs.existsSync(fontPath) ? 'ArabicFont' : 'Helvetica-Bold');
        doc.text('Item / الصنف', 50, tableTop);
        doc.text('Quantity', 280, tableTop, { width: 90, align: 'right' });
        doc.text('Unit Price', 370, tableTop, { width: 90, align: 'right' });
        doc.text('Total', 0, tableTop, { align: 'right' });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let i = 0;
        doc.font(fs.existsSync(fontPath) ? 'ArabicFont' : 'Helvetica');
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
        doc.font(fs.existsSync(fontPath) ? 'ArabicFont' : 'Helvetica-Bold');
        doc.text('Grand Total / الاجمالي:', 350, subtotalPosition, { width: 90, align: 'right' });
        doc.text(Number(invoice.totalAmount).toFixed(2), 0, subtotalPosition, { align: 'right' });

        doc.end();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new NextResponse(buffer as any, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200'
        },
    });
}
