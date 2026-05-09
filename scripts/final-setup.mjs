import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://utlehmpumyeffgfrexez.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0bGVobXB1bXllZmZnZnJleGV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTgxNjQ5MSwiZXhwIjoyMDg1MzkyNDkxfQ.UCKxeVp7DMhCoZeseF6QzvhDPmK2S6HNxrKt2-j1hyc';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('📝 Creating user OmarElsiry010@gmail.com...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'OmarElsiry010@gmail.com',
    password: 'Omar010@',
    email_confirm: true
  });
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log('✅ User created successfully in Auth!');
  console.log('ID:', data.user.id);
  
  // Now sync with DB
  console.log('📝 Syncing with DB...');
  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString: 'postgresql://postgres.utlehmpumyeffgfrexez:Omar010%40%23%25%23@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
  await client.connect();
  
  const permissions = ['dashboard', 'sales', 'invoices', 'inventory', 'customers', 'suppliers', 'expenses', 'reports', 'staff', 'settings'];
  
  await client.query(
    `INSERT INTO "User" (id, username, password, role, name, permissions, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'ROOT', $4, $5, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET role = 'ROOT', permissions = $5`,
    [data.user.id, 'omar', 'supabase-auth', 'Omar Elsiry', `{${permissions.join(',')}}`]
  );
  
  console.log('✅ Sync complete!');
  await client.end();
}

main().catch(console.error);
