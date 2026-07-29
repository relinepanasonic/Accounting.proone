import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Handles Supabase magic-link / invite callbacks.
 * Supabase redirects here with ?token_hash=...&type=invite
 * We verify the OTP, then send the user to /set-password.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as 'invite' | 'recovery' | 'signup' | null;
  const next = searchParams.get('next') ?? '/set-password';

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });

    if (!error) {
      // Verification succeeded — redirect to set-password so they can choose a password
      const redirectUrl = new URL('/set-password', origin);
      return NextResponse.redirect(redirectUrl);
    }

    console.error('Auth confirm error:', error.message);
  }

  // Something went wrong — redirect to login with error
  const loginUrl = new URL('/login', origin);
  loginUrl.searchParams.set('error', 'invalid_link');
  return NextResponse.redirect(loginUrl);
}
