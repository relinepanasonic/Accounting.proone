import React from 'react';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { ArrowRight, Building2, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { signOut } from '@/app/actions/auth';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  founder: 'Founder',
  superadmin: 'Superadmin',
  accounting: 'Accounting',
  admin: 'Admin',
  advertiser: 'Advertiser',
  client: 'Client',
};

export default async function WorkspacesLandingPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!ctx.userId) redirect('/login');

  // Only the workspaces this person may enter are listed; the others are not shown at all.
  const eligible = ctx.availableWorkspaces;
  if (eligible.length === 0) redirect('/no-access');
  // One choice is no choice: go straight in.
  if (eligible.length === 1) redirect(`/workspaces/enter?id=${encodeURIComponent(eligible[0].id)}`);

  // Logos are optional; a failed lookup just means initials are shown.
  const logos: Record<string, string> = {};
  const { data: rows } = await supabase
    .from('workspaces')
    .select('id, logo_url')
    .in('id', eligible.map((w) => w.id));
  (rows || []).forEach((r: any) => {
    if (r.logo_url) logos[r.id] = r.logo_url;
  });

  const lastUsedId = ctx.activeWorkspaceId;
  const firstName = (ctx.userName || '').split(/[\s.@]/)[0];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#0b0c10]">
      <div className="w-full max-w-4xl">
        <div className="flex flex-col items-center text-center mb-8">
          <Image
            src="/logo (8).png"
            alt="Professor Toko Logo"
            width={56}
            height={56}
            className="rounded-xl object-contain drop-shadow-[0_0_18px_rgba(212,175,55,0.5)]"
          />
          <h1 className="mt-4 text-2xl font-extrabold tracking-wide text-white font-serif">
            {firstName ? `Welcome, ${firstName}` : 'Welcome'}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">Choose the workspace you want to enter.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {eligible.map((ws) => (
            // Plain link on purpose: entering sets cookies, so it must not be prefetched.
            <a
              key={ws.id}
              href={`/workspaces/enter?id=${encodeURIComponent(ws.id)}`}
              className="group relative gold-glass-panel rounded-2xl border border-[#d4af37]/25 hover:border-[#d4af37]/70 p-5 flex items-center gap-4 transition-all hover:shadow-[0_0_30px_rgba(212,175,55,0.18)]"
            >
              <div className="w-14 h-14 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center overflow-hidden shrink-0">
                {logos[ws.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logos[ws.id]} alt="" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-6 h-6 text-[#d4af37]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-white truncate">{ws.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border border-[#d4af37]/40 text-[#f5d77f]">
                    {ROLE_LABEL[ws.role] || ws.role}
                  </span>
                  {ws.id === lastUsedId && <span className="text-[10px] font-mono uppercase text-zinc-500">last used</span>}
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-[#f5d77f] transition-colors shrink-0" />
            </a>
          ))}
        </div>

        <form action={signOut} className="mt-8 flex justify-center">
          <button
            type="submit"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
