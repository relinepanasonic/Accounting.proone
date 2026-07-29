process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateUser() {
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }
  
  // They logged in with professortokoonline@gmail.com 
  let user = usersData.users.find(u => u.email === 'professortokoonline@gmail.com');
  
  if (!user && usersData.users.length > 0) {
      console.log('Could not find user by old email, checking new email...');
      user = usersData.users.find(u => u.email === 'nicojapar@gmail.com');
  }
  
  if (!user) {
    console.log(`No users found.`);
    return;
  }
  
  console.log(`Found user ${user.id}. Updating...`);
  
  // 2. Update auth.users password and email
  const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: 'Nolan1717', email: 'nicojapar@gmail.com' }
  );
  
  if (updateError) {
    console.error('Error updating user auth details:', updateError);
    return;
  }
  
  console.log('Successfully updated auth credentials to nicojapar@gmail.com.');

  // 3. Upsert into profiles
  const { error: profileError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: 'nicojapar@gmail.com',
      username: 'japar',
      full_name: 'Japar'
  });

  if (profileError) {
      console.error('Error upserting profile:', profileError);
  } else {
      console.log('Successfully upserted profile for user.');
  }
}

updateUser();
