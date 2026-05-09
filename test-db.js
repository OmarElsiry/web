const { PrismaClient } = require('./src/generated/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config({ path: '.env.local' });

async function test() {
  console.log('Connecting...');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  try {
    const users = await prisma.user.findMany({ take: 1 });
    console.log('Connected! Users:', users.length);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}
test();
