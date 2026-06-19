import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { formatMoney } from '@/lib/utils/format';
import { toNumber } from '@/lib/utils/decimal';
import { tafqeet } from '@/lib/tafqeet';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateInvoicePdfBuffer(invoice: any): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const fontPath = path.join(process.cwd(), 'public', 'Amiri-Regular.ttf');
        if (!fs.existsSync(fontPath)) {
            return reject(new Error(`Invoice PDF font missing: ${fontPath}`));
        }

        const logoPath = path.join(process.cwd(), 'public', 'stash-logo.png');
        const hasLogo = fs.existsSync(logoPath);

        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
            font: fontPath
        });
        doc.registerFont('ArabicFont', fontPath);
        doc.font('ArabicFont');

        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        let titleX = 50;
        if (hasLogo) {
            doc.image(logoPath, 50, 45, { width: 80 });
            titleX = 140;
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
        doc.font('ArabicFont');
        doc.text('Item / الصنف', 50, tableTop);
        doc.text('Quantity', 280, tableTop, { width: 90, align: 'right' });
        doc.text('Unit Price', 370, tableTop, { width: 90, align: 'right' });
        doc.text('Total', 0, tableTop, { align: 'right' });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let i = 0;
        doc.font('ArabicFont');
        for (const item of invoice.items) {
            const y = tableTop + 30 + (i * 30);
            doc.text(item.product.name, 50, y);
            doc.text(item.quantity.toString(), 280, y, { width: 90, align: 'right' });
            doc.text(formatMoney(toNumber(item.unitPrice)), 370, y, { width: 90, align: 'right' });
            doc.text(formatMoney(toNumber(item.subtotal)), 0, y, { align: 'right' });
            i++;
        }

        doc.moveTo(50, tableTop + 30 + (i * 30)).lineTo(550, tableTop + 30 + (i * 30)).stroke();

        const subtotalPosition = tableTop + 30 + (i * 30) + 15;
        doc.font('ArabicFont');
        doc.text('Grand Total / الاجمالي:', 350, subtotalPosition, { width: 90, align: 'right' });
        doc.text(formatMoney(toNumber(invoice.totalAmount)), 0, subtotalPosition, { align: 'right' });

        // Arabic amount in words (Tafqeet)
        const totalAmount = toNumber(invoice.totalAmount);
        const integerPart = Math.floor(totalAmount);
        const decimalPart = Math.round((totalAmount - integerPart) * 100);
        const arabicAmount = tafqeet(integerPart) + (decimalPart > 0 ? ` و${tafqeet(decimalPart)} قرشاً` : '');
        doc.font('ArabicFont').fontSize(10).fillColor('#666666')
            .text(`${arabicAmount} جنيه مصري فقط لا غير`, 50, subtotalPosition + 20, { align: 'center' });

        doc.end();
    });
}
