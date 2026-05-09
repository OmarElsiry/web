import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://utlehmpumyeffgfrexez.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0bGVobXB1bXllZmZnZnJleGV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTgxNjQ5MSwiZXhwIjoyMDg1MzkyNDkxfQ.UCKxeVp7DMhCoZeseF6QzvhDPmK2S6HNxrKt2-j1hyc';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('📝 Attempting to create user...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'OmarElsiry010@gmail.com',
    password: 'Omar010@',
    email_confirm: true
  });
  
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('✅ User created:', data.user.id);
  }
}

main().catch(console.error);
