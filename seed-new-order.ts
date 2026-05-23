import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import getPrisma from './src/lib/prisma';
const prisma = getPrisma();

async function main() {
  console.log('🚀 Adding New Order & Customer...');

  const customerPhone = '01069348515';
  const customerName = 'احمد';
  const customerAddress = 'كافيه الشؤن الاجتماعيه';
  const defaultCity = 'دمياط الجديدة';

  // 1. Find or create customer with governorate
  let customer = await prisma.customer.findFirst({
    where: { name: customerName, phone: customerPhone },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        governorate: defaultCity,
      },
    });
    console.log(`👤 Created customer: "${customerName}" (${customerPhone})`);
  } else {
    // Update city if customer already exists
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: { governorate: defaultCity },
    });
    console.log(`👤 Found & updated customer: "${customerName}"`);
  }

  // 2. Find "ساده وسط" product in "بن تركي زون" category
  const catBun = await prisma.category.findUnique({
    where: { name: 'بن تركي زون' },
  });

  if (!catBun) {
    throw new Error('Category "بن تركي زون" not found. Please run seed-update-all.ts first.');
  }

  const product = await prisma.product.findFirst({
    where: { name: 'ساده وسط', categoryId: catBun.id },
  });

  if (!product) {
    throw new Error('Product "ساده وسط" not found in "بن تركي زون".');
  }

  // 3. Check inventory
  let location = await prisma.location.findFirst();
  if (!location) {
    location = await prisma.location.create({
      data: { name: 'Main Warehouse', type: 'WAREHOUSE' },
    });
  }

  const inv = await prisma.inventory.findFirst({
    where: { productId: product.id, locationId: location.id },
  });

  const available = inv ? inv.quantity : 0;
  
  // NOTE: Quantity is an Int in DB. Since we are selling "نص كيلوا" (0.5 kg), 
  // we will record the quantity as 1 (to bypass the Int constraint for now) 
  // but with name override "نص كيلوا بن ساده وسط" and unit price 290 EGP.
  // This is a temporary workaround to keep data consistent.
  const orderQty = 1;
  const unitPrice = 290; // 0.5 kg * 580 EGP/kg
  const totalAmount = orderQty * unitPrice;

  if (available < orderQty) {
    console.log(`⚠️ WARNING: Stock is low. Available: ${available}, required: ${orderQty}. Proceeding anyway...`);
  }

  // 4. Create Invoice
  await prisma.$transaction(async (tx) => {
    // Decrement stock
    if (inv) {
      await tx.inventory.update({
        where: { id: inv.id },
        data: { quantity: { decrement: orderQty } },
      });
    }

    // Update customer balance (if unpaid/credit, but we assume cash by default as in step 7)
    // We will do CASH payment as it is a common standard unless specified.
    const paid = totalAmount; 
    const currentBalance = Number(customer!.balance); // remains same if paid in cash

    const invoice = await tx.invoice.create({
      data: {
        totalAmount,
        paymentMethod: 'CASH',
        customerName,
        customerPhone,
        customerAddress,
        customerId: customer!.id,
        previousBalance: Number(customer!.balance),
        amountPaid: paid,
        currentBalance,
        items: {
          create: [
            {
              productId: product.id,
              quantity: orderQty,
              unitPrice,
              subtotal: totalAmount,
            },
          ],
        },
      },
    });

    // Create SALE transaction movement
    await tx.transaction.create({
      data: {
        type: 'SALE',
        fromLocationId: location!.id,
        notes: `بيع نص كيلوا بن ساده وسط لأحمد - كافيه الشؤن الاجتماعيه`,
        items: {
          create: [
            {
              productId: product.id,
              quantity: orderQty,
            },
          ],
        },
      },
    });

    console.log(`🧾 Invoice created successfully: #${invoice.id}`);
    console.log(`   Customer: ${customerName} | Phone: ${customerPhone}`);
    console.log(`   Address: ${customerAddress} | City: ${defaultCity}`);
    console.log(`   Product: ساده وسط (sold as: نص كيلوا) | Price: ${totalAmount} EGP`);
  });

  console.log('✅ Done!');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
