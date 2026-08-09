import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { error } = await supabase.rpc('add_company_legal_name');
  if (error) console.error('Error (might not have rpc):', error);
  // Actually let's just use SQL query since service role is not enough to run arbitrary SQL through JS usually unless we use postgres connection
}
main();
