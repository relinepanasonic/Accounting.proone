'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // Check if user has a session (set by the /auth/confirm route)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setHasSession(true);
      } else {
        // No session means they came here directly without an invite link
        router.replace('/login');
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.replace('/');
    }, 2000);
  };

  if (!hasSession) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080809] px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#d4af37]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div
          className="rounded-3xl border border-[#d4af37]/30 p-8 space-y-6 text-center"
          style={{
            background: 'linear-gradient(145deg, rgba(20,17,10,0.95) 0%, rgba(10,9,6,0.97) 100%)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(212,175,55,0.15)',
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(212,175,55,0.4)] border border-[#d4af37]/40">
              <Image src="/logo (8).png" alt="Logo" width={64} height={64} className="object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-widest uppercase text-white font-serif">
                Set Your Password
              </h1>
              <p className="text-[10px] font-mono text-[#d4af37] tracking-wider mt-1">
                COMPLETE YOUR ACCOUNT SETUP
              </p>
            </div>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <p className="text-sm font-mono text-emerald-400 uppercase tracking-wider">
                Password set! Redirecting…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {error && (
                <div className="flex items-start gap-2.5 bg-red-950/40 border border-red-800/60 rounded-xl p-3">
                  <ShieldCheck className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs font-mono text-red-300">{error}</p>
                </div>
              )}

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold tracking-widest uppercase text-zinc-300 font-mono">
                  New Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full pl-9 pr-10 py-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none focus:ring-1 focus:ring-[#d4af37]/30 transition-all"
                    placeholder="Min 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold tracking-widest uppercase text-zinc-300 font-mono">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="w-full pl-9 pr-10 py-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none focus:ring-1 focus:ring-[#d4af37]/30 transition-all"
                    placeholder="Repeat your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="gold-btn w-full py-3 rounded-xl font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(212,175,55,0.35)] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {loading ? 'Setting password…' : 'Activate Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
