import React from 'react';
import { ShieldAlert, ReceiptText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { isFounderEmail } from '@/lib/auth/founders';
import { SubscriptionsTable, type SubscriptionRow } from '@/components/subscriptions/SubscriptionsTable';

export const dynamic = 'force-dynamic';

/** Subscriptions: every app, tool and AI the company pays for, and what it costs per month. Founder only. */
export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId || (ctx.role !== 'founder' && !isFounderEmail(ctx.userEmail))) {
    return (
      <div className="p-8">
        <div className="gold-glass-panel mx-auto max-w-xl rounded-2xl border-red-500/40 p-10 text-center">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
          <p className="font-mono text-xs text-zinc-300">Subscriptions is for the Founder only.</p>
        </div>
      </div>
    );
  }

  const { data, error } = await createAdminClient().from('subscriptions').select('*').order('category').order('name');
  const missing = !!error && /subscriptions|42P01|PGRST205/.test(`${error.code} ${error.message}`);
  const rows: SubscriptionRow[] = (data || []).map((r: any) => ({
    id: r.id, name: r.name, category: r.category, purpose: r.purpose, plan: r.plan, amount: Number(r.amount || 0), currency: r.currency, cycle: r.cycle,
    renew_day: r.renew_day, paid_with: r.paid_with, url: r.url, note: r.note, active: r.active,
  }));

  return (
    <div className="space-y-6 p-4 lg:p-8 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold uppercase tracking-tight text-white"><ReceiptText className="h-6 w-6 text-[#d4af37]" />Subscriptions</h1>
        <p className="mt-1 text-sm text-zinc-400">The apps, tools and AI we pay for, and what they cost per month.</p>
      </div>
      {missing
        ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">Run <code className="font-mono">supabase/migrations/20261028_subscriptions.sql</code> in the Supabase SQL editor, then reload this page.</div>
        : <SubscriptionsTable initial={rows} />}
    </div>
  );
}
