import React from 'react';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { waAccess, parseDays, TEAM_ROLES, type TeamRole } from '@/lib/wa/queries';
import { WaBoard } from '@/components/wa/WaBoard';
import { WaNoAccess } from '@/components/wa/WaNoAccess';
import { ClientQueue, type QueueItem } from '@/components/wa/ClientQueue';
import { ReportBoard } from '@/components/wa/ReportBoard';
import { loadBoard } from '@/lib/wa/board-data';
import { shiftMonth, validMonth } from '@/lib/wa/board';
import { jakartaDate } from '@/lib/wa/report-text';
import { SalesBotPanel } from '@/components/wa/SalesBotPanel';
import { DEFAULT_BOT_KNOWLEDGE } from '@/lib/wa/bot/default-knowledge';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // "Prepare now" and "Approve & send" run here

/** HRD > WA Control > Admin | Advertiser | Sales: only what that team says and how fast it answers. Admin also holds the client summary queue. */
export default async function WaRolePage({ params, searchParams }: { params: Promise<{ role: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { role } = await params;
  if (!(TEAM_ROLES as readonly string[]).includes(role)) notFound();
  const ctx = await waAccess();
  if (!ctx) return <WaNoAccess />;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

  let queue: React.ReactNode = null;
  let boardNode: React.ReactNode = null;
  if (role === 'admin') {
    const db = createAdminClient();
    const ws = ctx.activeWorkspaceId;
    const { data: latest } = await db.from('wa_outbox').select('period_from').eq('workspace_id', ws).eq('kind', 'client-weekly').order('period_from', { ascending: false }).limit(1).maybeSingle();
    const periodFrom: string | null = latest?.period_from || null;
    const [{ data: rows }, { data: groups }, { data: settings }] = await Promise.all([
      periodFrom
        ? db.from('wa_outbox').select('id, store_label, client_name, group_id, message, status, detail, sent_at, period_from, period_to').eq('workspace_id', ws).eq('kind', 'client-weekly').eq('period_from', periodFrom)
        : Promise.resolve({ data: [] as any[] }),
      db.from('wa_groups').select('id, wa_id, name, is_group').eq('workspace_id', ws).or('is_group.eq.true,allow_target.eq.true').order('name'),
      db.from('wa_settings').select('send_files').eq('workspace_id', ws).maybeSingle(),
    ]);
    // A one-hour link to open each draft's PDF in a new tab (the PDF is drawn from the numbers saved with the draft).
    const items = ((rows || []) as QueueItem[]).map((r) => ({ ...r, pdfUrl: `/api/wa/report-image/${r.id}` }));
    const thisMonth = jakartaDate().slice(0, 7);
    const month = validMonth(one(sp.month), thisMonth);
    const board = await loadBoard(ws, month);
    const monthLabel = new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    boardNode = <ReportBoard month={month} monthLabel={monthLabel} prevMonth={shiftMonth(month, -1)} nextMonth={shiftMonth(month, 1)} weeks={board.weeks} rows={board.rows} />;
    const drafts = items.filter((i) => i.status === 'draft' || i.status === 'failed').length;
    queue = (
      <details className="rounded-xl border border-[#d4af37]/15 bg-[#0e0f14]/40 p-3">
        <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">Drafts to approve and send ({drafts})</summary>
        <div className="mt-3">
      <ClientQueue
        items={items}
        sendFiles={!!settings?.send_files}
        period={items[0] ? { from: items[0].period_from, to: items[0].period_to } : null}
        groups={(groups || []).map((g: any) => ({ id: g.id as string, isGroup: !!g.is_group, label: g.name || (g.is_group ? `Group ···${String(g.wa_id).slice(-6)}` : `+${g.wa_id}`) }))}
      />
        </div>
      </details>
    );
  }

  let botPanel: React.ReactNode = null;
  if (role === 'sales') {
    const db = createAdminClient();
    const ws = ctx.activeWorkspaceId;
    const [{ data: cfg }, { data: devs }, { data: chats }, { data: log }] = await Promise.all([
      db.from('wa_bot_config').select('*').eq('workspace_id', ws).maybeSingle(),
      db.from('wa_devices').select('phone, label, webhook_secret').eq('workspace_id', ws).eq('role', 'sales'),
      db.from('wa_bot_chats').select('group_id, status, replies, reason, lead, updated_at, wa_groups(name, wa_id)').eq('workspace_id', ws).order('updated_at', { ascending: false }).limit(40),
      db.from('wa_bot_log').select('id, in_reply_to, reply, handoff, ok, detail, created_at, wa_groups(name, wa_id)').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(30),
    ]);
    const chatName = (g: any) => g?.name || (g?.wa_id ? `+${g.wa_id}` : 'Chat');
    botPanel = (
      <SalesBotPanel
        tokenSet={!!process.env.FONNTE_TOKEN_SALES}
        config={{ enabled: !!cfg?.enabled, persona_name: cfg?.persona_name || 'Fefe', company_name: cfg?.company_name || 'Prof Toko Online', hours_from: cfg?.hours_from || '08:00', hours_to: cfg?.hours_to || '21:00', max_replies: cfg?.max_replies || 4, knowledge: cfg?.knowledge || DEFAULT_BOT_KNOWLEDGE }}
        devices={(devs || []).map((d: any) => ({ phone: d.phone, label: d.label, webhookUrl: `https://erp.profesoronline.id/api/wa/webhook/${d.webhook_secret}` }))}
        chats={(chats || []).map((x: any) => ({ group_id: x.group_id, name: chatName(x.wa_groups), status: x.status, replies: x.replies, reason: x.reason, lead: x.lead, updated_at: x.updated_at }))}
        log={(log || []).map((l: any) => ({ id: l.id, chat: chatName(l.wa_groups), in_reply_to: l.in_reply_to, reply: l.reply, handoff: l.handoff, ok: l.ok, detail: l.detail, created_at: l.created_at }))}
      />
    );
  }

  const teamBoard = <WaBoard workspaceId={ctx.activeWorkspaceId} role={role as TeamRole} days={parseDays(sp.days)} groupId={one(sp.group)} q={one(sp.q)} />;
  return (
    <div className="space-y-6">
      {boardNode}
      {queue}
      {botPanel}
      {role === 'admin'
        ? <details className="rounded-xl border border-zinc-800 p-3"><summary className="cursor-pointer text-xs font-extrabold uppercase tracking-wider text-zinc-400">Admin team activity in the chats</summary><div className="mt-3">{teamBoard}</div></details>
        : teamBoard}
    </div>
  );
}
