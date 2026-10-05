'use client';

import React, { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, Clock, ImagePlus, Search, X } from 'lucide-react';
import { createVisit } from '@/app/actions/planner';
import { compressImage } from '@/lib/advertiser/screenshots';

export interface LeadChoice {
  id: string;
  client: string;
  title: string;
  stage: string;
}

const STAGES = ['All', 'Lead', 'Contacted', 'Negotiation', 'Invoice', 'Deal', 'Cold Case'];
const field = 'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-[#d4af37]/60 focus:outline-none';
const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400';

/** Local "YYYY-MM-DDTHH:mm" for the date-time input. */
const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function PhotoPicker({ title, hint, value, onChange }: { title: string; hint: string; value: string | null; onChange: (v: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await compressImage(file));
    } catch {
      onChange(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <span className={label}>{title}</span>
      {/* capture="environment" opens the rear camera on a phone; on a computer it is a normal file picker */}
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={title} className="h-36 w-full min-w-[160px] rounded-xl border border-zinc-700 object-cover" />
          <button type="button" onClick={() => onChange(null)} aria-label="Remove photo" className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-700 text-zinc-400 hover:border-[#d4af37]/60 hover:text-[#f5d77f]">
          {busy ? <span className="text-xs">Preparing photo...</span> : (<><Camera className="h-7 w-7" /><span className="text-xs font-semibold">Take a photo</span><span className="text-[10px] text-zinc-600">{hint}</span></>)}
        </button>
      )}
    </div>
  );
}

/** The "Picture with Leads" button and its form. */
export function PictureWithLeads({ leads, variant = 'button' }: { leads: LeadChoice[]; variant?: 'button' | 'wide' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('All');
  const [dealId, setDealId] = useState('');
  const [agenda, setAgenda] = useState('');
  const [when, setWhen] = useState(localNow);
  const [clientPhoto, setClientPhoto] = useState<string | null>(null);
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => (stage === 'All' || l.stage === stage) && (!q || `${l.client} ${l.title}`.toLowerCase().includes(q)));
  }, [leads, search, stage]);
  const picked = leads.find((l) => l.id === dealId);
  const future = new Date(when).getTime() > Date.now() + 5 * 60000;

  const reset = () => {
    setSearch(''); setStage('All'); setDealId(''); setAgenda(''); setWhen(localNow()); setClientPhoto(null); setReceiptPhoto(null); setError(''); setDone(false);
  };
  const close = () => { setOpen(false); reset(); };

  const submit = () =>
    start(async () => {
      setError('');
      const res = await createVisit({ deal_id: dealId, agenda, visit_at: new Date(when).toISOString(), client_photo: clientPhoto, receipt_photo: receiptPhoto });
      if (!res.success) return setError(res.error);
      setDone(true);
      router.refresh();
    });

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className={variant === 'wide'
          ? 'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f5d77f] px-4 py-2.5 text-sm font-extrabold text-black shadow-[0_6px_22px_rgba(212,175,55,0.35)] hover:brightness-110'
          : 'inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#d4af37] to-[#f5d77f] px-4 py-2 text-xs font-extrabold text-black shadow-[0_6px_22px_rgba(212,175,55,0.35)] hover:brightness-110'}
      >
        <Camera className="h-4 w-4" /> Picture with Leads
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={close}>
          <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[#d4af37]/25 bg-[#0e0f14] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-5 py-4 backdrop-blur">
              <div>
                <h2 className="font-serif text-lg font-bold text-zinc-100">Picture with Leads</h2>
                <p className="text-xs text-zinc-500">Log a meeting: who, what, when, and the proof.</p>
              </div>
              <button onClick={close} aria-label="Close" className="text-zinc-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            {done ? (
              <div className="space-y-4 p-10 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                <p className="text-lg font-bold text-zinc-100">Meeting saved</p>
                <p className="text-sm text-zinc-400">It is now in your Meeting Schedule.</p>
                <button onClick={close} className="rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f5d77f] px-6 py-2.5 text-sm font-bold text-black">Done</button>
              </div>
            ) : (
              <div className="space-y-5 p-5">
                {/* 1. the lead */}
                <div>
                  <span className={label}>Lead *</span>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the lead or client..." className={`${field} pl-9`} />
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {STAGES.map((s) => (
                      <button key={s} type="button" onClick={() => setStage(s)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stage === s ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#f5d77f]' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>{s}</button>
                    ))}
                  </div>
                  <div className="max-h-44 divide-y divide-zinc-900 overflow-y-auto rounded-xl border border-zinc-800">
                    {shown.length === 0 && <p className="p-4 text-center text-xs text-zinc-600">{leads.length === 0 ? 'No leads yet. Add one in Sales → Pipeline first.' : 'No lead matches.'}</p>}
                    {shown.map((l) => (
                      <button key={l.id} type="button" onClick={() => setDealId(l.id)} className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left ${dealId === l.id ? 'bg-[#d4af37]/15' : 'hover:bg-zinc-900'}`}>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-zinc-100">{l.client}</span>
                          <span className="block truncate text-[11px] text-zinc-500">{l.title}</span>
                        </span>
                        <span className="shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">{l.stage}</span>
                      </button>
                    ))}
                  </div>
                  {picked && <p className="mt-1.5 text-xs text-emerald-300">Selected: {picked.client}</p>}
                </div>

                {/* 2. agenda + time stamp */}
                <div>
                  <label className={label} htmlFor="pwl-agenda">Agenda of the meeting *</label>
                  <textarea id="pwl-agenda" value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} placeholder="What was discussed or what will be discussed..." className={field} />
                </div>
                <div>
                  <label className={label} htmlFor="pwl-when">Date and time</label>
                  <input id="pwl-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${field} [color-scheme:dark]`} />
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500"><Clock className="h-3.5 w-3.5" /> {future ? 'In the future: saved as a planned meeting, photos can wait.' : 'Time stamp of the meeting. Both photos are required.'}</p>
                </div>

                {/* 3. proof */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <PhotoPicker title={`Photo with the client${future ? '' : ' *'}`} hint="You and the client" value={clientPhoto} onChange={setClientPhoto} />
                  <PhotoPicker title={`Photo of the receipt${future ? '' : ' *'}`} hint="The nota / receipt" value={receiptPhoto} onChange={setReceiptPhoto} />
                </div>

                {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
                <button onClick={submit} disabled={pending || !dealId || !agenda.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f5d77f] py-3 text-sm font-extrabold text-black disabled:opacity-40">
                  <ImagePlus className="h-4 w-4" /> {pending ? 'Saving...' : future ? 'Plan the meeting' : 'Save the meeting'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
