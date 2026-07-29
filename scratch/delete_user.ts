process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteUserByEmail(email: string) {
  // Get users
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }
  
  const user = usersData.users.find(u => u.email === email);
  
  if (!user) {
    console.log(`User with email ${email} not found.`);
    return;
  }
  
  console.log(`Found user ${user.id}. Deleting...`);
  
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  
  if (deleteError) {
    console.error('Error deleting user:', deleteError);
  } else {
    console.log('User successfully deleted!');
  }
}

deleteUserByEmail('lucyana.suryaputra@gmail.com');
