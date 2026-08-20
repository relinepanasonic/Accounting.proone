import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: d1 } = await supabase.from('journal_entries').select('*').limit(1);
  const { data: d2, error } = await supabase.from('journal_entry_lines').select('*').limit(1);
  console.log('JE:', d1 ? Object.keys(d1[0] || {}) : 'None');
  console.log('JE Lines Error:', error);
}
run();
