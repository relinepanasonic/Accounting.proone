process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDb() {
  const { data: users } = await supabase.auth.admin.listUsers();
  console.log("ALL USERS IN AUTH:", users.users.map(u => ({ id: u.id, email: u.email })));

  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log("ALL PROFILES:", profiles);

  const { data: members } = await supabase.from('workspace_members').select('*');
  console.log("ALL WORKSPACE MEMBERS:", members);
}
checkDb();
