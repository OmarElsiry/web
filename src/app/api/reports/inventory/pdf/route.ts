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
            // Load Arabic font
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

            // Header Title
            doc.fillColor('#1A365D')
               .fontSize(22)
               .text('Inventory Status Report', { align: 'center' })
               .fontSize(10)
               .fillColor('#4A5568')
               .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' })
               .moveDown(2);

            // Table Headers
            const tableTop = 150;
            const colProduct = 50;
            const colSKU = 190;
            const colCategory = 330;
            const colUnit = 440;
            const colQty = 490;

            doc.fontSize(11).fillColor('#2D3748');
            doc.text('Product Name / الصنف', colProduct, tableTop, { width: 135, height: 15, lineBreak: false });
            doc.text('SKU', colSKU, tableTop, { width: 135, height: 15, lineBreak: false });
            doc.text('Category', colCategory, tableTop, { width: 100, height: 15, lineBreak: false });
            doc.text('Unit', colUnit, tableTop, { width: 45, height: 15, lineBreak: false });
            doc.text('Total Qty', colQty, tableTop, { align: 'right', width: 60 });

            // Draw separator line
            doc.moveTo(50, tableTop + 18).lineTo(550, tableTop + 18).strokeColor('#CBD5E0').lineWidth(1).stroke();

            let y = tableTop + 25;
            let totalInventoryCount = 0;

            doc.fontSize(10).fillColor('#2D3748');

            for (const product of products) {
                // Check page overflow
                if (y > 700) {
                    doc.addPage();
                    if (hasArabicFont) doc.font('ArabicFont');
                    y = 50;
                }

                const totalStock = product.inventoryItems.reduce((acc, curr) => acc + curr.quantity, 0);
                totalInventoryCount += totalStock;

                // Print Product Details
                doc.text(product.name, colProduct, y, { width: 135, height: 15, lineBreak: false });
                doc.text(product.sku, colSKU, y, { width: 135, height: 15, lineBreak: false });
                doc.text(product.category?.name || 'Uncategorized', colCategory, y, { width: 100, height: 15, lineBreak: false });
                doc.text(product.unit, colUnit, y, { width: 45, height: 15, lineBreak: false });
                doc.text(totalStock.toString(), colQty, y, { align: 'right', width: 60 });

                y += 22;

                // Print breakdown per location if multiple locations exist
                if (product.inventoryItems.length > 1) {
                    for (const item of product.inventoryItems) {
                        if (y > 700) {
                            doc.addPage();
                            if (hasArabicFont) doc.font('ArabicFont');
                            y = 50;
                        }
                        doc.fillColor('#718096').fontSize(9);
                        doc.text(`  • ${item.location.name}: ${item.quantity}`, colProduct + 10, y);
                        y += 15;
                    }
                    doc.fillColor('#2D3748').fontSize(10); // Restore defaults
                    y += 5; // Add extra padding
                }
            }

            // Draw bottom separator
            doc.moveTo(50, y + 5).lineTo(550, y + 5).strokeColor('#CBD5E0').stroke();

            // Summary section
            y += 15;
            doc.fontSize(12).fillColor('#1A365D');
            doc.text(`Total Unique Items: ${products.length}`, colProduct, y);
            doc.text(`Total Stock Count: ${totalInventoryCount}`, colQty - 100, y, { align: 'right', width: 160 });

            doc.end();
        });

        return new NextResponse(buffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="inventory-report-${new Date().toISOString().split('T')[0]}.pdf"`,
                'Cache-Control': 'no-store, max-age=0'
            },
        });

    } catch (error: any) {
        console.error('PDF Generation failed:', error);
        return NextResponse.json({ error: 'Failed to generate PDF: ' + error.message }, { status: 500 });
    }
}
