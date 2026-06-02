import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import getPrisma from '../src/lib/prisma';

dotenv.config({ path: '.env.local' });

const prisma = getPrisma();

async function ensureFontExists(fontPath: string) {
  if (fs.existsSync(fontPath)) return true;

  console.log('Amiri font is missing. Downloading from Google Fonts...');
  const fontUrl = 'https://github.com/google/fonts/raw/main/ofl/amiri/Amiri-Regular.ttf';
  try {
    const response = await fetch(fontUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const dir = path.dirname(fontPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fontPath, buffer);
    console.log('Successfully downloaded Amiri-Regular.ttf');
    return true;
  } catch (error: any) {
    console.error('Failed to download Arabic font:', error.message);
    return false;
  }
}

async function main() {
  const fontPath = path.join(process.cwd(), 'public', 'Amiri-Regular.ttf');
  const hasArabicFont = await ensureFontExists(fontPath);

  console.log('Connecting to database...');
  let products;
  try {
    products = await prisma.product.findMany({
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
  } catch (dbError: any) {
    console.error('[DATABASE CONNECTION ERROR]', dbError.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log('No products found in the database.');
    process.exit(0);
  }

  console.log(`Fetched ${products.length} products. Generating PDF...`);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const outputPath = path.join(process.cwd(), 'inventory-report.pdf');
  const writeStream = fs.createWriteStream(outputPath);
  
  doc.pipe(writeStream);

  if (hasArabicFont) {
    doc.registerFont('ArabicFont', fontPath);
    doc.font('ArabicFont');
  }

  // Title Header
  doc.fillColor('#1A365D')
     .fontSize(22)
     .text('Inventory & Valuation Report', { align: 'center' })
     .fontSize(9)
     .fillColor('#718096')
     .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
     .moveDown(1.5);

  const colProduct = 40;
  const colSKU = 155;
  const colCost = 255;
  const colSell = 315;
  const colStock = 375;
  const colTotalCost = 425;
  const colTotalSell = 495;

  const tableTop = 130;

  doc.rect(40, tableTop - 5, 515, 22).fill('#F7FAFC');

  doc.fontSize(9).fillColor('#4A5568');
  doc.text('Product Name / الصنف', colProduct, tableTop, { width: 110, height: 15, lineBreak: false });
  doc.text('SKU', colSKU, tableTop, { width: 95, height: 15, lineBreak: false });
  doc.text('Cost', colCost, tableTop, { align: 'right', width: 55 });
  doc.text('Sell Price', colSell, tableTop, { align: 'right', width: 55 });
  doc.text('Stock', colStock, tableTop, { align: 'right', width: 45 });
  doc.text('Val (Cost)', colTotalCost, tableTop, { align: 'right', width: 65 });
  doc.text('Val (Sell)', colTotalSell, tableTop, { align: 'right', width: 60 });

  doc.moveTo(40, tableTop + 18).lineTo(555, tableTop + 18).strokeColor('#E2E8F0').lineWidth(1).stroke();

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

    const totalStock = product.inventoryItems.reduce((acc, curr) => acc + curr.quantity, 0);
    const cost = Number(product.costPrice);
    const sell = Number(product.baseSellingPrice);
    const itemTotalCostVal = totalStock * cost;
    const itemTotalSellVal = totalStock * sell;

    grandTotalStock += totalStock;
    grandTotalCostVal += itemTotalCostVal;
    grandTotalSellVal += itemTotalSellVal;

    doc.text(product.name, colProduct, y, { width: 110, height: 14, lineBreak: false });
    doc.text(product.sku, colSKU, y, { width: 95, height: 14, lineBreak: false });
    doc.text(cost.toFixed(2), colCost, y, { align: 'right', width: 55 });
    doc.text(sell.toFixed(2), colSell, y, { align: 'right', width: 55 });
    doc.text(totalStock.toString(), colStock, y, { align: 'right', width: 45 });
    doc.text(itemTotalCostVal.toFixed(2), colTotalCost, y, { align: 'right', width: 65 });
    doc.text(itemTotalSellVal.toFixed(2), colTotalSell, y, { align: 'right', width: 60 });

    y += 18;

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
      doc.fillColor('#2D3748').fontSize(8.5);
      y += 3;
    }
  }

  doc.moveTo(40, y + 5).lineTo(555, y + 5).strokeColor('#CBD5E0').lineWidth(1.5).stroke();

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

  doc.fontSize(8).fillColor('#A0AEC0').text('Stash Inventory Management System', 40, 800, { align: 'center' });

  doc.end();

  await new Promise((resolve) => writeStream.on('finish', resolve));
  console.log(`PDF successfully generated: ${outputPath}`);
}

main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());
