import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
    console.error('❌ Missing environment variables.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  
  console.log('📝 Creating user OmarElsiry010@gmail.com...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'OmarElsiry010@gmail.com',
    password: 'Omar010@',
    email_confirm: true
  });
  
  if (error) {
    console.error('Error:', error.message);
    if (error.message !== 'A user with this email address has already been registered') {
        process.exit(1);
    }
    // Continue if already registered
  }
  
  const authUserId = data?.user?.id || (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === 'OmarElsiry010@gmail.com')?.id;
  
  if (!authUserId) {
    console.error('❌ Could not find or create user.');
    process.exit(1);
  }

  console.log('✅ User ID:', authUserId);
  
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  
  const permissions = ['dashboard', 'sales', 'invoices', 'inventory', 'customers', 'suppliers', 'expenses', 'reports', 'staff', 'settings'];
  
  await client.query(
    `INSERT INTO "User" (id, username, password, role, name, permissions, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'ROOT', $4, $5, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET role = 'ROOT', permissions = $5`,
    [authUserId, 'omar', 'supabase-auth', 'Omar Elsiry', `{${permissions.join(',')}}`]
  );
  
  console.log('✅ Sync complete!');
  await client.end();
}

main().catch(console.error);
