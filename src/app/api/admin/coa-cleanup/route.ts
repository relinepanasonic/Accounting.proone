import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/api/supabase-admin';

export async function GET() {
  const supabase = createAdminClient();

  const statements = [
    // 1201: rename "Office Equipment" → "Equipment"
    `UPDATE global_chart_of_accounts SET account_name = 'Equipment', description = 'Fixed assets: office equipment, machinery, tools and appliances (e.g. fridges, computers, printers)', updated_at = NOW() WHERE account_code = '1201'`,
    // 1500: distinguish from Equipment → "Property & Vehicles"
    `UPDATE global_chart_of_accounts SET account_name = 'Property & Vehicles', description = 'Long-term assets: property, land and company vehicles', updated_at = NOW() WHERE account_code = '1500'`,
    // 1200: make A/R clearer
    `UPDATE global_chart_of_accounts SET account_name = 'Accounts Receivable (A/R)', updated_at = NOW() WHERE account_code = '1200'`,
    // 6100: distinguish "Bank Fees" from other expense codes
    `UPDATE global_chart_of_accounts SET account_name = 'Bank Charges & Fees', updated_at = NOW() WHERE account_code = '6100'`,
    // 1202: ensure Accumulated Depreciation is clearly named
    `UPDATE global_chart_of_accounts SET account_name = 'Accumulated Depreciation', description = 'Contra-asset: total accumulated depreciation charged against fixed assets', updated_at = NOW() WHERE account_code = '1202'`,
    // Remove duplicate depreciation expense entries (keep 6900)
    `DELETE FROM global_chart_of_accounts WHERE account_name ILIKE '%Depreciation Expense%' AND account_code != '6900'`,
    // Remove exact duplicate account names (keep lowest code)
    `DELETE FROM global_chart_of_accounts a WHERE a.id NOT IN (SELECT DISTINCT ON (LOWER(account_name)) id FROM global_chart_of_accounts ORDER BY LOWER(account_name), account_code ASC)`,
  ];

  const results: any[] = [];

  for (const sql of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => ({ error: null }));
    // Supabase doesn't expose raw SQL directly; use from() for each update instead
    results.push({ sql: sql.substring(0, 80), status: error ? `ERROR: ${error.message}` : 'ok' });
  }

  // Fallback: do each update individually using supabase-js
  const updates = [
    { code: '1201', name: 'Equipment', desc: 'Fixed assets: office equipment, machinery, tools and appliances (e.g. fridges, computers, printers)' },
    { code: '1200', name: 'Accounts Receivable (A/R)', desc: 'Money owed by customers for goods/services provided' },
    { code: '1202', name: 'Accumulated Depreciation', desc: 'Contra-asset: total accumulated depreciation charged against fixed assets' },
    { code: '1500', name: 'Property & Vehicles', desc: 'Long-term assets: property, land and company vehicles' },
    { code: '6100', name: 'Bank Charges & Fees', desc: 'Fees charged by financial institutions' },
    { code: '6900', name: 'Depreciation Expense', desc: 'Allocated cost of tangible assets over their useful life' },
  ];

  const updateResults: any[] = [];
  for (const u of updates) {
    const { error } = await supabase
      .from('global_chart_of_accounts')
      .update({ account_name: u.name, description: u.desc, updated_at: new Date().toISOString() })
      .eq('account_code', u.code);
    updateResults.push({ code: u.code, name: u.name, status: error ? `ERROR: ${error.message}` : '✅ updated' });
  }

  // Find & delete exact duplicate account names (keep lowest code)
  const { data: allAccounts } = await supabase
    .from('global_chart_of_accounts')
    .select('id, account_code, account_name')
    .order('account_code', { ascending: true });

  const seen = new Map<string, string>(); // name → id to keep
  const toDelete: string[] = [];

  if (allAccounts) {
    for (const acc of allAccounts) {
      const key = acc.account_name.trim().toLowerCase();
      if (seen.has(key)) {
        toDelete.push(acc.id); // Delete the later (higher code) duplicate
      } else {
        seen.set(key, acc.id);
      }
    }
  }

  let deleteResult = `No duplicates found`;
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from('global_chart_of_accounts')
      .delete()
      .in('id', toDelete);
    deleteResult = delErr ? `ERROR: ${delErr.message}` : `✅ Deleted ${toDelete.length} duplicates`;
  }

  return NextResponse.json({
    success: true,
    updates: updateResults,
    deduplication: deleteResult,
  });
}
