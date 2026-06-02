import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import getPrisma from '../src/lib/prisma';

dotenv.config({ path: '.env.local' });

const prisma = getPrisma();

// Helper to download Amiri font if it doesn't exist
async function ensureFontExists(fontPath: string) {
  if (fs.existsSync(fontPath)) return true;

  console.log('Amiri font is missing. Downloading from Google Fonts to ensure Arabic text renders correctly...');
  const fontUrl = 'https://github.com/google/fonts/raw/main/ofl/amiri/Amiri-Regular.ttf';
  try {
    const response = await fetch(fontUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Ensure public folder exists
    const dir = path.dirname(fontPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fontPath, buffer);
    console.log('Successfully downloaded Amiri-Regular.ttf to', fontPath);
    return true;
  } catch (error: any) {
    console.error('Failed to download Arabic font. PDF will use Helvetica (Arabic letters may not render):', error.message);
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
    console.error('\n[DATABASE CONNECTION ERROR]');
    console.error(dbError.message);
    console.error('\nYour Supabase/PostgreSQL database seems to be unreachable.');
    console.error('If you are using Supabase, please verify that your project is NOT paused.');
    console.error('You can check the status at https://supabase.com/dashboard');
    console.error('Ensure that the DATABASE_URL in .env.local is correct.');
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log('No products found in the database.');
    process.exit(0);
  }

  console.log(`Fetched ${products.length} products. Generating PDF...`);

  // Setup PDF Document
  const doc = new PDFDocument({ margin: 50 });
  const outputPath = path.join(process.cwd(), 'inventory-report.pdf');
  const writeStream = fs.createWriteStream(outputPath);
  
  doc.pipe(writeStream);

  if (hasArabicFont) {
    doc.registerFont('ArabicFont', fontPath);
    doc.font('ArabicFont');
  }

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

    // Optional: Print breakdown per location if multiple locations exist
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

  await new Promise((resolve) => writeStream.on('finish', resolve));
  console.log(`\nPDF Report successfully generated: ${outputPath}`);
}

main()
  .catch((err) => {
    console.error('Unhandled error in script:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
