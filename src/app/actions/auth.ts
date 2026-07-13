'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface AuthActionResult {
  success: boolean;
  error?: string;
}

/**
 * Server Action: Sign in user with email and password
 */
export async function signInWithEmail(formData: FormData): Promise<AuthActionResult> {
  const email = (formData.get('email') || '').toString().trim();
  const password = (formData.get('password') || '').toString();

  if (!email || !password) {
    return {
      success: false,
      error: 'Please enter both your email address and password.',
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
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
 * Server Action: Sign out active session
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
