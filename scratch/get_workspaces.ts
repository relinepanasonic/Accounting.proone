import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
async function main() {
  const { data, error } = await supabase.from('workspaces').select('id, name');
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
main();
