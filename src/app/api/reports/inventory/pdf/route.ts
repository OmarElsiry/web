import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { createClient } from '@/lib/supabase/server';
import getPrisma from '@/lib/prisma';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const prisma = getPrisma();

    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Fetch all products with categories and inventory locations
        const products = await prisma.product.findMany({
            include: {
                category: true,
                inventoryItems: {
                    include: {
                        location: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Generate PDF
        const buffer = await new Promise<Buffer>((resolve, reject) => {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const buffers: Buffer[] = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // Load Arabic font
            const fontPath = path.join(process.cwd(), 'public', 'Amiri-Regular.ttf');
            const hasArabicFont = fs.existsSync(fontPath);
            if (hasArabicFont) {
                doc.registerFont('ArabicFont', fontPath);
                doc.font('ArabicFont');
            }

            // Document Header / Title
            doc.fillColor('#1A365D')
               .fontSize(22)
               .text('Inventory & Valuation Report', { align: 'center' })
               .fontSize(9)
               .fillColor('#718096')
               .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
               .moveDown(1.5);

            // Column Definitions (Optimized for A4)
            const colProduct = 40;
            const colSKU = 155;
            const colCost = 255;
            const colSell = 315;
            const colStock = 375;
            const colTotalCost = 425;
            const colTotalSell = 495;

            const tableTop = 130;

            // Draw header background
            doc.rect(40, tableTop - 5, 515, 22).fill('#F7FAFC');

            doc.fontSize(9).fillColor('#4A5568');
            doc.text('Product Name / الصنف', colProduct, tableTop, { width: 110, height: 15, lineBreak: false });
            doc.text('SKU', colSKU, tableTop, { width: 95, height: 15, lineBreak: false });
            doc.text('Cost', colCost, tableTop, { align: 'right', width: 55 });
            doc.text('Sell Price', colSell, tableTop, { align: 'right', width: 55 });
            doc.text('Stock', colStock, tableTop, { align: 'right', width: 45 });
            doc.text('Val (Cost)', colTotalCost, tableTop, { align: 'right', width: 65 });
            doc.text('Val (Sell)', colTotalSell, tableTop, { align: 'right', width: 60 });

            // Draw line below header
            doc.moveTo(40, tableTop + 18).lineTo(555, tableTop + 18).strokeColor('#E2E8F0').lineWidth(1).stroke();

            let y = tableTop + 25;
            let grandTotalStock = 0;
            let grandTotalCostVal = 0;
            let grandTotalSellVal = 0;

            doc.fontSize(8.5).fillColor('#2D3748');

            for (const product of products) {
                // Page overflow boundary
                if (y > 750) {
                    doc.addPage();
                    if (hasArabicFont) doc.font('ArabicFont');
                    y = 50;
                }

                const totalStock = product.inventoryItems.reduce((acc, curr) => acc + curr.quantity, 0);
                const cost = Number(product.costPrice);
                const sell = Number(product.baseSellingPrice);
                const itemTotalCostVal = totalStock * cost;
                const itemTotalSellVal = totalStock * sell;

                grandTotalStock += totalStock;
                grandTotalCostVal += itemTotalCostVal;
                grandTotalSellVal += itemTotalSellVal;

                // Print Product Details with exact width boundaries
                doc.text(product.name, colProduct, y, { width: 110, height: 14, lineBreak: false });
                doc.text(product.sku, colSKU, y, { width: 95, height: 14, lineBreak: false });
                doc.text(cost.toFixed(2), colCost, y, { align: 'right', width: 55 });
                doc.text(sell.toFixed(2), colSell, y, { align: 'right', width: 55 });
                doc.text(totalStock.toString(), colStock, y, { align: 'right', width: 45 });
                doc.text(itemTotalCostVal.toFixed(2), colTotalCost, y, { align: 'right', width: 65 });
                doc.text(itemTotalSellVal.toFixed(2), colTotalSell, y, { align: 'right', width: 60 });

                y += 18;

                // Print breakdown per location if multiple locations exist
                if (product.inventoryItems.length > 1) {
                    for (const item of product.inventoryItems) {
                        if (y > 750) {
                            doc.addPage();
                            if (hasArabicFont) doc.font('ArabicFont');
                            y = 50;
                        }
                        doc.fillColor('#A0AEC0').fontSize(7.5);
                        doc.text(`  • ${item.location.name}: ${item.quantity}`, colProduct + 8, y);
                        y += 13;
                    }
                    doc.fillColor('#2D3748').fontSize(8.5); // Reset defaults
                    y += 3;
                }
            }

            // Draw line above totals
            doc.moveTo(40, y + 5).lineTo(555, y + 5).strokeColor('#CBD5E0').lineWidth(1.5).stroke();

            // Grand Totals Summary Box
            y += 15;
            if (y > 720) {
                doc.addPage();
                if (hasArabicFont) doc.font('ArabicFont');
                y = 50;
            }

            doc.rect(40, y, 515, 65).fill('#EDF2F7');
            doc.fillColor('#1A365D').fontSize(10);
            
            const summaryY = y + 10;
            doc.text('REPORT SUMMARY / ملخص التقرير', 55, summaryY);
            
            doc.fontSize(9).fillColor('#2D3748');
            doc.text(`Total Unique Items: ${products.length}`, 55, summaryY + 20);
            doc.text(`Total Stock Quantity: ${grandTotalStock.toLocaleString()}`, 55, summaryY + 35);
            
            doc.text(`Total Cost Valuation: EGP ${grandTotalCostVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 300, summaryY + 20, { align: 'right', width: 240 });
            doc.text(`Total Retail Valuation: EGP ${grandTotalSellVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 300, summaryY + 35, { align: 'right', width: 240 });

            // Footer info
            doc.fontSize(8).fillColor('#A0AEC0').text('Zone Inventory Management System', 40, 800, { align: 'center' });

            doc.end();
        });

        return new NextResponse(buffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="inventory-valuation-${new Date().toISOString().split('T')[0]}.pdf"`,
                'Cache-Control': 'no-store, max-age=0'
            },
        });

    } catch (error: any) {
        console.error('PDF Generation failed:', error);
        return NextResponse.json({ error: 'Failed to generate PDF: ' + error.message }, { status: 500 });
    }
}
