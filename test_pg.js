const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', 'postgres://postgres:').replace('.supabase.co', ':6543/postgres'),
  });
  
  // Actually wait, process.env.DATABASE_URL is best. Let's see if we have it in .env.local
  console.log(process.env.DATABASE_URL ? 'Has DB URL' : 'No DB URL');
}
run();
