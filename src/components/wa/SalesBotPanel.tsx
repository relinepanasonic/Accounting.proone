'use client';

import React, { useState, useTransition } from 'react';
import { addSalesDevice, saveBotConfig, setBotChatStatus } from '@/app/actions/wa-bot';
import { DEFAULT_BOT_KNOWLEDGE } from '@/lib/wa/bot/default-knowledge';

export interface BotConfigView { enabled: boolean; persona_name: string; company_name: string; hours_from: string; hours_to: string; max_replies: number; knowledge: string }
export interface BotDeviceView { phone: string; label: string | null; webhookUrl: string }
export interface BotChatView { group_id: string; name: string; status: 'bot' | 'human' | 'off'; replies: number; reason: string | null; lead: { name?: string; store?: string; need?: string } | null; updated_at: string }
export interface BotLogView { id: string; chat: string; in_reply_to: string | null; reply: string | null; handoff: boolean; ok: boolean; detail: string | null; created_at: string }

const card = 'rounded-xl border border-[#d4af37]/15 bg-[#0e0f14]/70 p-4';
const btn = 'rounded-md border border-[#d4af37]/40 bg-[#d4af37]/15 px-3 py-1.5 text-xs font-bold text-[#f5d77f] disabled:opacity-40';
const ghost = 'rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:border-[#d4af37]/50 hover:text-[#f5d77f] disabled:opacity-40';
const input = 'rounded-md border border-zinc-700 bg-black/30 px-2 py-1.5 text-xs text-zinc-100';
const when = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

/** WA Control > Sales: the number, the bot's switch and script, the chats it is holding, and what it said. */
export function SalesBotPanel({ config, devices, chats, log, tokenSet }: { config: BotConfigView; devices: BotDeviceView[]; chats: BotChatView[]; log: BotLogView[]; tokenSet: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState('');
  const [c, setC] = useState(config);
  const [phone, setPhone] = useState('');
  const [label, setLabel] = useState('Sales');

  const save = (patch: Partial<BotConfigView>, ok = 'Saved.') => start(async () => {
    const r: any = await saveBotConfig(patch);
    setMsg(r?.error ? `Problem: ${r.error}` : ok);
  });
  const toggle = (on: boolean) => { setC({ ...c, enabled: on }); save({ enabled: on }, on ? 'The bot is ON: it answers new leads on the sales number.' : 'The bot is OFF.'); };
  const chat = (id: string, status: 'bot' | 'human' | 'off') => start(async () => { const r: any = await setBotChatStatus(id, status); setMsg(r?.error ? `Problem: ${r.error}` : 'Chat updated.'); });
  const addDevice = () => start(async () => { const r: any = await addSalesDevice(phone, label); setMsg(r?.error ? `Problem: ${r.error}` : 'Sales number saved. Copy its webhook link below into Fonnte.'); if (!r?.error) setPhone(''); });

  const handed = chats.filter((x) => x.status === 'human');
  return (
    <section className="space-y-4">
      {msg && <p className="rounded-md border border-zinc-700 bg-black/30 px-3 py-2 text-xs text-zinc-300">{msg}</p>}

      <div className={card}>
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">Sales number</h2>
        {devices.length === 0 && <p className="mt-2 text-xs text-zinc-400">No sales number yet. Enter it below after you connect it in Fonnte.</p>}
        <ul className="mt-2 space-y-2">
          {devices.map((d) => (
            <li key={d.phone} className="text-xs"><span className="text-zinc-300">{d.label || d.phone} (+{d.phone})</span>
              <code className="mt-1 block break-all rounded bg-black/40 p-2 text-[11px] text-emerald-300">{d.webhookUrl}</code>
              <span className="text-[11px] text-zinc-500">Paste this in Fonnte: this device, Edit, Webhook.</span></li>
          ))}
        </ul>
        {!tokenSet && <p className="mt-2 text-[11px] text-amber-300">The bot cannot send yet: <code>FONNTE_TOKEN_SALES</code> (the sales number&apos;s Fonnte token) is not set on the server.</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input className={input} placeholder="Sales number, 62..." value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className={input} placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className={btn} disabled={pending || !phone.trim()} onClick={addDevice}>Save sales number</button>
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">Auto-reply bot ({c.persona_name})</h2>
            <p className="mt-1 text-[11px] text-zinc-500">Answers a new lead&apos;s first message on the sales number, in a warm &quot;kak&quot; style, only from the script below. It stops as soon as a salesperson writes in the chat, after {c.max_replies} messages, or when the lead asks for a person, a price deal, a call or payment.</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-200">
            <input type="checkbox" checked={c.enabled} disabled={pending} onChange={(e) => toggle(e.target.checked)} /> {c.enabled ? 'ON' : 'OFF'}
          </label>
        </div>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-5">
          <label className="text-zinc-400">Name<input className={`${input} mt-1 w-full`} value={c.persona_name} onChange={(e) => setC({ ...c, persona_name: e.target.value })} /></label>
          <label className="text-zinc-400">Company<input className={`${input} mt-1 w-full`} value={c.company_name} onChange={(e) => setC({ ...c, company_name: e.target.value })} /></label>
          <label className="text-zinc-400">Team opens<input className={`${input} mt-1 w-full`} value={c.hours_from} onChange={(e) => setC({ ...c, hours_from: e.target.value })} /></label>
          <label className="text-zinc-400">Team closes<input className={`${input} mt-1 w-full`} value={c.hours_to} onChange={(e) => setC({ ...c, hours_to: e.target.value })} /></label>
          <label className="text-zinc-400">Bot messages per chat<input type="number" min={1} max={10} className={`${input} mt-1 w-full`} value={c.max_replies} onChange={(e) => setC({ ...c, max_replies: Number(e.target.value) })} /></label>
        </div>
        <label className="mt-3 block text-xs text-zinc-400">Script and knowledge (the bot answers only from this; lines starting with ISI: are blanks to fill)
          <textarea className={`${input} mt-1 h-72 w-full font-mono text-[11px] leading-relaxed`} value={c.knowledge} onChange={(e) => setC({ ...c, knowledge: e.target.value })} />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={btn} disabled={pending} onClick={() => save({ persona_name: c.persona_name, company_name: c.company_name, hours_from: c.hours_from, hours_to: c.hours_to, max_replies: c.max_replies, knowledge: c.knowledge })}>Save settings and script</button>
          <button className={ghost} disabled={pending} onClick={() => { if (!c.knowledge.trim() || confirm('Replace the script with the draft?')) setC({ ...c, knowledge: DEFAULT_BOT_KNOWLEDGE }); }}>Load the draft script</button>
        </div>
      </div>

      <div className={card}>
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#f5d77f]">Chats the bot has touched ({chats.length}) · need a person ({handed.length})</h2>
        {chats.length === 0 && <p className="mt-2 text-xs text-zinc-500">None yet.</p>}
        <ul className="mt-2 divide-y divide-zinc-800">
          {chats.map((x) => (
            <li key={x.group_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <div className="min-w-0">
                <span className="font-bold text-zinc-200">{x.name}</span>{' '}
                <span className={x.status === 'bot' ? 'text-emerald-300' : x.status === 'human' ? 'text-amber-300' : 'text-zinc-500'}>{x.status === 'bot' ? 'bot is answering' : x.status === 'human' ? 'with a salesperson' : 'bot off'}</span>
                <span className="text-zinc-500"> · {x.replies} bot msg · {when(x.updated_at)}</span>
                {x.reason && <div className="text-[11px] text-zinc-400">{x.reason}</div>}
                {x.lead && (x.lead.name || x.lead.store || x.lead.need) && <div className="text-[11px] text-zinc-400">{[x.lead.name, x.lead.store, x.lead.need].filter(Boolean).join(' · ')}</div>}
              </div>
              <div className="flex gap-2">
                {x.status !== 'human' && <button className={ghost} disabled={pending} onClick={() => chat(x.group_id, 'human')}>I take it</button>}
                {x.status !== 'bot' && <button className={ghost} disabled={pending} onClick={() => chat(x.group_id, 'bot')}>Give back to bot</button>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <details className={card}>
        <summary className="cursor-pointer text-xs font-extrabold uppercase tracking-wider text-zinc-400">What the bot said (latest {log.length})</summary>
        <ul className="mt-2 space-y-2">
          {log.map((l) => (
            <li key={l.id} className="text-xs">
              <div className="text-zinc-500">{when(l.created_at)} · {l.chat}{l.handoff ? ' · handed over' : ''}{l.ok ? '' : ' · FAILED'}</div>
              {l.in_reply_to && <div className="text-zinc-400">Lead: {l.in_reply_to}</div>}
              {l.reply ? <div className="text-zinc-100">Bot: {l.reply}</div> : <div className="text-red-300">{l.detail}</div>}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
