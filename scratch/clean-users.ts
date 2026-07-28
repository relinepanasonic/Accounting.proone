import { createClient } from '@supabase/supabase-js';

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE env vars');
    return;
  }
  const supabase = createClient(url, key);

  console.log('Fetching users...');
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  for (const u of users.users) {
    if (u.email === 'professortokoonline@gmail.com') {
      console.log('Skipping main user:', u.email);
      continue;
    }
    console.log('Deleting user:', u.email, u.id);
    await supabase.auth.admin.deleteUser(u.id);
    await supabase.from('workspace_members').delete().eq('user_id', u.id);
  }

  // Also clean up any dummy workspace_members that might have a null user_id, 
  // or that don't match the main user email
  const { data: members } = await supabase.from('workspace_members').select('*');
  if (members) {
    for (const m of members) {
      if (m.email !== 'professortokoonline@gmail.com') {
        console.log('Deleting workspace_member:', m.email);
        await supabase.from('workspace_members').delete().eq('id', m.id);
      }
    }
  }

  console.log('Done cleaning up users.');
}

run();
