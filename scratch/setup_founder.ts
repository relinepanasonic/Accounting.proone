process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function setupFounder() {
  // 1. Alter profiles table to add system_role
  const { error: sqlError } = await supabase.rpc('run_sql', {
      query: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS system_role text DEFAULT 'user';`
  });
  // We don't have run_sql RPC, so we will use another way if it fails.
  
  // Actually, we can just use the supabase API to upsert if the column exists. If not, we have to create a migration.
}
setupFounder();
