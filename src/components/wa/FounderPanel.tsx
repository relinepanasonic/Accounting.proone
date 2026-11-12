'use client';

import React, { useState, useTransition } from 'react';
import {
  previewPerformanceReport, sendPerformanceReportNow, setPerformanceAutoSend,
  addReportRecipient, updateReportRecipient, removeReportRecipient,
} from '@/app/actions/wa';

export interface Recipient { id: string; phone: string; name: string | null; active: boolean }
export interface SendRow { id: string; created_at: string; kind: string; report_date: string; trigger: string; ok: boolean; detail: string | null; text: string | null; recipients: string[] }

const card = 'rounded-xl border border-[#d4af37]/15 bg-[#0e0f14]/70 p-4';
const h2 = 'text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]';
const btn = 'rounded-md border border-[#d4af37]/40 bg-[#d4af37]/15 px-3 py-1.5 text-xs font-bold text-[#f5d77f] disabled:opacity-40';
const ghost = 'rounded border border-zinc-700 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-300 hover:border-[#d4af37]/50 hover:text-[#f5d77f] disabled:opacity-40';
const input = 'rounded-md border border-zinc-800 bg-[#0e0f14] px-2.5 py-1.5 text-xs text-zinc-200 focus:border-[#d4af37]/50 focus:outline-none';

const jakarta = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const KIND: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', none: 'No report' };

export function FounderPanel({ recipients, autoSend, sends, tokenSet }: { recipients: Recipient[]; autoSend: boolean; sends: SendRow[]; tokenSet: boolean }) {
  const [pending, start] = useTransition();
  const [date, setDate] = useState('');
  const [preview, setPreview] = useState<{ kind: string; date: string; text: string; message: string; send: boolean } | null>(null);
  const [msg, setMsg] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');

  const say = (r: any, okText: string) => setMsg(r?.error ? `Problem: ${r.error}` : r?.out ? (r.out.sent ? `Sent to ${r.out.recipients} number(s): ${KIND[r.out.kind] || r.out.kind} report of ${r.out.date}.` : `Not sent: ${r.out.reason}`) : okText);

  return (
    <div className="space-y-6">
      {!tokenSet && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          The sending number is not connected yet: <code>FONNTE_TOKEN</code> is missing on the server. Until it is set, preview works but nothing can be sent.
        </div>
      )}

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className={h2}>Team performance report</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} title="Build the report as if today were this date (empty = today)" />
            <button disabled={pending} className={btn} onClick={() => start(async () => { setMsg('Building the report... (up to 30 seconds)'); const r: any = await previewPerformanceReport(date || undefined); if (r?.error) { setMsg(`Problem: ${r.error}`); } else { setPreview(r.report); setMsg(r.report.send ? '' : 'Sunday: there is no report.'); } })}>
              {pending ? 'Working...' : 'Build preview'}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500">Daily Tuesday to Saturday (yesterday), weekly on Monday (the month so far), monthly on the first Monday of a month, nothing on Sunday. Counted from the ERP data; the advice at the end is written by Prof (AI).</p>
        {msg && <p className="mt-2 text-xs text-zinc-300">{msg}</p>}
        {preview?.send && (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{KIND[preview.kind]} report · built for {preview.date}</div>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-zinc-200">{preview.text}</pre>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">What WhatsApp receives{preview.kind !== 'daily' ? ' (headline + PDF links)' : ''}</div>
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-emerald-200/90">{preview.message}</pre>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={card}>
          <h2 className={`${h2} mb-3`}>Who receives it</h2>
          <ul className="divide-y divide-zinc-800/70">
            {recipients.map((r) => <RecipientRow key={r.id} r={r} tokenSet={tokenSet} onMsg={(r2: any) => say(r2, '')} />)}
            {recipients.length === 0 && <li className="py-3 text-xs text-zinc-500">No recipient yet.</li>}
          </ul>
          <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r: any = await addReportRecipient(newPhone, newName); if (!r?.error) { setNewPhone(''); setNewName(''); } say(r, 'Added.'); }); }}>
            <input className={`${input} w-36`} placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className={`${input} w-44`} placeholder="0812... or 62812..." value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            <button className={btn} disabled={pending || !newPhone.trim()}>Add</button>
          </form>
        </section>

        <section className={card}>
          <h2 className={`${h2} mb-3`}>Sending</h2>
          <div className="space-y-4 text-xs text-zinc-300">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-bold text-zinc-100">Send automatically every day at 09:00</div>
                <p className="mt-1 text-[11px] text-zinc-500">Turn this on only after the Make.com scenario &quot;Daily / Weekly Report WhatsApp&quot; is switched off, or everyone gets the report twice. It never sends the same report twice in a day.</p>
              </div>
              <button disabled={pending || !tokenSet} onClick={() => start(async () => { const r: any = await setPerformanceAutoSend(!autoSend); say(r, autoSend ? 'Automatic sending is off.' : 'Automatic sending is ON.'); })}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold uppercase ${autoSend ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-zinc-700 text-zinc-400'} disabled:opacity-40`}>
                {autoSend ? 'On' : 'Off'}
              </button>
            </div>
            <div className="border-t border-zinc-800/70 pt-3">
              <div className="font-bold text-zinc-100">Send now to everyone</div>
              <p className="mt-1 text-[11px] text-zinc-500">Builds today&apos;s report and sends it to every active number above. Use the Test button next to one name first.</p>
              <button disabled={pending || !tokenSet} className={`${btn} mt-2`} onClick={() => { if (!confirm(`Send the ${preview ? KIND[preview.kind] : 'team performance'} report to ${recipients.filter((x) => x.active).length} people now?`)) return; start(async () => { setMsg('Sending... (up to 40 seconds)'); const r: any = await sendPerformanceReportNow(); say(r, ''); }); }}>
                {pending ? 'Working...' : 'Send now to all'}
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className={card}>
        <h2 className={`${h2} mb-3`}>Sent reports</h2>
        {sends.length === 0 ? <p className="py-3 text-center text-xs text-zinc-500">Nothing sent from here yet. The Make.com scenario&apos;s sends are not listed.</p> : (
          <ul className="divide-y divide-zinc-800/70">
            {sends.map((s) => (
              <li key={s.id} className="py-2">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 text-xs">
                    <span className="text-zinc-400">{jakarta(s.created_at)}</span>
                    <span className="font-bold text-zinc-200">{KIND[s.kind] || s.kind} · {s.report_date}</span>
                    <span className={s.ok ? 'text-emerald-400' : 'text-red-400'}>{s.ok ? 'sent' : 'failed'}</span>
                    <span className="text-zinc-500">{s.trigger} · {s.recipients.length} number(s)</span>
                  </summary>
                  {s.detail && <p className="mt-1 text-[11px] text-zinc-500">{s.detail}</p>}
                  {s.text && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs text-zinc-300">{s.text}</pre>}
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RecipientRow({ r, tokenSet, onMsg }: { r: Recipient; tokenSet: boolean; onMsg: (x: any) => void }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name || '');
  const save = () => start(async () => { await updateReportRecipient(r.id, { name }); setEditing(false); });
  return (
    <li className="flex flex-wrap items-center gap-3 py-2 text-xs">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} placeholder="Name" className="w-full rounded border border-[#d4af37]/50 bg-[#0e0f14] px-2 py-0.5 text-xs text-zinc-100 focus:outline-none" />
        ) : (
          <button onClick={() => { setName(r.name || ''); setEditing(true); }} className={`text-left hover:text-[#f5d77f] ${r.active ? 'text-zinc-200' : 'text-zinc-500 line-through'}`}>{r.name || 'Add a name'} <span className="text-[10px] text-zinc-600">✎</span></button>
        )}
        <div className="text-[10px] text-zinc-500">+{r.phone}</div>
      </div>
      <button disabled={pending || !tokenSet} className={ghost} title="Send today's report to this number only" onClick={() => start(async () => { onMsg({ ok: true }); const x: any = await sendPerformanceReportNow(r.phone); onMsg(x); })}>Test</button>
      <button disabled={pending} className={ghost} onClick={() => start(async () => { await updateReportRecipient(r.id, { active: !r.active }); })}>{r.active ? 'Pause' : 'Resume'}</button>
      <button disabled={pending} className={ghost} onClick={() => { if (confirm(`Remove ${r.name || r.phone}?`)) start(async () => { await removeReportRecipient(r.id); }); }}>Remove</button>
    </li>
  );
}
