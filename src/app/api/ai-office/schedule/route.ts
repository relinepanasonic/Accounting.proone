import { NextResponse } from 'next/server';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { runScheduleNow } from '@/lib/ai/mission';

export const dynamic = 'force-dynamic';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const CADENCES = ['daily', 'weekly', 'monthly', 'once'];

/** Checks and normalises the timing fields. Returns an error message or the row fields. */
function timing(body: any): { error: string } | Record<string, unknown> {
  const cadence = String(body?.cadence || '');
  if (!CADENCES.includes(cadence)) return { error: 'Choose how often it runs.' };
  const runTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(body?.runTime || '')) ? String(body.runTime) : '07:00';
  const out: Record<string, unknown> = { cadence, run_time: runTime, weekday: null, monthday: null, run_date: null };
  if (cadence === 'weekly') {
    const w = Number(body?.weekday);
    if (!Number.isInteger(w) || w < 0 || w > 6) return { error: 'Choose the day of the week.' };
    out.weekday = w;
  }
  if (cadence === 'monthly') {
    const d = Number(body?.monthday);
    if (!Number.isInteger(d) || d < 1 || d > 31) return { error: 'Choose the day of the month (1-31).' };
    out.monthday = d;
  }
  if (cadence === 'once') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body?.runDate || ''))) return { error: 'Choose the date.' };
    out.run_date = body.runDate;
  }
  return out;
}

export async function POST(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);

  // "Run now" for an existing schedule.
  if (body?.action === 'run') {
    try {
      const goalId = await runScheduleNow(access.supabase, access.workspaceId, access.userId, String(body.id || ''));
      return NextResponse.json({ ok: true, goalId });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Could not start it.' }, { status: 400 });
    }
  }

  const title = str(body?.title, 120);
  const brief = str(body?.brief, 8000);
  if (!title || brief.length < 5) return NextResponse.json({ error: 'Write a title and the brief.' }, { status: 400 });
  const t = timing(body);
  if ('error' in t) return NextResponse.json({ error: t.error }, { status: 400 });

  const { error } = await access.supabase.from('ai_schedules').insert({
    workspace_id: access.workspaceId, team_id: typeof body?.teamId === 'string' && body.teamId ? body.teamId : null,
    title, brief, ...t, enabled: true, created_by: access.userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return NextResponse.json({ error: 'Missing schedule.' }, { status: 400 });

  const fields: Record<string, unknown> = {};
  if (body.enabled !== undefined) fields.enabled = Boolean(body.enabled);
  if (body.cadence !== undefined) {
    const t = timing(body);
    if ('error' in t) return NextResponse.json({ error: t.error }, { status: 400 });
    Object.assign(fields, t);
  }
  if (body.title !== undefined) fields.title = str(body.title, 120);
  if (body.brief !== undefined) fields.brief = str(body.brief, 8000);

  const { error } = await access.supabase.from('ai_schedules').update(fields).eq('id', id).eq('workspace_id', access.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const access = await getOfficeAccess();
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing schedule.' }, { status: 400 });
  const { error } = await access.supabase.from('ai_schedules').delete().eq('id', id).eq('workspace_id', access.workspaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
