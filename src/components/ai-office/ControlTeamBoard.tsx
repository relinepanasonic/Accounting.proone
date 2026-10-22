'use client';

import React, { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play, Copy, Check } from 'lucide-react';
import { runControlNow } from '@/app/actions/control-team';
import type { ControlAgent, AgentKey } from '@/lib/ai/control-team';
import { fmtUsd } from '@/lib/ai/costs';

export interface StoredReport { date: string; agent: AgentKey; cadence: 'daily' | 'weekly'; content: string; model: string; tokens: number; costUsd: number }

const MODEL_LABEL = (m: string) => (m.includes('sonnet') ? 'Sonnet 5.5' : m.includes('haiku') ? 'Haiku 5.5' : m.includes('opus') ? 'Opus 5.5' : m);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dmy = (d: string) => `${d.slice(8, 10)} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

/** The team, today's WhatsApp message and the reports of the last two weeks. */
export function ControlTeamBoard({ team, reports, migrationMissing }: { team: ControlAgent[]; reports: StoredReport[]; migrationMissing: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const days = useMemo(() => Array.from(new Set(reports.map((r) => r.date))), [reports]);
  const latestMessage = reports.find((r) => r.agent === 'prof' && r.cadence !== 'qc');
  const latestQc = reports.find((r) => r.agent === 'prof' && r.cadence === 'qc' && r.date === latestMessage?.date);
  const name = (k: AgentKey) => team.find((a) => a.key === k)?.name || k;
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthCost = reports.filter((r) => r.date.startsWith(monthKey)).reduce((s, r) => s + r.costUsd, 0);

  const run = () => {
    setNotice('');
    start(async () => {
      const res = await runControlNow();
      setNotice(res.success ? (res.errors?.length ? `Done, with problems: ${res.errors.join('; ')}` : 'Done. The new reports are below.') : res.error || 'Could not run.');
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {migrationMissing && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">Run <b>supabase/migrations/20261020_ai_control_reports.sql</b> in Supabase once. Until then the reports cannot be stored.</div>}

      {/* The team */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {team.map((a) => (
          <div key={a.key} className={`gold-glass-panel rounded-2xl p-4 ${a.key === 'prof' ? 'border-[#d4af37]/50' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-base font-extrabold text-zinc-100">{a.name}</div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${a.model.includes('sonnet') ? 'border-[#d4af37]/40 text-[#f5d77f]' : 'border-sky-500/40 text-sky-300'}`}>{MODEL_LABEL(a.model)}{a.effort ? ` · ${a.effort}` : ''}</span>
            </div>
            <div className="mt-0.5 text-xs text-zinc-400">{a.title}</div>
            <div className="mt-2 text-[11px] text-zinc-500">Report: {a.cadence.map((c) => (c === 'daily' ? 'daily' : 'weekly (Monday)')).join(' + ')}</div>
            <div className="mt-2 text-[11px] leading-snug text-zinc-600">{a.why}</div>
          </div>
        ))}
      </div>

      {/* Today's message */}
      <div className="gold-glass-panel rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-200">WhatsApp message {latestMessage ? `· ${dmy(latestMessage.date)}` : ''}</h2>
            <p className="text-[11px] text-zinc-500">Written by Prof every morning at 08:00; Make.com sends it at 09:00. AI cost this month: {fmtUsd(monthCost)}</p>
          </div>
          <div className="flex gap-2">
            {latestMessage && (
              <button onClick={() => { void navigator.clipboard.writeText(latestMessage.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-zinc-500">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
              </button>
            )}
            <button onClick={run} disabled={pending || migrationMissing} className="inline-flex items-center gap-1.5 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#f5d77f] hover:bg-[#d4af37]/20 disabled:opacity-40">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} {pending ? 'The team is working...' : 'Run the team now'}
            </button>
          </div>
        </div>
        {notice && <div className="mb-3 text-xs text-zinc-400">{notice}</div>}
        <pre className="whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-sans text-[13px] leading-relaxed text-zinc-200">{latestMessage?.content || 'No message yet. Press "Run the team now".'}</pre>
      </div>

      {latestQc && (
        <div className="gold-glass-panel rounded-2xl p-5">
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-zinc-200">Prof&apos;s QC notes</h2>
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-300">{latestQc.content}</pre>
        </div>
      )}

      {/* Reports per day */}
      <div className="space-y-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-200">Reports</h2>
        {days.length === 0 && <div className="text-xs text-zinc-500">No reports yet.</div>}
        {days.map((d) => {
          const list = reports.filter((r) => r.date === d);
          const open = openDay === d || (openDay === null && d === days[0]);
          return (
            <div key={d} className="gold-glass-panel overflow-hidden rounded-2xl">
              <button onClick={() => setOpenDay(open ? '' : d)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                <span className="text-sm font-bold text-zinc-100">{dmy(d)}</span>
                <span className="text-[11px] text-zinc-500">{list.length} report(s) · {list.reduce((s, r) => s + r.tokens, 0).toLocaleString('id-ID')} tokens · {fmtUsd(list.reduce((s, r) => s + r.costUsd, 0))}</span>
              </button>
              {open && (
                <div className="grid gap-3 border-t border-zinc-800/60 p-4 lg:grid-cols-2">
                  {list.filter((r) => r.agent !== 'prof').map((r) => (
                    <div key={`${r.agent}-${r.cadence}`} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[#f5d77f]">{name(r.agent)} · {r.cadence}</span>
                        <span className="text-zinc-600">{MODEL_LABEL(r.model)} · {r.tokens} tok</span>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-300">{r.content}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
