'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export interface AuthActionResult {
  success: boolean;
  error?: string;
}

/**
 * Server Action: Sign in user with email or username and password
 */
export async function signInAction(formData: FormData): Promise<AuthActionResult> {
  const identifier = (formData.get('identifier') || formData.get('email') || '').toString().trim();
  const password = (formData.get('password') || '').toString();

  if (!identifier || !password) {
    return {
      success: false,
      error: 'Please enter both your email/username and password.',
    };
  }

  const supabase = await createClient();
  let emailToUse = identifier;

  // If the identifier doesn't look like an email (no @ symbol), try to look it up in profiles
  if (!identifier.includes('@')) {
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('email')
      .in('username', [identifier, identifier.toLowerCase()])
      .limit(1)
      .maybeSingle();
      
    if (profile?.email) {
      emailToUse = profile.email;
    } else {
      return { success: false, error: 'Username not found.' };
    }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password,
  });

  if (error) {
    return {
      success: false,
      error: error.message || 'Invalid login credentials. Please try again.',
    };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Server Action: Register a new user
 */
export async function signUpAction(_formData: FormData): Promise<AuthActionResult> {
  // Registration is by invitation only (see /join). This action stays callable from the browser, so it refuses.
  return { success: false, error: 'Registration is by invitation only. Ask your admin for an invitation link.' };
}

/**
 * Server Action: Sign out active session
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete('workspace_chosen');
  revalidatePath('/', 'layout');
  redirect('/login');
}
