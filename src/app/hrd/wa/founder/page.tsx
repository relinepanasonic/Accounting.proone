import React from 'react';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { waFounderAccess } from '@/lib/wa/queries';
import { FounderPanel } from '@/components/wa/FounderPanel';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // "Build preview" and "Send" run here

/** HRD > WA Control > Founder: the daily / weekly team performance report, who gets it, and the send history. */
export default async function WaFounderPage() {
  const ctx = await waFounderAccess();
  if (!ctx) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <p className="text-sm text-zinc-300">The Founder page is for the founder and superadmin only.</p>
      </div>
    );
  }
  const db = createAdminClient();
  const ws = ctx.activeWorkspaceId;
  const [{ data: recipients }, { data: settings }, { data: sends }] = await Promise.all([
    db.from('wa_recipients').select('id, phone, name, active, receives_daily').eq('workspace_id', ws).order('created_at'),
    db.from('wa_settings').select('auto_send, send_files').eq('workspace_id', ws).maybeSingle(),
    db.from('wa_sends').select('id, created_at, kind, report_date, trigger, ok, detail, text, recipients').eq('workspace_id', ws).order('created_at', { ascending: false }).limit(20),
  ]);
  return <FounderPanel recipients={(recipients || []) as any} autoSend={!!settings?.auto_send} sendFiles={!!settings?.send_files} sends={(sends || []) as any} tokenSet={!!process.env.FONNTE_TOKEN} />;
}
