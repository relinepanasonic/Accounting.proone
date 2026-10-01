import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';

export const dynamic = 'force-dynamic';

/** Set the monthly AI budget (USD). */
export async function PATCH(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const value = Number(body?.monthlyBudgetUsd);
  if (!Number.isFinite(value) || value < 0 || value > 10000) return NextResponse.json({ error: 'Enter a budget between $0 and $10,000.' }, { status: 400 });

  const { error } = await access.supabase
    .from('ai_office_settings')
    .upsert({ workspace_id: access.workspaceId, monthly_budget_usd: Math.round(value * 100) / 100, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' });
  if (error) {
    const missing = error.code === 'PGRST205' || error.code === '42P01';
    return NextResponse.json({ error: missing ? 'Run supabase/migrations/20261001_mission_control.sql in Supabase first.' : error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
