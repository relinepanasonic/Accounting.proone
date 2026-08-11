const fs = require('fs');
const { Client } = require('pg');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
});

async function run() {
  const connectionString = env.POSTGRES_URL;
  if (!connectionString) {
    console.error('No POSTGRES_URL found in .env.local');
    return;
  }
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();
  console.log('Connected to DB');
  
  try {
    await client.query(`
      ALTER TABLE workspace_bank_accounts 
      ADD COLUMN IF NOT EXISTS coa_account_code VARCHAR(50);
    `);
    console.log('Added coa_account_code to workspace_bank_accounts');
  } catch (err) {
    console.error('Error altering table:', err);
  }
  
  await client.end();
}
run();
