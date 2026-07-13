'use client';

import React, { useState, useTransition } from 'react';
import { AlertCircle, Loader2, Lock, Mail, KeyRound, ShieldCheck } from 'lucide-react';
import { ProfessorTokoOnlineLogo } from '@/components/invoices/ProfessorTokoOnlineLogo';
import { signInWithEmail } from '@/app/actions/auth';

export function LoginForm() {
  const [email, setEmail] = useState('professortokoonline@gmail.com');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        const result = await signInWithEmail(formData);
        if (result && !result.success) {
          setErrorMsg(result.error || 'Authentication failed. Please verify your email and password.');
        }
      } catch (err: any) {
        // NEXT_REDIRECT is thrown by redirect('/') upon successful sign-in
        if (err?.message?.includes('NEXT_REDIRECT') || err?.digest?.includes('NEXT_REDIRECT')) {
          return;
        }
        setErrorMsg(err?.message || 'Failed to authenticate.');
      }
    });
  };

  const handleQuickFillDemo = () => {
    setEmail('professortokoonline@gmail.com');
    setPassword('SuperAdmin2026!');
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="gold-glass-panel rounded-3xl p-8 sm:p-10 shadow-[0_0_60px_rgba(212,175,55,0.2)] border border-[#d4af37]/40 relative overflow-hidden">
        {/* Subtle decorative subtle gold glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#d4af37]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#f5d77f]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Crest Header */}
        <div className="flex flex-col items-center text-center mb-8 relative z-10">
          <div className="p-3 rounded-2xl bg-gradient-to-b from-[#18233c] to-[#0b0c10] border border-[#d4af37]/40 shadow-[0_0_20px_rgba(212,175,55,0.3)] mb-4">
            <ProfessorTokoOnlineLogo className="w-14 h-14" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-wider uppercase text-white font-serif">
            PROFESSOR TOKO ONLINE
          </h1>
          <p className="text-[10px] font-mono text-[#f5d77f] tracking-[0.2em] uppercase mt-1">
            EXECUTIVE SAAS ACCOUNTING SUITE • RBAC CLEARANCE
          </p>
        </div>

        {/* Error Alert Box matching Luxury Gold theme */}
        {errorMsg && (
          <div className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/70 text-[#f5d77f] text-xs font-mono shadow-[0_0_20px_rgba(212,175,55,0.25)] relative z-10">
            <AlertCircle className="w-5 h-5 shrink-0 text-[#f5d77f] mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold uppercase tracking-wider">CLEARANCE DENIED</div>
              <div className="text-zinc-300 font-sans">{errorMsg}</div>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
              EXECUTIVE EMAIL ID *
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-[#d4af37]/70" />
              <input
                type="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@professortokoonline.com"
                className="w-full bg-zinc-950/90 border border-zinc-800/90 rounded-xl pl-10 pr-4 py-3 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                SECURITY PASSPHRASE *
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#d4af37]/70" />
              <input
                type="password"
                name="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-zinc-950/90 border border-zinc-800/90 rounded-xl pl-10 pr-4 py-3 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="gold-btn w-full inline-flex items-center justify-center gap-2.5 py-3.5 rounded-full text-xs font-extrabold uppercase tracking-widest disabled:opacity-75 transition-all shadow-[0_0_25px_rgba(212,175,55,0.4)] mt-3"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-black" />
            )}
            <span>{isPending ? 'AUTHENTICATING SESSION...' : 'SECURE SIGN IN'}</span>
          </button>
        </form>

        {/* Quick Demo Assist Strip */}
        <div className="mt-6 pt-5 border-t border-[#d4af37]/20 flex items-center justify-between text-[11px] relative z-10">
          <span className="text-zinc-500 font-mono">SUPABASE JWT TOKEN</span>
          <button
            type="button"
            onClick={handleQuickFillDemo}
            className="text-[#f5d77f] hover:underline font-mono inline-flex items-center gap-1"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Fill Seed Owner</span>
          </button>
        </div>
      </div>
    </div>
  );
}
