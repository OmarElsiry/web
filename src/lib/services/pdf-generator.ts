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
            margin: 40,
            size: 'A4',
            font: fontPath
        });
        doc.registerFont('ArabicFont', fontPath);
        doc.font('ArabicFont');

        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Colors
        const COLOR_TEXT = '#111827';
        const COLOR_MUTED = '#6B7280';
        const COLOR_BORDER = '#D1D5DB';
        const COLOR_BG = '#F3F4F6';
        
        const PAGE_WIDTH = 595.28;
        const MARGIN = 40;
        const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
        
        // --- Header Section ---
        let currentY = MARGIN;

        // Company Logo & Name (Left)
        if (hasLogo) {
            doc.image(logoPath, MARGIN, currentY, { width: 60 });
        }
        doc.fillColor(COLOR_TEXT).fontSize(24).text('STASH', hasLogo ? MARGIN + 70 : MARGIN, currentY + 15, { align: 'left' });

        // Title Box (Center)
        doc.lineWidth(2).strokeColor(COLOR_TEXT)
            .roundedRect(PAGE_WIDTH / 2 - 60, currentY + 10, 120, 30, 5).stroke();
        doc.fontSize(16).fillColor(COLOR_TEXT).text('فاتورة مبيعات', PAGE_WIDTH / 2 - 60, currentY + 17, { width: 120, align: 'center' });

        // Meta Table (Right)
        const metaWidth = 160;
        const metaX = PAGE_WIDTH - MARGIN - metaWidth;
        const seqId = invoice.id ? parseInt(invoice.id.slice(-4), 16).toString() : '---';
        const formattedDate = new Date(invoice.date).toLocaleDateString('ar-EG');
        const empName = invoice.user?.name || invoice.user?.username || 'غير معروف';

        doc.lineWidth(1).strokeColor(COLOR_BORDER);
        
        const drawMetaRow = (y: number, label: string, value: string) => {
            doc.rect(metaX, y, 60, 20).fillAndStroke(COLOR_BG, COLOR_BORDER);
            doc.fillColor(COLOR_TEXT).fontSize(10).text(label, metaX, y + 5, { width: 60, align: 'center' });
            
            doc.rect(metaX + 60, y, 100, 20).stroke();
            doc.fillColor(COLOR_TEXT).fontSize(10).text(value, metaX + 60, y + 5, { width: 100, align: 'center' });
        };

        drawMetaRow(currentY, 'الرقم', seqId);
        drawMetaRow(currentY + 20, 'التاريخ', formattedDate);
        drawMetaRow(currentY + 40, 'المندوب', empName);

        currentY += 80;
        
        // Bottom border of header
        doc.lineWidth(2).strokeColor(COLOR_TEXT)
            .moveTo(MARGIN, currentY).lineTo(PAGE_WIDTH - MARGIN, currentY).stroke();
            
        currentY += 20;

        // --- Customer Info Section ---
        doc.roundedRect(MARGIN, currentY, CONTENT_WIDTH, 25, 5).fillAndStroke(COLOR_BG, COLOR_BORDER);
        doc.fillColor(COLOR_TEXT).fontSize(12).text('بيانات العميل', MARGIN + 10, currentY + 6, { width: CONTENT_WIDTH - 20, align: 'right' });
        
        currentY += 25;
        doc.rect(MARGIN, currentY, CONTENT_WIDTH, 50).stroke();
        
        const custName = invoice.customer?.name || invoice.customerName || 'عميل نقدي';
        const custPhone = invoice.customer?.phone || invoice.customerPhone || '---';
        const custAddress = invoice.customer?.address || invoice.customerAddress || '---';
        
        doc.fontSize(10).fillColor(COLOR_TEXT);
        doc.text(custName, MARGIN + CONTENT_WIDTH/2, currentY + 10, { width: CONTENT_WIDTH/2 - 50, align: 'right' });
        doc.fillColor(COLOR_MUTED).text(':اسم العميل', PAGE_WIDTH - MARGIN - 40, currentY + 10, { width: 40, align: 'right' });
        
        doc.fillColor(COLOR_TEXT).text(custPhone, MARGIN, currentY + 10, { width: CONTENT_WIDTH/2 - 50, align: 'right' });
        doc.fillColor(COLOR_MUTED).text(':هاتف', MARGIN + CONTENT_WIDTH/2 - 40, currentY + 10, { width: 40, align: 'right' });
        
        doc.fillColor(COLOR_TEXT).text(custAddress, MARGIN + CONTENT_WIDTH/2, currentY + 30, { width: CONTENT_WIDTH/2 - 50, align: 'right' });
        doc.fillColor(COLOR_MUTED).text(':العنوان', PAGE_WIDTH - MARGIN - 40, currentY + 30, { width: 40, align: 'right' });

        currentY += 70;

        // --- Line Items Table ---
        const tableHeaderY = currentY;
        doc.rect(MARGIN, tableHeaderY, CONTENT_WIDTH, 25).fillAndStroke(COLOR_BG, COLOR_TEXT);
        
        const cols = [
            { width: 80, title: 'القيمة', align: 'center' },
            { width: 70, title: 'السعر', align: 'center' },
            { width: 60, title: 'الكمية', align: 'center' },
            { width: 60, title: 'الوحدة', align: 'center' },
            { width: CONTENT_WIDTH - 300, title: 'اسم الصنف', align: 'right' },
            { width: 30, title: 'م', align: 'center' }
        ];

        let startX = MARGIN;
        doc.fillColor(COLOR_TEXT).fontSize(10);
        
        // Draw Header Titles and vertical lines
        cols.forEach((col) => {
            doc.text(col.title, startX, tableHeaderY + 7, { width: col.width, align: col.align as any });
            doc.moveTo(startX, tableHeaderY).lineTo(startX, tableHeaderY + 25).stroke();
            startX += col.width;
        });
        doc.moveTo(PAGE_WIDTH - MARGIN, tableHeaderY).lineTo(PAGE_WIDTH - MARGIN, tableHeaderY + 25).stroke();
        
        currentY += 25;
        
        // Rows
        const items = invoice.items || [];
        items.forEach((item: any, idx: number) => {
            const rowHeight = 25;
            // Background for even rows
            if (idx % 2 !== 0) {
                doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowHeight).fill(COLOR_BG);
            }
            
            doc.fillColor(COLOR_TEXT).fontSize(10);
            
            let cx = MARGIN;
            
            const subtotal = toNumber(item.subtotal).toFixed(2);
            doc.text(subtotal, cx, currentY + 7, { width: cols[0].width, align: 'center' });
            cx += cols[0].width;
            
            const price = toNumber(item.unitPrice).toFixed(2);
            doc.text(price, cx, currentY + 7, { width: cols[1].width, align: 'center' });
            cx += cols[1].width;
            
            const qty = item.quantity.toString();
            doc.text(qty, cx, currentY + 7, { width: cols[2].width, align: 'center' });
            cx += cols[2].width;
            
            const unit = item.productUnit || 'قطعة';
            doc.text(unit, cx, currentY + 7, { width: cols[3].width, align: 'center' });
            cx += cols[3].width;
            
            const name = item.productName || item.product?.name || '';
            doc.text(name, cx, currentY + 7, { width: cols[4].width, align: 'right' });
            cx += cols[4].width;
            
            const index = (idx + 1).toString();
            doc.text(index, cx, currentY + 7, { width: cols[5].width, align: 'center' });
            
            // Draw row vertical lines
            let lx = MARGIN;
            doc.lineWidth(1).strokeColor(COLOR_BORDER);
            cols.forEach((col) => {
                doc.moveTo(lx, currentY).lineTo(lx, currentY + rowHeight).stroke();
                lx += col.width;
            });
            doc.moveTo(PAGE_WIDTH - MARGIN, currentY).lineTo(PAGE_WIDTH - MARGIN, currentY + rowHeight).stroke();
            
            // Draw row bottom line
            doc.moveTo(MARGIN, currentY + rowHeight).lineTo(PAGE_WIDTH - MARGIN, currentY + rowHeight).stroke();
            
            currentY += rowHeight;
        });

        currentY += 20;

        // --- Footer Totals & Financials ---
        
        // Ensure we don't page break awkwardly. Simplistic check:
        if (currentY > PAGE_WIDTH - 200) {
            doc.addPage();
            currentY = MARGIN;
        }

        // Left side: Totals and Amount in words
        const leftBoxWidth = CONTENT_WIDTH - 220; // 200 for financials + 20 gap
        
        // Total Box
        doc.rect(MARGIN, currentY, leftBoxWidth, 40).fillAndStroke(COLOR_BG, COLOR_BORDER);
        doc.fillColor(COLOR_TEXT).fontSize(14)
            .text('الإجمالي العام', MARGIN + leftBoxWidth - 100, currentY + 12, { width: 90, align: 'right' });
            
        doc.rect(MARGIN + 10, currentY + 8, 100, 24).fillAndStroke('#FFF', COLOR_BORDER);
        const grandTotal = toNumber(invoice.totalAmount).toFixed(2);
        doc.fillColor(COLOR_TEXT).fontSize(14).text(grandTotal, MARGIN + 10, currentY + 12, { width: 100, align: 'center' });
        
        // Amount in words
        const totalAmountNum = toNumber(invoice.totalAmount);
        const arabicAmount = tafqeet(totalAmountNum);
        
        doc.rect(MARGIN, currentY + 60, leftBoxWidth, 40).stroke();
        // Title overlap
        doc.rect(MARGIN + leftBoxWidth - 90, currentY + 52, 80, 16).fill('#FFF');
        doc.fillColor(COLOR_MUTED).fontSize(10).text('المبلغ بالحروف', MARGIN + leftBoxWidth - 90, currentY + 54, { width: 80, align: 'center' });
        
        doc.fillColor(COLOR_TEXT).fontSize(12)
            .text(`فقط وقدره ( ${arabicAmount} ) لا غير.`, MARGIN, currentY + 75, { width: leftBoxWidth, align: 'center' });

        // Right side: Financials
        const rightBoxX = PAGE_WIDTH - MARGIN - 200;
        doc.lineWidth(2).strokeColor(COLOR_TEXT).rect(rightBoxX, currentY, 200, 100).stroke();
        
        doc.rect(rightBoxX, currentY, 200, 20).fill(COLOR_TEXT);
        doc.fillColor('#FFF').fontSize(12).text('كشف الحساب', rightBoxX, currentY + 4, { width: 200, align: 'center' });
        
        doc.lineWidth(1).strokeColor(COLOR_BORDER);
        // Grid lines
        doc.moveTo(rightBoxX, currentY + 40).lineTo(rightBoxX + 200, currentY + 40).stroke();
        doc.moveTo(rightBoxX, currentY + 60).lineTo(rightBoxX + 200, currentY + 60).stroke();
        doc.moveTo(rightBoxX, currentY + 80).lineTo(rightBoxX + 200, currentY + 80).stroke();
        doc.moveTo(rightBoxX + 100, currentY + 20).lineTo(rightBoxX + 100, currentY + 100).stroke();

        const drawFinRow = (y: number, label: string, value: string, bgLabel: string, valColor: string) => {
            doc.rect(rightBoxX + 100, y, 100, 20).fill(bgLabel);
            doc.fillColor(COLOR_TEXT).fontSize(10).text(label, rightBoxX + 100, y + 5, { width: 90, align: 'right' });
            doc.fillColor(valColor).fontSize(10).text(value, rightBoxX, y + 5, { width: 100, align: 'center' });
        };

        const prevBal = Number(invoice.previousBalance || 0).toLocaleString('ar-EG');
        const finTotal = Number(invoice.totalAmount || 0).toLocaleString('ar-EG');
        const amountPaid = Number(invoice.amountPaid || 0).toLocaleString('ar-EG');
        const currBal = Number(invoice.currentBalance || 0).toLocaleString('ar-EG');

        drawFinRow(currentY + 20, 'الرصيد السابق', prevBal, COLOR_BG, COLOR_TEXT);
        drawFinRow(currentY + 40, 'قيمة الفاتورة', finTotal, COLOR_BG, '#1D4ED8'); // Blue
        drawFinRow(currentY + 60, invoice.paymentMethod === 'CREDIT' ? 'المدفوع (آجل)' : 'المدفوع (نقداً)', amountPaid, COLOR_BG, '#15803D'); // Green
        drawFinRow(currentY + 80, 'الرصيد المتبقي', currBal, '#E5E7EB', '#DC2626'); // Red
        
        currentY += 140;

        // --- Signatures ---
        doc.fillColor(COLOR_MUTED).fontSize(12);
        
        // Use dash(5, { space: 5 }) but reset first if needed, though stroke() will consume it
        doc.moveTo(MARGIN + 40, currentY).lineTo(MARGIN + 160, currentY).dash(5, { space: 5 }).strokeColor(COLOR_MUTED).stroke();
        doc.text('توقيع المستلم', MARGIN + 40, currentY + 10, { width: 120, align: 'center' });
        
        doc.moveTo(PAGE_WIDTH - MARGIN - 160, currentY).lineTo(PAGE_WIDTH - MARGIN - 40, currentY).stroke();
        doc.text('توقيع المسئول', PAGE_WIDTH - MARGIN - 160, currentY + 10, { width: 120, align: 'center' });

        doc.end();
    });
}
