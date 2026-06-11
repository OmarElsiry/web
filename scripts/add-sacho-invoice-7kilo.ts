import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import getPrisma from '../src/lib/prisma';

const prisma = getPrisma();

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧾 Adding Sacho Invoice: 7 kilo بن ساده وسط × 550');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Find or create customer ساكو
  let customer = await prisma.customer.findFirst({
    where: { name: 'ساكو' },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: 'ساكو',
        phone: '+201030766947',
        address: 'امام مطعم الكيلاني - المركزيه',
      },
    });
    console.log('   👤 Created customer: ساكو');
  } else {
    console.log(`   👤 Found customer: ساكو (id: ${customer.id})`);
  }

  // 2. Find product بن ساده وسط in category بن تركي زون
  const category = await prisma.category.findUnique({
    where: { name: 'بن تركي زون' },
  });

  if (!category) {
    console.error('   ❌ Category "بن تركي زون" not found!');
    process.exit(1);
  }

  const product = await prisma.product.findFirst({
    where: { name: 'ساده وسط', categoryId: category.id },
  });

  if (!product) {
    console.error('   ❌ Product "ساده وسط" not found!');
    process.exit(1);
  }

  console.log(`   ☕ Found product: ${product.name} (id: ${product.id})`);

  // 3. Find location
  const location = await prisma.location.findFirst();
  if (!location) {
    console.error('   ❌ No location found!');
    process.exit(1);
  }

  // 4. Check inventory
  const inv = await prisma.inventory.findFirst({
    where: { productId: product.id, locationId: location.id },
  });

  const available = inv ? Number(inv.quantity) : 0;
  const orderQty = 7;
  const unitPrice = 550;
  const totalAmount = orderQty * unitPrice; // 3,850

  console.log(`   📦 Available inventory: ${available} كيلوا`);
  console.log(`   🛒 Order: ${orderQty} كيلوا × ${unitPrice} = ${totalAmount} ج.م`);

  if (available < orderQty) {
    console.log(`   ⚠️  WARNING: Only ${available} كيلوا available, need ${orderQty}. Proceeding anyway...`);
  }

  // 5. Create invoice + deduct inventory in a transaction
  await prisma.$transaction(async (tx) => {
    // Deduct inventory
    if (inv) {
      await tx.inventory.update({
        where: { id: inv.id },
        data: { quantity: { decrement: orderQty } },
      });
      console.log(`   📦 Inventory decremented by ${orderQty} → ${available - orderQty} كيلوا remaining`);
    }

    // Create invoice
    const invoice = await tx.invoice.create({
      data: {
        totalAmount,
        paymentMethod: 'CASH',
        customerName: 'ساكو',
        customerPhone: '+201030766947',
        customerAddress: 'امام مطعم الكيلاني - المركزيه',
        customerId: customer!.id,
        previousBalance: Number(customer!.balance),
        amountPaid: totalAmount,
        currentBalance: Number(customer!.balance),
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

    // Create SALE transaction for audit trail
    await tx.transaction.create({
      data: {
        type: 'SALE',
        fromLocationId: location.id,
        notes: `بيع ${orderQty} كيلوا بن ساده وسط لساكو`,
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

    console.log('\n   ═══════════════════════════════════════════');
    console.log(`   ✅ Invoice created: #${invoice.id}`);
    console.log(`      العميل: ساكو`);
    console.log(`      الأصناف: ${orderQty} كيلوا بن ساده وسط × ${unitPrice} = ${totalAmount} ج.م`);
    console.log(`      الدفع: كاش`);
    console.log('   ═══════════════════════════════════════════\n');
  });

  console.log('✅ Done!\n');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
