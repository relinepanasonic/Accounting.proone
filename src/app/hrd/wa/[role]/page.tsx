import React from 'react';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { waAccess, parseDays, TEAM_ROLES, type TeamRole } from '@/lib/wa/queries';
import { WaBoard } from '@/components/wa/WaBoard';
import { WaNoAccess } from '@/components/wa/WaNoAccess';
import { ClientQueue, type QueueItem } from '@/components/wa/ClientQueue';
import { signedWeeklyPdfUrl } from '@/lib/wa/signed';

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
  if (role === 'admin') {
    const db = createAdminClient();
    const ws = ctx.activeWorkspaceId;
    const { data: latest } = await db.from('wa_outbox').select('period_from').eq('workspace_id', ws).eq('kind', 'client-weekly').order('period_from', { ascending: false }).limit(1).maybeSingle();
    const periodFrom: string | null = latest?.period_from || null;
    const [{ data: rows }, { data: groups }, { data: settings }] = await Promise.all([
      periodFrom
        ? db.from('wa_outbox').select('id, store_label, client_name, group_id, message, status, detail, sent_at, period_from, period_to').eq('workspace_id', ws).eq('kind', 'client-weekly').eq('period_from', periodFrom)
        : Promise.resolve({ data: [] as any[] }),
      db.from('wa_groups').select('id, wa_id, name, is_group').eq('workspace_id', ws).eq('is_group', true).order('name'),
      db.from('wa_settings').select('send_files').eq('workspace_id', ws).maybeSingle(),
    ]);
    // A one-hour link to open each draft's PDF in a new tab (the PDF is drawn from the numbers saved with the draft).
    const items = ((rows || []) as QueueItem[]).map((r) => ({ ...r, pdfUrl: signedWeeklyPdfUrl(r.id, 3600) }));
    queue = (
      <ClientQueue
        items={items}
        sendFiles={!!settings?.send_files}
        period={items[0] ? { from: items[0].period_from, to: items[0].period_to } : null}
        groups={(groups || []).map((g: any) => ({ id: g.id as string, label: g.name || `Group ···${String(g.wa_id).slice(-6)}` }))}
      />
    );
  }

  return (
    <div className="space-y-6">
      {queue}
      <WaBoard workspaceId={ctx.activeWorkspaceId} role={role as TeamRole} days={parseDays(sp.days)} groupId={one(sp.group)} q={one(sp.q)} />
    </div>
  );
}
