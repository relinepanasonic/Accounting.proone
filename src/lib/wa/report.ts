import { createAdminClient } from '@/lib/api/supabase-admin';
import { askBoss } from '@/lib/ai/providers';
import { loadGroups, loadMessages, loadPeople, sinceDays } from './queries';
import {
  DIGEST_SCHEMA, MIN_MESSAGES, REPORT_SCHEMA, REPORT_SYSTEM, buildTranscript, cleanActionItems,
  digestPrompt, groupPrompt, jakartaDate, type ActionItemDraft,
} from './report-text';

export interface ReportRun {
  date: string;
  groups: number;        // chats that got a report
  skipped: number;       // tracked chats with too few messages
  digest: boolean;
  items: number;
  errors: string[];
}

const MAX_GROUPS = 20;
const CONCURRENCY = 4;

/** Runs `fn` over `xs`, at most `n` at a time. */
async function pool<T>(xs: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => { while (i < xs.length) await fn(xs[i++]); }));
}

/** Removes the saved report for (workspace, group, day) and its follow-ups, so a re-run replaces it. */
async function clearReport(db: ReturnType<typeof createAdminClient>, ws: string, groupId: string | null, date: string) {
  let q = db.from('wa_reports').select('id').eq('workspace_id', ws).eq('report_date', date);
  q = groupId ? q.eq('group_id', groupId) : q.is('group_id', null);
  const { data } = await q;
  const ids = (data || []).map((r: any) => r.id as string);
  if (!ids.length) return;
  // Follow-ups someone already worked on (done, dismissed, or turned into a task) stay.
  await db.from('wa_action_items').delete().in('report_id', ids).eq('status', 'open').is('staff_task_id', null);
  await db.from('wa_reports').delete().in('id', ids);
}

/**
 * The daily report: for every reporting chat with enough messages in the last 24 hours, Claude writes a summary and
 * the follow-ups; then one digest across all chats. Safe to run again the same day (it replaces the day's reports).
 */
export async function generateReports(workspaceId: string, opts: { groupId?: string | null } = {}): Promise<ReportRun> {
  const db = createAdminClient();
  const date = jakartaDate();
  const run: ReportRun = { date, groups: 0, skipped: 0, digest: false, items: 0, errors: [] };

  const [groups, { byPhone }, msgs] = await Promise.all([loadGroups(workspaceId), loadPeople(workspaceId), loadMessages(workspaceId, sinceDays(1))]);
  const byGroup = new Map<string, typeof msgs>();
  for (const m of msgs) (byGroup.get(m.group_id) || byGroup.set(m.group_id, []).get(m.group_id)!).push(m);

  let todo = groups.filter((g) => g.tracked && (!opts.groupId || g.id === opts.groupId));
  const ready = todo.filter((g) => (byGroup.get(g.id)?.length || 0) >= MIN_MESSAGES);
  run.skipped = todo.length - ready.length;
  todo = ready.sort((a, b) => (byGroup.get(b.id)!.length) - (byGroup.get(a.id)!.length)).slice(0, MAX_GROUPS);

  const done: { name: string; count: number; summary: string }[] = [];
  await pool(todo, CONCURRENCY, async (g) => {
    const name = g.name || (g.is_group ? `Group ${g.wa_id.slice(-6)}` : `+${g.wa_id}`);
    const gm = byGroup.get(g.id)!;
    try {
      const { data, model } = await askBoss<{ summary: string; action_items: unknown[] }>({
        deep: false, effort: 'low', system: REPORT_SYSTEM, schema: REPORT_SCHEMA as any,
        prompt: groupPrompt(name, date, buildTranscript(gm, byPhone)),
      });
      const items: ActionItemDraft[] = cleanActionItems(data.action_items);
      await clearReport(db, workspaceId, g.id, date);
      const { data: rep, error } = await db.from('wa_reports')
        .insert({ workspace_id: workspaceId, group_id: g.id, report_date: date, message_count: gm.length, summary: String(data.summary || '').trim(), model })
        .select('id').single();
      if (error || !rep) throw new Error(error?.message || 'save failed');
      if (items.length) {
        await db.from('wa_action_items').insert(items.map((i) => ({ workspace_id: workspaceId, group_id: g.id, report_id: rep.id, title: i.title, detail: i.detail, owner_phone: i.owner_phone, due_date: i.due_date })));
        run.items += items.length;
      }
      done.push({ name, count: gm.length, summary: String(data.summary || '').trim() });
      run.groups++;
    } catch (e: any) {
      run.errors.push(`${name}: ${e?.message || e}`);
    }
  });

  // One digest across all chats (not when only one chat was asked for).
  if (!opts.groupId && done.length > 0) {
    try {
      const { data, model } = await askBoss<{ summary: string }>({
        deep: false, effort: 'low', system: REPORT_SYSTEM, schema: DIGEST_SCHEMA as any, prompt: digestPrompt(date, done),
      });
      await clearReport(db, workspaceId, null, date);
      const { error } = await db.from('wa_reports').insert({ workspace_id: workspaceId, group_id: null, report_date: date, message_count: done.reduce((n, d) => n + d.count, 0), summary: String(data.summary || '').trim(), model });
      if (error) throw new Error(error.message);
      run.digest = true;
    } catch (e: any) {
      run.errors.push(`digest: ${e?.message || e}`);
    }
  }
  return run;
}
