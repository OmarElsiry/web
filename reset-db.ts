import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import getPrisma from './src/lib/prisma';

async function main() {
  console.log('Starting database reset...');
  const prisma = getPrisma();

  // Order matters due to foreign keys

  // 1. Delete Logs and Expenses
  await prisma.auditLog.deleteMany();
  await prisma.expense.deleteMany();

  // 2. Delete Refunds
  await prisma.refundItem.deleteMany();
  await prisma.refund.deleteMany();

  // 3. Delete Invoices
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();

  // 4. Delete Transactions
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();

  // 5. Delete Inventory
  await prisma.inventory.deleteMany();

  // 6. Delete Products and Categories
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  // 7. Delete Locations
  await prisma.location.deleteMany();

  // 8. Delete Customers and Suppliers
  await prisma.customer.deleteMany({
    where: { parentId: { not: null } }
  });
  await prisma.customer.deleteMany();
  await prisma.customerGroup.deleteMany();
  await prisma.supplier.deleteMany();

  // 9. Delete non-ROOT users
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      role: {
        not: 'ROOT'
      }
    }
  });

  console.log(`Deleted ${deletedUsers.count} non-ROOT users.`);
  console.log('Database reset successfully! All operational data cleared, and only ROOT users remain.');
}

main()
  .catch(e => {
    console.error('Error during database reset:', e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrisma();
    await prisma.$disconnect();
  });
