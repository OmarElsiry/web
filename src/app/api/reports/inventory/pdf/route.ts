import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { createClient } from '@/lib/supabase/server';
import getPrisma from '@/lib/prisma';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

// Define the type for the product data based on Prisma query output
type ProductWithInventory = {
    name: string;
    sku: string;
    costPrice: string | number;
    baseSellingPrice: string | number;
    inventoryItems: {
        quantity: string | number;
        location: { name: string };
    }[];
};

function drawDocumentHeader(doc: typeof PDFDocument, tableTop: number) {
    doc.fillColor('#1A365D')
       .fontSize(22)
       .text('Inventory & Valuation Report', { align: 'center' })
       .fontSize(9)
       .fillColor('#718096')
       .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
       .moveDown(1.5);

    doc.rect(40, tableTop - 5, 515, 22).fill('#F7FAFC');

    doc.fontSize(9).fillColor('#4A5568');
    doc.text('Product Name / الصنف', 40, tableTop, { width: 110, height: 15, lineBreak: false });
    doc.text('SKU', 155, tableTop, { width: 95, height: 15, lineBreak: false });
    doc.text('Cost', 255, tableTop, { align: 'right', width: 55 });
    doc.text('Sell Price', 315, tableTop, { align: 'right', width: 55 });
    doc.text('Stock', 375, tableTop, { align: 'right', width: 45 });
    doc.text('Val (Cost)', 425, tableTop, { align: 'right', width: 65 });
    doc.text('Val (Sell)', 495, tableTop, { align: 'right', width: 60 });

    doc.moveTo(40, tableTop + 18).lineTo(555, tableTop + 18).strokeColor('#E2E8F0').lineWidth(1).stroke();
}

function printSummaryBox(doc: typeof PDFDocument, productsCount: number, grandTotalStock: number, grandTotalCostVal: number, grandTotalSellVal: number, y: number, hasArabicFont: boolean) {
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
    doc.text(`Total Unique Items: ${productsCount}`, 55, summaryY + 20);
    doc.text(`Total Stock Quantity: ${grandTotalStock.toLocaleString()}`, 55, summaryY + 35);
    
    doc.text(`Total Cost Valuation: EGP ${grandTotalCostVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 300, summaryY + 20, { align: 'right', width: 240 });
    doc.text(`Total Retail Valuation: EGP ${grandTotalSellVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 300, summaryY + 35, { align: 'right', width: 240 });
}

function processProductRow(doc: typeof PDFDocument, product: ProductWithInventory, y: number, hasArabicFont: boolean) {
    const totalStock = product.inventoryItems.reduce((acc, curr) => acc + Number(curr.quantity), 0);
    const cost = Number(product.costPrice);
    const sell = Number(product.baseSellingPrice);
    const itemTotalCostVal = totalStock * cost;
    const itemTotalSellVal = totalStock * sell;

    doc.text(product.name, 40, y, { width: 110, height: 14, lineBreak: false });
    doc.text(product.sku, 155, y, { width: 95, height: 14, lineBreak: false });
    doc.text(cost.toFixed(2), 255, y, { align: 'right', width: 55 });
    doc.text(sell.toFixed(2), 315, y, { align: 'right', width: 55 });
    doc.text(totalStock.toString(), 375, y, { align: 'right', width: 45 });
    doc.text(itemTotalCostVal.toFixed(2), 425, y, { align: 'right', width: 65 });
    doc.text(itemTotalSellVal.toFixed(2), 495, y, { align: 'right', width: 60 });

    let currentY = y + 18;

    if (product.inventoryItems.length > 1) {
        for (const item of product.inventoryItems) {
            if (currentY > 750) {
                doc.addPage();
                if (hasArabicFont) doc.font('ArabicFont');
                currentY = 50;
            }
            doc.fillColor('#A0AEC0').fontSize(7.5);
            doc.text(`  • ${item.location.name}: ${item.quantity}`, 48, currentY);
            currentY += 13;
        }
        doc.fillColor('#2D3748').fontSize(8.5);
        currentY += 3;
    }

    return {
        newY: currentY,
        totalStock,
        itemTotalCostVal,
        itemTotalSellVal
    };
}

function generateInventoryPdf(products: ProductWithInventory[]): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const fontPath = path.join(process.cwd(), 'public', 'Amiri-Regular.ttf');
        const hasArabicFont = fs.existsSync(fontPath);
        if (hasArabicFont) {
            doc.registerFont('ArabicFont', fontPath);
            doc.font('ArabicFont');
        }

        const tableTop = 130;
        drawDocumentHeader(doc as any, tableTop);

        let y = tableTop + 25;
        let grandTotalStock = 0;
        let grandTotalCostVal = 0;
        let grandTotalSellVal = 0;

        doc.fontSize(8.5).fillColor('#2D3748');

        for (const product of products) {
            if (y > 750) {
                doc.addPage();
                if (hasArabicFont) doc.font('ArabicFont');
                y = 50;
            }

            const res = processProductRow(doc as any, product, y, hasArabicFont);
            y = res.newY;
            grandTotalStock += res.totalStock;
            grandTotalCostVal += res.itemTotalCostVal;
            grandTotalSellVal += res.itemTotalSellVal;
        }

        doc.moveTo(40, y + 5).lineTo(555, y + 5).strokeColor('#CBD5E0').lineWidth(1.5).stroke();
        
        y += 15;
        printSummaryBox(doc as any, products.length, grandTotalStock, grandTotalCostVal, grandTotalSellVal, y, hasArabicFont);

        doc.fontSize(8).fillColor('#A0AEC0').text('Stash Inventory Management System', 40, 800, { align: 'center' });

        doc.end();
    });
}

export async function GET(_request: NextRequest) {
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
        const buffer = await generateInventoryPdf(products);

        return new NextResponse(buffer as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="inventory-valuation-${new Date().toISOString().split('T')[0]}.pdf"`,
                'Cache-Control': 'no-store, max-age=0'
            },
        });

    } catch (error: unknown) {
        console.error('PDF Generation failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Failed to generate PDF: ' + errorMessage }, { status: 500 });
    }
}
