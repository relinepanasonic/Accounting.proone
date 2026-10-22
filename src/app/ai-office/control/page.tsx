import React from 'react';
import Link from 'next/link';
import { ShieldAlert, Bot } from 'lucide-react';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { CONTROL_TEAM } from '@/lib/ai/control-team';
import { ControlTeamBoard, type StoredReport } from '@/components/ai-office/ControlTeamBoard';

export const dynamic = 'force-dynamic';

/** AI Office > Optimize Control: the AI team that watches all companies and sends the morning WhatsApp. */
export default async function ControlTeamPage() {
  const access = await getOfficeAccess();
  if (!access) {
    return (
      <div className="p-8">
        <div className="gold-glass-panel border-red-500/40 rounded-2xl p-10 text-center max-w-xl mx-auto">
          <ShieldAlert className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-xs text-zinc-300 font-mono">Optimize Control is restricted to the Founder and Superadmins.</p>
        </div>
      </div>
    );
  }
  const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await createAdminClient().from('ai_control_reports').select('run_date, agent, cadence, content, model, tokens_in, tokens_out, cost_usd, created_at').gte('run_date', since).order('run_date', { ascending: false });
  const reports: StoredReport[] = (data || []).map((r: any) => ({ date: String(r.run_date).slice(0, 10), agent: r.agent, cadence: r.cadence, content: r.content, model: r.model || '', tokens: Number(r.tokens_in || 0) + Number(r.tokens_out || 0), costUsd: Number(r.cost_usd || 0) }));

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]"><Bot className="w-8 h-8" /></div>
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">AI Office · Optimize Control</h1>
            <p className="text-sm text-zinc-400 mt-1">Six AI supervisors watch all companies; Prof sends the morning WhatsApp to Nico, Herlan and Lucy</p>
          </div>
        </div>
        <Link href="/ai-office" className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-300 hover:border-[#d4af37]/60">Mission Control</Link>
      </div>
      <ControlTeamBoard team={CONTROL_TEAM} reports={reports} migrationMissing={Boolean(error)} />
    </div>
  );
}
