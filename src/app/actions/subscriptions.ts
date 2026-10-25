'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { isFounderEmail } from '@/lib/auth/founders';
import { KNOWN_SUBSCRIPTIONS } from '@/lib/subscriptions/known';

type Result = { success: boolean; error?: string; id?: string };

const MISSING = 'Run supabase/migrations/20261028_subscriptions.sql in Supabase first.';
const fail = (e: { code?: string; message: string }): Result => ({ success: false, error: /subscriptions|42P01|PGRST205/.test(`${e.code} ${e.message}`) ? MISSING : e.message });

/** Only the founder: nobody else reads or changes what the company pays. */
async function founder() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  if (!ctx.userId || (ctx.role !== 'founder' && !isFounderEmail(ctx.userEmail))) return null;
  return createAdminClient();
}

export interface SubscriptionInput {
  id?: string;
  name: string;
  category: string;
  purpose?: string | null;
  plan?: string | null;
  amount: number;
  currency: 'IDR' | 'USD';
  cycle: 'monthly' | 'yearly';
  renew_day?: number | null;
  paid_with?: string | null;
  url?: string | null;
  note?: string | null;
  active: boolean;
}

const text = (v: unknown, max = 300) => { const s = String(v ?? '').trim().slice(0, max); return s || null; };

export async function saveSubscription(input: SubscriptionInput): Promise<Result> {
  const db = await founder();
  if (!db) return { success: false, error: 'Only the founder can change subscriptions.' };
  const name = text(input.name, 120);
  if (!name) return { success: false, error: 'The name is required.' };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) return { success: false, error: 'The price must be 0 or more.' };
  const day = input.renew_day ? Math.round(Number(input.renew_day)) : null;
  const row = {
    name,
    category: text(input.category, 40) || 'Other',
    purpose: text(input.purpose, 400),
    plan: text(input.plan, 120),
    amount,
    currency: input.currency === 'USD' ? 'USD' : 'IDR',
    cycle: input.cycle === 'yearly' ? 'yearly' : 'monthly',
    renew_day: day && day >= 1 && day <= 31 ? day : null,
    paid_with: text(input.paid_with, 120),
    url: text(input.url, 300),
    note: text(input.note, 600),
    active: input.active !== false,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { error } = await db.from('subscriptions').update(row).eq('id', input.id);
    return error ? fail(error) : { success: true, id: input.id };
  }
  const { data, error } = await db.from('subscriptions').insert(row).select('id').single();
  return error ? fail(error) : { success: true, id: data.id };
}

export async function deleteSubscription(id: string): Promise<Result> {
  const db = await founder();
  if (!db) return { success: false, error: 'Only the founder can change subscriptions.' };
  const { error } = await db.from('subscriptions').delete().eq('id', id);
  return error ? fail(error) : { success: true };
}

/** Adds the apps this ERP is known to use (with Rp 0), skipping names that are already in the list. */
export async function addUsualSubscriptions(): Promise<Result> {
  const db = await founder();
  if (!db) return { success: false, error: 'Only the founder can change subscriptions.' };
  const { data, error: readErr } = await db.from('subscriptions').select('name');
  if (readErr) return fail(readErr);
  const have = new Set((data || []).map((r: any) => String(r.name).toLowerCase()));
  const rows = KNOWN_SUBSCRIPTIONS.filter((k) => !have.has(k.name.toLowerCase())).map((k) => ({ name: k.name, category: k.category, purpose: k.purpose, url: k.url || null }));
  if (!rows.length) return { success: true };
  const { error } = await db.from('subscriptions').insert(rows);
  return error ? fail(error) : { success: true };
}
