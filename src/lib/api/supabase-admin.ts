import { createClient } from '@supabase/supabase-js';

// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase URL or Service Role Key in environment variables.');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  );
}

/**
 * Helper to fetch the specific Newwave workspace ID dynamically based on its slug.
 * Ensures we only query data for this specific tenant.
 */
export async function getNewwaveWorkspaceId(supabaseAdmin: any): Promise<string> {
  // Query by name using ILIKE to catch variations like "New Wave Live Specialist"
  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('id')
    .ilike('name', '%New Wave%')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Could not find Newwave workspace in database.');
  }

  return data.id;
}
