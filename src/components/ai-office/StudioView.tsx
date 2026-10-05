'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, ChevronRight, FolderOpen, Image as ImageIcon, Loader2, Play, RefreshCw, Send, Sparkles, X, XCircle } from 'lucide-react';

interface Setup { tables: boolean; driveEnv: boolean; driveConnected: boolean; driveEmail: string | null; geminiKey: boolean; imageModel: string }
interface Asset { id: string; product_id: string; kind: string; idx: number; prompt: string | null; status: 'queued' | 'running' | 'done' | 'failed'; attempts: number; drive_file_name: string | null; is_sample: boolean; cost_usd: number; qc_note: string | null; error: string | null }
interface Product { id: string; name: string; source_files: { id: string; name: string }[]; prompts: { images: string[]; video: string; description?: string } | null; is_sample: boolean; status: string; error: string | null }
interface Brief { product_summary: string; selling_points: string[]; message: string; tone: string; text_on_image: string; language: string; style: string; dos: string; donts: string }
interface Job {
  id: string; title: string; status: 'interview' | 'briefed' | 'sampling' | 'review' | 'generating' | 'done' | 'failed';
  interview: { role: 'producer' | 'owner'; text: string }[]; brief: Brief | null;
  input_folder_id: string | null; input_folder_name: string | null; output_folder_id: string | null; output_folder_name: string | null;
  research: string | null; feedback: string | null; error: string | null; products: Product[]; assets: Asset[]; cost: number;
}
interface State { setup: Setup; jobs: { id: string; title: string; status: string; created_at: string }[]; job: Job | null }

const field = 'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/50 focus:outline-none';
const btn = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50';
const btnGold = `${btn} border-[#d4af37] bg-[#d4af37] text-black hover:bg-[#e5c158]`;
const btnGhost = `${btn} border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500`;
const card = 'rounded-2xl border border-zinc-800 bg-[#0e0f14] p-4';
const usd = (n: number) => `$${n.toFixed(2)}`;

async function api(method: 'GET' | 'POST', body?: unknown, query = '') {
  const res = await fetch(`/api/ai-office/studio${query}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

const STATUS_LABEL: Record<string, string> = {
  interview: 'Interview', briefed: 'Brief ready', sampling: 'Making the sample', review: 'Sample waiting for you', generating: 'Making all images', done: 'Done', failed: 'Stopped',
};

/** Pick a folder in the owner's Google Drive. */
function FolderPicker({ title, onPick, onClose }: { title: string; onPick: (f: { id: string; name: string }) => void; onClose: () => void }) {
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [view, setView] = useState<{ folderId: string; name: string; folders: { id: string; name: string }[]; images: number } | null>(null);
  const [error, setError] = useState('');

  const open = useCallback(async (id: string, push?: { id: string; name: string }) => {
    setError('');
    try {
      const v = await api('POST', { action: 'browse', folderId: id });
      setView(v);
      setTrail((t) => (push ? [...t, push] : id === 'root' ? [] : t));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { open('root'); }, [open]);

  const goTo = (i: number) => {
    const next = trail.slice(0, i + 1);
    setTrail(next);
    open(next[next.length - 1].id);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[#d4af37]/20 bg-[#0b0c10]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <h3 className="font-bold text-zinc-100">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 px-4 py-2 text-xs text-zinc-400">
          <button onClick={() => { setTrail([]); open('root'); }} className="hover:text-white">My Drive</button>
          {trail.map((t, i) => (
            <span key={t.id} className="flex items-center gap-1"><ChevronRight className="h-3 w-3" /><button onClick={() => goTo(i)} className="hover:text-white">{t.name}</button></span>
          ))}
        </div>
        <div className="min-h-[200px] flex-1 overflow-y-auto p-2">
          {error && <p className="m-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">{error}</p>}
          {!view && !error && <div className="flex justify-center p-8 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {view?.folders.length === 0 && <p className="p-4 text-xs text-zinc-500">No folders inside.</p>}
          {view?.folders.map((f) => (
            <button key={f.id} onClick={() => open(f.id, f)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800/60">
              <FolderOpen className="h-4 w-4 text-[#d4af37]" /> {f.name}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 p-4">
          <span className="text-xs text-zinc-500">{view ? `${view.name} · ${view.images} photo${view.images === 1 ? '' : 's'} directly inside` : ''}</span>
          <button disabled={!view || view.folderId === 'root'} onClick={() => view && onPick({ id: view.folderId, name: view.name })} className={btnGold}>
            <Check className="h-3.5 w-3.5" /> Use this folder
          </button>
        </div>
      </div>
    </div>
  );
}

function SetupCard({ setup }: { setup: Setup }) {
  const row = (ok: boolean, label: string, hint?: string) => (
    <div className="flex items-start gap-2 text-xs">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
      <div><span className={ok ? 'text-zinc-300' : 'text-zinc-100'}>{label}</span>{!ok && hint && <div className="text-[11px] text-zinc-500">{hint}</div>}</div>
    </div>
  );
  return (
    <div className={`${card} space-y-2.5`}>
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Setup</h3>
      {row(setup.tables, 'Database tables', 'Run supabase/migrations/20261008_ai_studio.sql in Supabase.')}
      {row(setup.geminiKey, `Gemini key (${setup.imageModel})`, 'Set GEMINI_API_KEY in Vercel. The Google project needs billing for the image model.')}
      {row(setup.driveEnv, 'Google sign-in keys', 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel (Google Cloud > Credentials > OAuth client, redirect: /api/ai-office/drive/callback).')}
      <div className="flex flex-wrap items-center gap-3">
        {row(setup.driveConnected, setup.driveConnected ? `Google Drive connected${setup.driveEmail ? ` as ${setup.driveEmail}` : ''}` : 'Google Drive is not connected')}
        {setup.driveEnv && (
          <a href="/api/ai-office/drive/connect" className={btnGhost}>{setup.driveConnected ? 'Reconnect' : 'Connect Google Drive'}</a>
        )}
      </div>
    </div>
  );
}

export function StudioView() {
  const [state, setState] = useState<State | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const [picking, setPicking] = useState<'input' | 'output' | null>(null);
  const [folders, setFolders] = useState<{ input: { id: string; name: string } | null; output: { id: string; name: string } | null }>({ input: null, output: null });
  const ticking = useRef(false);

  const load = useCallback(async (id?: string | null) => {
    try {
      const s: State = await api('GET', undefined, id ? `?jobId=${id}` : '');
      setState(s);
      setJobId(s.job?.id || null);
      setError('');
      return s;
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const job = state?.job || null;

  /** Runs one action, then reloads. */
  const act = async (label: string, body: Record<string, unknown>, after?: (r: any) => void) => {
    setBusy(label);
    setError('');
    try {
      const r = await api('POST', body);
      after?.(r);
      await load(r.jobId || jobId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  // While the studio works, call tick again and again (one short step per call).
  useEffect(() => {
    if (!job || !['sampling', 'generating'].includes(job.status) || ticking.current) return;
    ticking.current = true;
    let alive = true;
    (async () => {
      while (alive) {
        try {
          const r = await api('POST', { action: 'tick' });
          const s = await load(job.id);
          if (!r.active || !s?.job || !['sampling', 'generating'].includes(s.job.status)) break;
        } catch (e: any) {
          setError(e.message);
          break;
        }
        await new Promise((res) => setTimeout(res, 800));
      }
      ticking.current = false;
    })();
    return () => { alive = false; ticking.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status]);

  if (!state && !error) return <div className="flex justify-center p-16 text-zinc-500"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const setup = state?.setup;
  const ready = Boolean(setup?.tables && setup.driveConnected && setup.geminiKey);

  const sampleProduct = job?.products.find((p) => p.is_sample) || job?.products[0];
  const assetsOf = (pid: string) => (job?.assets || []).filter((a) => a.product_id === pid && a.kind === 'image').sort((a, b) => a.idx - b.idx);
  const done = (job?.assets || []).filter((a) => a.status === 'done').length;
  const failed = (job?.assets || []).filter((a) => a.status === 'failed').length;
  const total = (job?.assets || []).length;

  const Thumb = ({ a }: { a: Asset }) => (
    <div className="space-y-1">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
        {a.status === 'done' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/ai-office/studio/file?assetId=${a.id}`} alt={a.drive_file_name || 'Generated image'} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] text-zinc-500">
            {a.status === 'failed' ? <XCircle className="h-5 w-5 text-red-400" /> : <Loader2 className="h-5 w-5 animate-spin" />}
            {a.status === 'failed' ? 'Failed' : a.status === 'running' ? 'Making...' : 'Waiting'}
          </div>
        )}
      </div>
      {(a.qc_note || a.error) && <div className={`text-[10px] leading-snug ${a.error ? 'text-red-300' : 'text-zinc-500'}`}>{a.error || a.qc_note}</div>}
    </div>
  );

  return (
    <div className="space-y-5">
      {error && <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}</div>}
      {setup && !ready && <SetupCard setup={setup} />}

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* ---- jobs ---- */}
        <div className="space-y-3">
          <div className={`${card} space-y-2`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">New marketing job</h3>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Skincare October batch" className={field} />
            <button
              disabled={!ready || busy !== '' || title.trim().length < 2}
              onClick={() => act('create', { action: 'create', title }, () => setTitle(''))}
              className={`${btnGold} w-full justify-center`}
            >
              {busy === 'create' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Start interview
            </button>
            {!ready && <p className="text-[10px] text-zinc-500">Finish the setup above first.</p>}
          </div>
          <div className="space-y-1.5">
            {(state?.jobs || []).map((j) => (
              <button key={j.id} onClick={() => load(j.id)} className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${j.id === jobId ? 'border-[#d4af37]/40 bg-[#d4af37]/10' : 'border-zinc-800 bg-[#0e0f14] hover:border-zinc-600'}`}>
                <div className="truncate font-semibold text-zinc-100">{j.title}</div>
                <div className="text-[10px] text-zinc-500">{STATUS_LABEL[j.status] || j.status}</div>
              </button>
            ))}
          </div>
          {setup && ready && <div className="text-[10px] text-zinc-600">Drive: {setup.driveEmail || 'connected'} · Images: {setup.imageModel}</div>}
        </div>

        {/* ---- the job ---- */}
        <div className="space-y-4">
          {!job && <div className={`${card} text-sm text-zinc-400`}>Start an interview. Mira, the Producer, asks about the product and the message, then you pick the Google Drive folders, approve one sample, and the team makes every image.</div>}

          {job && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif text-lg font-extrabold text-zinc-100">{job.title}</h2>
                <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                  <span className="rounded-full border border-zinc-700 px-2 py-0.5">{STATUS_LABEL[job.status]}</span>
                  {total > 0 && <span>{done}/{total} pictures · {usd(job.cost)}</span>}
                </div>
              </div>

              {/* interview */}
              {['interview', 'briefed'].includes(job.status) && (
                <div className={`${card} space-y-3`}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">1. Interview with Mira</h3>
                  <div className="max-h-[360px] space-y-2 overflow-y-auto">
                    {job.interview.map((m, i) => (
                      <div key={i} className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${m.role === 'owner' ? 'ml-auto bg-[#d4af37]/15 text-zinc-100' : 'bg-zinc-900 text-zinc-200'}`}>{m.text}</div>
                    ))}
                    {busy === 'interview' && <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Mira is typing...</div>}
                  </div>
                  <div className="flex gap-2">
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Answer Mira (or correct the brief)" className={`${field} flex-1`} />
                    <button disabled={busy !== '' || message.trim().length < 1} onClick={() => act('interview', { action: 'interview', jobId: job.id, message }, () => setMessage(''))} className={btnGold}><Send className="h-3.5 w-3.5" /></button>
                  </div>
                  {job.brief && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-zinc-300">
                      <div className="mb-1 font-bold uppercase tracking-wider text-emerald-300">Brief</div>
                      <div><b>Product:</b> {job.brief.product_summary}</div>
                      <div><b>Selling points:</b> {job.brief.selling_points.join(' · ')}</div>
                      <div><b>Message:</b> {job.brief.message}</div>
                      <div><b>Tone / style:</b> {job.brief.tone} · {job.brief.style}</div>
                      <div><b>Text on image:</b> {job.brief.text_on_image} ({job.brief.language})</div>
                      {(job.brief.dos || job.brief.donts) && <div><b>Do:</b> {job.brief.dos || '-'} · <b>Don&apos;t:</b> {job.brief.donts || '-'}</div>}
                    </div>
                  )}
                </div>
              )}

              {/* folders + products */}
              {job.status === 'briefed' && (
                <div className={`${card} space-y-3`}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">2. Google Drive folders</h3>
                  <p className="text-[11px] text-zinc-500">Input folder: one subfolder per product with its photos inside (or one photo per product). Output folder: the Studio creates one folder per product there.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(['input', 'output'] as const).map((k) => {
                      const chosen = folders[k] || (k === 'input' ? (job.input_folder_id ? { id: job.input_folder_id, name: job.input_folder_name || '' } : null) : (job.output_folder_id ? { id: job.output_folder_id, name: job.output_folder_name || '' } : null));
                      return (
                        <button key={k} onClick={() => setPicking(k)} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-left text-sm hover:border-zinc-600">
                          <FolderOpen className="h-4 w-4 shrink-0 text-[#d4af37]" />
                          <span className="min-w-0"><span className="block text-[10px] uppercase tracking-wider text-zinc-500">{k === 'input' ? 'Product photos (input)' : 'Results (output)'}</span><span className="block truncate text-zinc-100">{chosen?.name || 'Choose a folder'}</span></span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    disabled={busy !== '' || !(folders.input || job.input_folder_id) || !(folders.output || job.output_folder_id)}
                    onClick={() => act('folders', {
                      action: 'folders', jobId: job.id,
                      input: folders.input || { id: job.input_folder_id, name: job.input_folder_name },
                      output: folders.output || { id: job.output_folder_id, name: job.output_folder_name },
                    })}
                    className={btnGhost}
                  >
                    {busy === 'folders' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Read the product photos
                  </button>

                  {job.products.length > 0 && (
                    <>
                      <div className="text-xs text-zinc-400">{job.products.length} product{job.products.length === 1 ? '' : 's'} found. Choose the one to use as the <b>sample</b>:</div>
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {job.products.map((p) => (
                          <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-zinc-200 hover:bg-zinc-900">
                            <input type="radio" name="sample" checked={p.is_sample} onChange={() => act('pick', { action: 'sample-product', jobId: job.id, productId: p.id })} className="accent-[#d4af37]" />
                            {p.name} <span className="text-[10px] text-zinc-500">{p.source_files.length} photo{p.source_files.length === 1 ? '' : 's'}</span>
                          </label>
                        ))}
                      </div>
                      <button disabled={busy !== ''} onClick={() => act('start', { action: 'start', jobId: job.id })} className={btnGold}>
                        <Play className="h-3.5 w-3.5" /> Make the sample
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* working */}
              {['sampling', 'generating'].includes(job.status) && (
                <div className={`${card} space-y-2`}>
                  <div className="flex items-center gap-2 text-sm text-zinc-200"><Loader2 className="h-4 w-4 animate-spin text-[#d4af37]" /> {job.status === 'sampling' ? 'Making the sample' : 'Making all images'}...</div>
                  <p className="text-[11px] text-zinc-500">{!job.research ? 'Rune is researching the market.' : total === 0 ? 'Pax is writing the prompts from the product photo.' : `${done} of ${total} pictures made. Ada checks every picture against the real product. Keep this page open.`}</p>
                  {total > 0 && <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-[#d4af37] transition-all" style={{ width: `${Math.round(((done + failed) / total) * 100)}%` }} /></div>}
                </div>
              )}

              {/* review */}
              {job.status === 'review' && sampleProduct && (
                <div className={`${card} space-y-3`}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">3. Sample: {sampleProduct.name}</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{assetsOf(sampleProduct.id).map((a) => <Thumb key={a.id} a={a} />)}</div>
                  {sampleProduct.prompts && (
                    <details className="text-xs text-zinc-400">
                      <summary className="cursor-pointer font-semibold text-zinc-300">Prompts Pax wrote (5 images and the video idea)</summary>
                      <ol className="mt-2 list-decimal space-y-1.5 pl-5">{sampleProduct.prompts.images.map((p, i) => <li key={i}>{p}</li>)}</ol>
                      <p className="mt-2"><b className="text-zinc-300">Video prompt (not generated yet):</b> {sampleProduct.prompts.video}</p>
                    </details>
                  )}
                  <p className="text-[11px] text-zinc-500">
                    The sample shows the first 2 of 5 pictures. When you approve, the Studio makes the remaining 3 for this product and all 5 for the other {Math.max(0, job.products.length - 1)} product(s), and saves them into <b>{job.output_folder_name}</b>. About {usd(0.04 * (job.products.length * 5 - 2))} for the pictures.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button disabled={busy !== ''} onClick={() => act('approve', { action: 'approve', jobId: job.id })} className={btnGold}><Check className="h-3.5 w-3.5" /> Approve, make everything</button>
                  </div>
                  <div className="flex gap-2">
                    <input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Not right? Say what to change (background, mood, props...)" className={`${field} flex-1`} />
                    <button disabled={busy !== '' || feedback.trim().length < 3} onClick={() => act('revise', { action: 'revise', jobId: job.id, feedback }, () => setFeedback(''))} className={btnGhost}>Redo the sample</button>
                  </div>
                </div>
              )}

              {/* results */}
              {['generating', 'done', 'failed'].includes(job.status) && total > 0 && (
                <div className={`${card} space-y-4`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">{job.status === 'done' ? 'Done: saved in Google Drive' : 'Pictures'} · {job.output_folder_name}</h3>
                    {failed > 0 && <button disabled={busy !== ''} onClick={() => act('resume', { action: 'resume', jobId: job.id })} className={btnGhost}><RefreshCw className="h-3.5 w-3.5" /> Retry {failed} failed</button>}
                  </div>
                  {job.products.map((p) => (
                    <div key={p.id}>
                      <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-200"><ImageIcon className="h-4 w-4 text-[#d4af37]" /> {p.name} {p.error && <span className="text-[10px] font-normal text-red-300">{p.error}</span>}</div>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{assetsOf(p.id).map((a) => <Thumb key={a.id} a={a} />)}</div>
                    </div>
                  ))}
                  <p className="text-[11px] text-zinc-500">Video is the next step: the video idea for each product is written already (see the prompts in the sample), but no video is generated yet.</p>
                </div>
              )}

              {job.status === 'failed' && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  The Studio stopped: {job.error || 'unknown error'}
                  <div className="mt-2"><button disabled={busy !== ''} onClick={() => act('resume', { action: 'resume', jobId: job.id })} className={btnGhost}><RefreshCw className="h-3.5 w-3.5" /> Try again</button></div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {picking && (
        <FolderPicker
          title={picking === 'input' ? 'Choose the folder with the product photos' : 'Choose the folder for the results'}
          onClose={() => setPicking(null)}
          onPick={(f) => { setFolders((s) => ({ ...s, [picking]: f })); setPicking(null); }}
        />
      )}
    </div>
  );
}
