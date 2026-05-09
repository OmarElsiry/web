import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://utlehmpumyeffgfrexez.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0bGVobXB1bXllZmZnZnJleGV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTgxNjQ5MSwiZXhwIjoyMDg1MzkyNDkxfQ.UCKxeVp7DMhCoZeseF6QzvhDPmK2S6HNxrKt2-j1hyc';
const DATABASE_URL = 'postgresql://postgres.utlehmpumyeffgfrexez:Omar010%40%23%25%23@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('🔍 Listing all Supabase users...');
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('Error listing users:', error);
    return;
  }

  const targetEmail = 'OmarElsiry010@gmail.com';
  const user = users.find(u => u.email.toLowerCase() === targetEmail.toLowerCase());

  if (!user) {
    console.error(`❌ User ${targetEmail} not found in Supabase Auth.`);
    console.log('Existing users:', users.map(u => u.email));
    return;
  }

  const authUserId = user.id;
  console.log(`✅ Found user: ${targetEmail} (ID: ${authUserId})`);

  console.log('📝 Syncing with Prisma User table...');
  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const permissions = ['dashboard', 'sales', 'invoices', 'inventory', 'customers', 'suppliers', 'expenses', 'reports', 'staff', 'settings'];

  const existing = await client.query('SELECT id FROM "User" WHERE id = $1', [authUserId]);
  
  if (existing.rows.length > 0) {
    console.log('User exists in DB, updating permissions...');
    await client.query(
      `UPDATE "User" SET role = 'ROOT', permissions = $1, "updatedAt" = NOW() WHERE id = $2`,
      [permissions, authUserId]
    );
  } else {
    console.log('Inserting new user into DB...');
    await client.query(
      `INSERT INTO "User" (id, username, password, role, name, permissions, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ROOT', $4, $5, NOW(), NOW())`,
      [authUserId, 'omar', 'supabase-auth', 'Omar Elsiry', `{${permissions.join(',')}}`]
    );
  }

  console.log('✅ Success!');
  await client.end();
}

main().catch(console.error);
