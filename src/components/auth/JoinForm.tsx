'use client';

import React, { useState, useTransition } from 'react';
import Image from 'next/image';
import { AlertCircle, Loader2, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { completeInvite } from '@/app/actions/join';
import { PasswordInput } from '@/components/auth/PasswordInput';

const inputClass =
  'w-full bg-zinc-950/90 border border-zinc-800/90 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-[#d4af37]';

export function JoinForm({ token, name, roleLabel, workspaces }: { token: string; name: string; roleLabel: string; workspaces: string[] }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await completeInvite(token, { email, phone, username, password });
        if (res && !res.success) setError(res.error);
      } catch (err: any) {
        // A successful sign-up ends in a redirect, which surfaces here as NEXT_REDIRECT.
        if (err?.message?.includes('NEXT_REDIRECT') || err?.digest?.includes('NEXT_REDIRECT')) return;
        setError(err?.message || 'Something went wrong. Please try again.');
      }
    });
  };

  return (
    <div className="w-full max-w-[400px] mx-auto">
      <div className="gold-glass-panel rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(212,175,55,0.2)] border border-[#d4af37]/40">
        <div className="flex flex-col items-center text-center mb-5">
          <Image src="/logo (8).png" alt="Logo" width={48} height={48} className="rounded-xl object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
          <h1 className="mt-3 text-xl font-extrabold tracking-wide text-white font-serif">Welcome, {name}</h1>
          <p className="mt-1 text-xs text-zinc-400">
            You are invited as <span className="text-[#f5d77f] font-bold">{roleLabel}</span> to{' '}
            <span className="text-zinc-200">{workspaces.join(', ')}</span>. Create your account to continue.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-3 mb-4 rounded-xl bg-[#d4af37]/15 border border-[#d4af37]/70 text-[#f5d77f] text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">Email *</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-[#d4af37]/70" />
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">Phone number *</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-[#d4af37]/70" />
              <input type="tel" required autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08123456789" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">Username *</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 w-4 h-4 text-[#d4af37]/70" />
              <input type="text" required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="siska.handayani" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">Password * <span className="normal-case font-normal text-zinc-500">(at least 8 characters)</span></label>
            <PasswordInput required autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="gold-btn w-full inline-flex items-center justify-center gap-2.5 py-2.5 rounded-full text-[11px] font-extrabold uppercase tracking-widest disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : <ShieldCheck className="w-4 h-4 text-black" />}
            <span>{isPending ? 'CREATING ACCOUNT...' : 'CREATE MY ACCOUNT'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
