import pg from 'pg';
const DATABASE_URL = 'postgresql://postgres.utlehmpumyeffgfrexez:Omar010%40%23%25%23@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'User'
  `);
  console.log('Columns in User table:');
  console.log(res.rows);
  await client.end();
}
main().catch(console.error);
