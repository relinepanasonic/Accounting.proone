'use server';

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
      .eq('username', identifier)
      .single();
      
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
export async function signUpAction(formData: FormData): Promise<AuthActionResult> {
  const email = (formData.get('email') || '').toString().trim();
  const username = (formData.get('username') || '').toString().trim();
  const fullName = (formData.get('fullName') || '').toString().trim();
  const password = (formData.get('password') || '').toString();

  if (!email || !username || !fullName || !password) {
    return { success: false, error: 'Please fill out all fields.' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if username is taken
  const { data: existingProfile } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single();

  if (existingProfile) {
    return { success: false, error: 'That username is already taken. Please choose another.' };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    return { success: false, error: authError.message };
  }

  // Supabase anti-enumeration: if email exists, it returns a fake user with no identities
  if (authData.user && (!authData.user.identities || authData.user.identities.length === 0)) {
    return { success: false, error: 'An account with this email address already exists.' };
  }

  if (authData.user) {
    // Insert into profiles
    const { error: profileError } = await adminSupabase.from('profiles').insert({
      id: authData.user.id,
      email,
      username,
      full_name: fullName,
    });

    if (profileError) {
      return { success: false, error: 'Account created, but profile setup failed: ' + profileError.message };
    }
  }

  // Next.js redirect doesn't work inside try/catch if you catch the NEXT_REDIRECT error, but we're not catching here.
  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Server Action: Sign out active session
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
