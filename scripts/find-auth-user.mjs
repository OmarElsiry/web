import pg from 'pg';
const DATABASE_URL = 'postgresql://postgres.utlehmpumyeffgfrexez:Omar010%40%23%25%23@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('🔍 Querying auth.users table directly...');
  try {
    const res = await client.query('SELECT id, email FROM auth.users');
    console.log('Users found in auth.users:');
    console.log(res.rows);
  } catch (err) {
    console.error('Error querying auth.users:', err.message);
  }
  await client.end();
}
main().catch(console.error);
