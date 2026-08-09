import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const query = \
    ALTER TABLE public.invoices
      ADD COLUMN IF NOT EXISTS tax_calculation_type TEXT DEFAULT 'exclude',
      ADD COLUMN IF NOT EXISTS has_ppn BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS has_pph BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS pph_rate NUMERIC DEFAULT 2,
      ADD COLUMN IF NOT EXISTS pph_amount NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS dpp_amount NUMERIC DEFAULT 0;
  \;
  // Supabase JS doesn't support raw SQL easily unless through rpc
  // But wait, I can just use postgres driver.
}
main();
