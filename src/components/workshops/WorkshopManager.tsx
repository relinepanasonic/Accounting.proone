'use client';

// Create / edit / delete Kampus Online workshop events (founder + superadmins).
// The public site (profesoronline.id/kampus/...) reads the next upcoming PUBLISHED event from this table with the anon key,
// so saving here is all it takes. Row rules (migration 20261011) enforce who may write. All times are WIB (Asia/Jakarta, +07:00).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Ev = {
  id: string; title: string; starts_at: string; mode: 'offline' | 'online';
  place: string; address: string; city: string; seats_total: number; seats_taken: number; published: boolean;
};
type Form = {
  id: string | null; title: string; date: string; time: string; mode: 'offline' | 'online';
  place: string; address: string; city: string; seats_total: string; seats_taken: string; published: boolean;
};

const DEFAULT_TITLE = 'Kampus Online: Bosan Boncos, Belajar untuk Cuan';
const blank = (date = ''): Form => ({
  id: null, title: DEFAULT_TITLE, date, time: '12:00', mode: 'online',
  place: '', address: '', city: '', seats_total: '30', seats_taken: '0', published: true,
});

const TZ = 'Asia/Jakarta';
// "2026-11-21" / "12:00" in WIB for a stored instant
const wibParts = (iso: string) => {
  const s = new Date(iso).toLocaleString('sv-SE', { timeZone: TZ }); // "2026-11-21 12:00:00"
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
};
const fmtLong = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';
const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const field = 'w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none [color-scheme:dark]';
const label = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500';

export function WorkshopManager() {
  const [supabase] = useState(() => createClient());
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(blank());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [cal, setCal] = useState<{ y: number; m: number } | null>(null); // m: 0-11
  const [todayStr, setTodayStr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('workshop_events').select('*').order('starts_at', { ascending: false });
    if (error) setMsg(`✗ ${error.code === 'PGRST205' || error.code === '42P01' ? 'The workshop table is missing. Run supabase/migrations/20261011_workshop_events.sql in the ERP Supabase project.' : error.message}`);
    setEvents((data as Ev[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // "today" is only known in the browser (WIB), so it cannot be initial state
    const t = wibParts(new Date().toISOString()).date;
    setTodayStr(t);
    setCal({ y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 });
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const map: Record<string, Ev[]> = {};
    events.forEach((e) => { (map[wibParts(e.starts_at).date] ||= []).push(e); });
    return map;
  }, [events]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setMsg('');
    const total = Number(form.seats_total), taken = Number(form.seats_taken);
    if (!form.title.trim()) return setMsg('✗ Workshop title is required.');
    if (!form.date || !form.time) return setMsg('✗ Pick a date and time.');
    if (!(total > 0)) return setMsg('✗ Total seats must be more than 0.');
    if (!(taken >= 0)) return setMsg("✗ Seats taken can't be negative.");
    if (form.mode === 'offline' && !form.place.trim() && !form.address.trim()) return setMsg('✗ An offline workshop needs a place or an address.');
    const row = {
      title: form.title.trim(),
      starts_at: new Date(`${form.date}T${form.time}:00+07:00`).toISOString(),
      mode: form.mode,
      place: form.place.trim(), address: form.address.trim(), city: form.city.trim(),
      seats_total: total, seats_taken: taken, published: form.published,
      updated_at: new Date().toISOString(),
    };
    setBusy(true);
    const { data, error } = form.id
      ? await supabase.from('workshop_events').update(row).eq('id', form.id).select('id')
      : await supabase.from('workshop_events').insert(row).select('id');
    setBusy(false);
    if (error) return setMsg(`✗ ${error.message}`);
    // Row rules hide a row you may not write: nothing changed and there is no error.
    if (!data || data.length === 0) return setMsg('✗ Nothing was saved. Only the founder and superadmins can change workshops.');
    setMsg(form.id ? '✓ Event updated. The website shows it now.' : '✓ Event created. The website shows it now.');
    setForm(blank());
    load();
  }

  function edit(e: Ev) {
    const { date, time } = wibParts(e.starts_at);
    setForm({ id: e.id, title: e.title, date, time, mode: e.mode, place: e.place, address: e.address, city: e.city, seats_total: String(e.seats_total), seats_taken: String(e.seats_taken), published: e.published });
    setMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(e: Ev) {
    if (!window.confirm(`Delete "${e.title}" on ${fmtLong(e.starts_at)}? This cannot be undone.`)) return;
    const { data, error } = await supabase.from('workshop_events').delete().eq('id', e.id).select('id');
    if (error) setMsg(`✗ ${error.message}`);
    else if (!data || data.length === 0) setMsg('✗ Nothing was deleted. Only the founder and superadmins can change workshops.');
    else { if (form.id === e.id) setForm(blank()); load(); }
  }

  if (loading || !cal) return <div className="flex justify-center p-16 text-zinc-500"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  // calendar grid (weeks start Monday)
  const first = new Date(Date.UTC(cal.y, cal.m, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(cal.y, cal.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const shiftMonth = (d: number) => setCal((c) => {
    const n = (c as { y: number; m: number }).m + d;
    return { y: (c as { y: number }).y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
  });

  const nowIso = new Date().toISOString();
  const upcoming = events.filter((e) => e.starts_at >= nowIso).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = events.filter((e) => e.starts_at < nowIso);

  const rows = (list: Ev[], empty: string) => (
    <tbody className="divide-y divide-zinc-800/50">
      {list.map((e) => (
        <tr key={e.id} className="hover:bg-zinc-900/30">
          <td className="whitespace-nowrap px-3 py-3 text-zinc-200">{fmtLong(e.starts_at)}</td>
          <td className="px-3 py-3 text-zinc-100">{e.title}{!e.published && <span className="ml-2 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">hidden</span>}</td>
          <td className="px-3 py-3 text-zinc-300">
            {e.mode === 'offline' ? 'Offline' : 'Online'}
            {(e.place || e.city) && <div className="text-[11px] text-zinc-500">{(e.mode === 'offline' ? [e.place, e.city] : [e.place]).filter(Boolean).join(', ')}</div>}
          </td>
          <td className="px-3 py-3 text-right font-mono text-zinc-200">{e.seats_taken}/{e.seats_total}</td>
          <td className="whitespace-nowrap px-3 py-3 text-right">
            <button onClick={() => edit(e)} className="mr-1 inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-bold text-zinc-300 hover:border-zinc-500"><Pencil className="h-3 w-3" /> Edit</button>
            <button onClick={() => remove(e)} className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-500 hover:text-red-400"><Trash2 className="h-3 w-3" /> Delete</button>
          </td>
        </tr>
      ))}
      {!list.length && <tr><td colSpan={5} className="p-6 text-center text-sm text-zinc-500">{empty}</td></tr>}
    </tbody>
  );

  const head = (
    <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[11px] uppercase tracking-wider text-zinc-400">
      <tr><th className="px-3 py-3 font-bold">When</th><th className="px-3 py-3 font-bold">Title</th><th className="px-3 py-3 font-bold">Format</th><th className="px-3 py-3 text-right font-bold">Seats</th><th /></tr>
    </thead>
  );

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`rounded-xl border px-4 py-2.5 text-sm ${msg.startsWith('✓') ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>{msg}</div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {/* Mini calendar */}
        <div className="gold-glass-panel rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
            <h3 className="font-serif text-base font-extrabold text-zinc-100">{MONTHS[cal.m]} {cal.y}</h3>
            <button onClick={() => shiftMonth(1)} aria-label="Next month" className="rounded-lg border border-zinc-800 p-1.5 text-zinc-400 hover:text-white"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] text-zinc-500">
            {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d == null) return <div key={i} />;
              const ds = `${cal.y}-${pad(cal.m + 1)}-${pad(d)}`;
              const has = byDay[ds]?.length;
              const selected = form.date === ds;
              const isToday = ds === todayStr;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => set('date', ds)}
                  title={has ? byDay[ds].map((e) => e.title).join(' / ') : undefined}
                  className={`relative rounded-lg py-2 text-sm transition-colors ${
                    selected ? 'bg-gradient-to-br from-[#d4af37] to-[#f5d77f] font-extrabold text-black' : has ? 'bg-[#d4af37]/20 font-bold text-zinc-100' : 'bg-white/[0.04] text-zinc-300 hover:bg-white/10'
                  } ${isToday ? 'ring-1 ring-[#d4af37]' : ''}`}
                >
                  {d}
                  {has ? <span className={`absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${selected ? 'bg-black' : 'bg-[#d4af37]'}`} /> : null}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">Click a day to pick the date. Gold dots are days that already have a workshop.</p>
        </div>

        {/* Form */}
        <div className="gold-glass-panel space-y-3 rounded-2xl p-5">
          <h3 className="flex items-center gap-2 font-serif text-base font-extrabold text-zinc-100">
            {form.id ? <Pencil className="h-4 w-4 text-[#d4af37]" /> : <Plus className="h-4 w-4 text-[#d4af37]" />} {form.id ? 'Edit workshop' : 'New workshop'}
          </h3>
          <div><label className={label}>Workshop title</label><input value={form.title} onChange={(e) => set('title', e.target.value)} className={field} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => {
                  set('date', e.target.value);
                  if (e.target.value) setCal({ y: Number(e.target.value.slice(0, 4)), m: Number(e.target.value.slice(5, 7)) - 1 });
                }}
                className={field}
              />
            </div>
            <div><label className={label}>Time (WIB)</label><input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} className={field} /></div>
          </div>
          <div>
            <label className={label}>Format</label>
            <div className="flex gap-2">
              {([['offline', 'Offline Workshop'], ['online', 'Online Webinar']] as const).map(([v, text]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('mode', v)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold ${form.mode === v ? 'border-[#d4af37] bg-[#d4af37] text-black' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'}`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={label}>{form.mode === 'offline' ? 'Place (venue name)' : 'Platform (e.g. Zoom)'}</label>
            <input value={form.place} onChange={(e) => set('place', e.target.value)} placeholder={form.mode === 'offline' ? 'e.g. Hotel Santika' : 'e.g. Zoom'} className={field} />
          </div>
          {form.mode === 'offline' && (
            <>
              <div><label className={label}>Address</label><input value={form.address} onChange={(e) => set('address', e.target.value)} className={field} /></div>
              <div><label className={label}>City</label><input value={form.city} onChange={(e) => set('city', e.target.value)} className={field} /></div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Total seats</label><input type="number" min={1} value={form.seats_total} onChange={(e) => set('seats_total', e.target.value)} className={field} /></div>
            <div><label className={label}>Seats taken</label><input type="number" min={0} value={form.seats_taken} onChange={(e) => set('seats_taken', e.target.value)} className={field} /></div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} className="accent-[#d4af37]" /> Show on the website
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f5d77f] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-black hover:opacity-90 disabled:opacity-50">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {form.id ? 'Save changes' : 'Create workshop'}
            </button>
            {form.id && <button onClick={() => { setForm(blank()); setMsg(''); }} className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-300 hover:border-zinc-500">Cancel</button>}
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            The website always shows the <b className="text-zinc-300">next upcoming</b> published workshop (countdown, seats and the WhatsApp message). &quot;Seats taken&quot; is a number you update by hand as people confirm.
          </p>
        </div>
      </div>

      <div className="gold-glass-panel rounded-2xl p-5">
        <h3 className="mb-3 font-serif text-base font-extrabold text-zinc-100">Upcoming <span className="text-xs font-normal text-zinc-500">({upcoming.length})</span></h3>
        <div className="overflow-x-auto rounded-xl border border-zinc-800"><table className="w-full text-left text-sm">{head}{rows(upcoming, 'No upcoming workshop. The website will say "schedule coming soon".')}</table></div>
      </div>

      <div className="gold-glass-panel rounded-2xl p-5">
        <h3 className="mb-3 font-serif text-base font-extrabold text-zinc-100">Past <span className="text-xs font-normal text-zinc-500">({past.length})</span></h3>
        <div className="max-h-80 overflow-auto rounded-xl border border-zinc-800"><table className="w-full text-left text-sm">{head}{rows(past, 'Nothing yet.')}</table></div>
      </div>
    </div>
  );
}

export const WorkshopsHeading = () => (
  <h1 className="flex items-center gap-2 font-serif text-2xl font-extrabold text-zinc-100"><CalendarDays className="h-6 w-6 text-[#d4af37]" /> Workshops</h1>
);
