import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: cols } = await supabase.rpc('query_db', { query: "SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('journal_entries', 'journal_entry_lines')" });
  console.log(cols);
}
run();
