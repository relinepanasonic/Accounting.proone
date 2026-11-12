'use client';

import React, { useState, useTransition } from 'react';
import { prepareWeeklyNow, saveOutboxMessage, sendOutbox, skipOutbox, linkStoreToGroup } from '@/app/actions/wa';

export interface QueueItem { id: string; store_label: string; client_name: string | null; group_id: string | null; message: string; status: string; detail: string | null; sent_at: string | null; period_from: string; period_to: string; pdfUrl?: string | null }
export interface QueueGroup { id: string; label: string }

const card = 'rounded-xl border border-[#d4af37]/15 bg-[#0e0f14]/70 p-4';
const btn = 'rounded-md border border-[#d4af37]/40 bg-[#d4af37]/15 px-3 py-1.5 text-xs font-bold text-[#f5d77f] disabled:opacity-40';
const ghost = 'rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:border-[#d4af37]/50 hover:text-[#f5d77f] disabled:opacity-40';
const jakarta = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const STATUS: Record<string, string> = { draft: 'text-amber-300 border-amber-500/40', sending: 'text-sky-300 border-sky-500/40', sent: 'text-emerald-300 border-emerald-500/40', failed: 'text-red-300 border-red-500/40', skipped: 'text-zinc-500 border-zinc-700' };

export function ClientQueue({ items, groups, period, sendFiles }: { items: QueueItem[]; groups: QueueGroup[]; period: { from: string; to: string } | null; sendFiles: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const order = (i: QueueItem) => (i.status === 'failed' ? 0 : i.status === 'draft' ? (i.group_id ? 1 : 2) : i.status === 'sending' ? 3 : i.status === 'sent' ? 4 : 5);
  const sorted = [...items].sort((a, b) => order(a) - order(b) || a.store_label.localeCompare(b.store_label));
  const counts = items.reduce<Record<string, number>>((m, i) => { m[i.status] = (m[i.status] || 0) + 1; return m; }, {});

  const run = (refresh: boolean) => start(async () => {
    setMsg('Preparing from the Dashboard Prof and Reline numbers... (up to a minute)');
    const r: any = await prepareWeeklyNow(refresh);
    if (r?.error) return setMsg(`Problem: ${r.error}`);
    const x = r.run;
    setMsg(`Week ${x.from} to ${x.to}: ${x.created} new, ${x.refreshed} rebuilt, ${x.kept} kept, ${x.noData} store(s) without numbers.${x.errors.length ? ` Problems: ${x.errors.join('; ')}` : ''}`);
  });

  return (
    <section className={card}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">Client weekly summaries (Oli)</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            {period ? `Week ${period.from} to ${period.to}. ` : ''}Drafts are made every Monday 08:00 from the Dashboard Prof and Reline numbers. Nothing goes to a client until you press Approve &amp; send.{' '}
            {sendFiles ? 'Each one is sent as a PDF with the title below as its caption.' : 'PDF sending is off, so each one is sent as the title followed by the numbers in text (the Founder page switches PDFs on).'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={pending} className={btn} onClick={() => run(false)}>{pending ? 'Working...' : 'Prepare now'}</button>
          <button disabled={pending} className={ghost} title="Rebuild every unsent draft from the latest numbers. Your edits to them are lost." onClick={() => { if (confirm('Rebuild all unsent drafts from the latest numbers? Edits you made to them are lost.')) run(true); }}>Rebuild drafts</button>
        </div>
      </div>
      {msg && <p className="mb-3 text-xs text-zinc-300">{msg}</p>}
      {items.length > 0 && (
        <p className="mb-3 text-[11px] text-zinc-500">
          {['draft', 'failed', 'sent', 'skipped'].filter((s) => counts[s]).map((s) => `${counts[s]} ${s}`).join(' · ')}
        </p>
      )}
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-500">No summaries yet. Press Prepare now, or wait for Monday 08:00.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((i) => <QueueCard key={`${i.id}:${i.message.length}:${i.status}`} item={i} groups={groups} sendFiles={sendFiles} />)}
        </ul>
      )}
    </section>
  );
}

function QueueCard({ item, groups, sendFiles }: { item: QueueItem; groups: QueueGroup[]; sendFiles: boolean }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState(item.message);
  const [note, setNote] = useState('');
  const editable = item.status === 'draft' || item.status === 'failed';
  const group = groups.find((g) => g.id === item.group_id);
  const dirty = text.trim() !== item.message.trim();

  return (
    <li className="rounded-lg border border-zinc-800 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-bold text-zinc-100">{item.store_label}</span>
        {item.client_name && <span className="text-xs text-zinc-500">{item.client_name}</span>}
        <span className={`rounded-full border px-2 py-px text-[10px] font-bold uppercase ${STATUS[item.status] || STATUS.skipped}`}>{item.status}</span>
        {item.sent_at && <span className="text-[11px] text-zinc-500">sent {jakarta(item.sent_at)}</span>}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500">Send to group:</span>
        <select
          disabled={!editable || pending}
          value={item.group_id || ''}
          onChange={(e) => start(async () => { const r: any = await linkStoreToGroup(item.store_label, e.target.value || null); setNote(r?.error || ''); })}
          className="max-w-[16rem] rounded-md border border-zinc-800 bg-[#0e0f14] px-2 py-1 text-xs text-zinc-200 disabled:opacity-60"
        >
          <option value="">Not linked</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
        {!item.group_id && editable && <span className="text-[11px] text-amber-400">Link the client&apos;s group to send (Oli must be in that group). Or set it once for the whole client in Client Contacts.</span>}
        {item.pdfUrl && <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-[11px] font-bold text-[#f5d77f] underline">Preview PDF</a>}
      </div>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{sendFiles ? 'Caption (sent with the PDF)' : 'Title (the numbers follow it)'}</div>

      <textarea
        value={text}
        readOnly={!editable}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(16, Math.max(6, text.split('\n').length + 1))}
        className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/40 p-2.5 text-xs leading-relaxed text-zinc-200 focus:border-[#d4af37]/50 focus:outline-none read-only:text-zinc-500"
      />

      {item.detail && <p className={`mt-1 text-[11px] ${item.status === 'failed' ? 'text-red-400' : 'text-zinc-500'}`}>{item.detail}</p>}
      {note && <p className="mt-1 text-[11px] text-amber-400">{note}</p>}

      {editable && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            disabled={pending || !item.group_id}
            className={btn}
            onClick={() => { if (!confirm(`Send this summary to "${group?.label || 'the group'}" now, as Oli?`)) return; start(async () => { setNote('Sending...'); const r: any = await sendOutbox(item.id, text); setNote(r?.error ? `Not sent: ${r.error}` : ''); }); }}
          >
            Approve &amp; send
          </button>
          {sendFiles && item.status === 'failed' && (
            <button disabled={pending || !item.group_id} className={ghost} title="The PDF could not be sent. Send the title and numbers as text instead." onClick={() => { if (!confirm('Send as text (no PDF) to this group now?')) return; start(async () => { setNote('Sending...'); const r: any = await sendOutbox(item.id, text, true); setNote(r?.error ? `Not sent: ${r.error}` : ''); }); }}>Send as text instead</button>
          )}
          <button disabled={pending || !dirty} className={ghost} onClick={() => start(async () => { const r: any = await saveOutboxMessage(item.id, text); setNote(r?.error || 'Saved.'); })}>Save edit</button>
          <button disabled={pending} className={ghost} onClick={() => start(async () => { await skipOutbox(item.id, true); })}>Skip this week</button>
        </div>
      )}
      {item.status === 'skipped' && <button disabled={pending} className={`${ghost} mt-2`} onClick={() => start(async () => { await skipOutbox(item.id, false); })}>Put back</button>}
    </li>
  );
}
