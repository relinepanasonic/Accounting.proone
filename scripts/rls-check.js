// RLS check: signs in as a real user and counts rows in every finance table through the public API (RLS applies).
//
//   node scripts/rls-check.js <email> <password> <expect: none|finance>
//
// none    -> client / advertiser: EVERY finance table must return 0 rows (exit 1 otherwise)
// finance -> accounting / admin / superadmin: tables must be readable (counts are printed; exit 1 if all are 0)
//
// Also checks the logged-out (anon) view: it must see 0 rows everywhere, including invoices.
// Create the test users yourself (Team & Roles invite, then assign the role); this script never creates accounts.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const TABLES = [
  'invoices', 'invoice_line_items', 'quotations', 'quotation_line_items', 'transactions',
  'journal_entries', 'journal_entry_lines', 'payroll', 'fixed_assets', 'workspace_bank_accounts',
  'bank_statement_lines', 'products', 'crm_deals', 'global_chart_of_accounts',
  'workspace_ledger_mappings', 'admin_shopee_reports', 'clients',
];

async function count(db, t) {
  const { count: c, error } = await db.from(t).select('*', { count: 'exact', head: true });
  // Missing table (PGRST205) is not a leak.
  if (error) return error.code === 'PGRST205' ? 0 : `ERR ${error.code}`;
  return c;
}

(async () => {
  const [email, password, expect] = process.argv.slice(2);
  if (!email || !password || !['none', 'finance'].includes(expect)) {
    console.error('usage: node scripts/rls-check.js <email> <password> <none|finance>');
    process.exit(2);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let failed = false;

  const anon = createClient(url, key);
  for (const t of TABLES) {
    const c = await count(anon, t);
    if (c !== 0 && !String(c).startsWith('ERR')) { console.log(`LEAK anon  ${t}: ${c}`); failed = true; }
  }

  const user = createClient(url, key);
  const { error } = await user.auth.signInWithPassword({ email, password });
  if (error) { console.error('login failed:', error.message); process.exit(2); }

  let total = 0;
  for (const t of TABLES) {
    const c = await count(user, t);
    const n = typeof c === 'number' ? c : 0;
    total += n;
    console.log(`${t.padEnd(26)} ${c}`);
    // clients is readable by design for a client/advertiser, but only their assigned ones.
    if (expect === 'none' && n > 0 && t !== 'clients') { console.log(`  ^ LEAK for role expected to have no finance access`); failed = true; }
  }
  if (expect === 'finance' && total === 0) { console.log('finance role sees nothing: check its membership'); failed = true; }

  console.log(failed ? 'FAIL' : 'PASS');
  process.exit(failed ? 1 : 0);
})();
