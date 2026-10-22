'use client';

import React, { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, ImageIcon, X, Check, RotateCcw } from 'lucide-react';
import { SortArrows } from '@/components/ui/SortArrows';
import { RupiahInput } from '@/components/ui/RupiahInput';
import {
  addFakeOrder, deleteFakeOrder, createFakeOrderProject, finishFakeOrderProject, reopenFakeOrderProject, deleteFakeOrderProject,
  type FakeOrderRow, type FakeOrderProject,
} from '@/app/actions/fake-orders';
import type { ProjectCandidate } from '@/lib/admin/fake-order-data';

const field = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d4af37]/60 focus:outline-none';
const lab = 'text-[10px] font-bold uppercase tracking-wider text-zinc-500';
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const dmy = (iso: string) => (iso ? `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : '-');
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const daysBetween = (a: string, b: string) => Math.max(0, Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000));

type PSort = 'client' | 'product' | 'start' | 'orders' | 'total';
type OSort = 'client' | 'orderNo' | 'buyer' | 'total';

/** Friends Order. Active: the running projects (a client invoice with Friends Order / Paket Optimize Shopee New Store, start date by hand) and their fake orders. Finished: the ended ones. */
export function FakeOrderBoard({ mode, projects, orders, candidates, migrationMissing }: { mode: 'active' | 'finished'; projects: FakeOrderProject[]; orders: FakeOrderRow[]; candidates: ProjectCandidate[]; migrationMissing: boolean }) {
  const router = useRouter();
  const orderForm = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [showProject, setShowProject] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [cand, setCand] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [projectFilter, setProjectFilter] = useState('');
  const [search, setSearch] = useState('');
  const [proofView, setProofView] = useState('');
  const [totalInput, setTotalInput] = useState<number>(0);
  // The order goes to the project chosen in the filter (or the only running project).
  const targetProject = projectFilter || (projects.length === 1 ? projects[0].id : '');
  const [psort, setPsort] = useState<{ key: PSort; asc: boolean }>({ key: 'start', asc: false });
  const [osort, setOsort] = useState<{ key: OSort; asc: boolean }>({ key: 'client', asc: true });
  const active = mode === 'active';

  const stats = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    for (const o of orders) { const s = m.get(o.projectId || '') || { count: 0, total: 0 }; s.count++; s.total += o.total; m.set(o.projectId || '', s); }
    return m;
  }, [orders]);

  const sortedProjects = useMemo(() => {
    const val = (p: FakeOrderProject): string | number =>
      psort.key === 'client' ? p.clientName.toLowerCase() : psort.key === 'product' ? p.productName.toLowerCase() : psort.key === 'start' ? p.startDate : psort.key === 'orders' ? stats.get(p.id)?.count || 0 : stats.get(p.id)?.total || 0;
    return [...projects].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * (psort.asc ? 1 : -1);
    });
  }, [projects, psort, stats]);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = orders.filter((o) => (!projectFilter || o.projectId === projectFilter) && (!q || `${o.clientName} ${o.orderNo} ${o.buyerName}`.toLowerCase().includes(q)));
    const val = (o: FakeOrderRow): string | number => (osort.key === 'client' ? o.clientName.toLowerCase() : osort.key === 'orderNo' ? o.orderNo.toLowerCase() : osort.key === 'buyer' ? o.buyerName.toLowerCase() : o.total);
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * (osort.asc ? 1 : -1);
    });
  }, [orders, projectFilter, search, osort]);
  const ordersTotal = filteredOrders.reduce((s, o) => s + o.total, 0);

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, after?: () => void) => {
    setError('');
    start(async () => {
      const res = await fn();
      if (!res.success) { setError(res.error || 'Something went wrong.'); return; }
      after?.();
      router.refresh();
    });
  };
  const startProject = () => {
    const c = candidates.find((x) => `${x.invoiceId}|${x.productName}` === cand);
    if (!c) { setError('Choose the client invoice.'); return; }
    run(() => createFakeOrderProject({ clientId: c.clientId, clientName: c.clientName, invoiceId: c.invoiceId, invoiceNumber: c.invoiceNumber, productName: c.productName, startDate }), () => { setShowProject(false); setCand(''); });
  };
  const finish = (p: FakeOrderProject) => {
    const d = window.prompt(`Finish the project of ${p.clientName}?\nFinish date (YYYY-MM-DD):`, today());
    if (d) run(() => finishFakeOrderProject(p.id, d.trim()));
  };
  const removeProject = (p: FakeOrderProject) => {
    if (window.confirm(`Delete the project of ${p.clientName} and all its friends orders?`)) run(() => deleteFakeOrderProject(p.id));
  };
  const submitOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    run(() => addFakeOrder(data), () => { orderForm.current?.reset(); setTotalInput(0); setShowOrder(false); });
  };

  const PTh = ({ k, children, right }: { k: PSort; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-3 font-bold ${right ? 'text-right' : ''}`}>
      <button onClick={() => setPsort((s) => (s.key === k ? { key: k, asc: !s.asc } : { key: k, asc: k === 'client' || k === 'product' }))} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${psort.key === k ? 'text-[#f5d77f]' : ''}`}>{children}<SortArrows dir={psort.key === k ? (psort.asc ? 'asc' : 'desc') : null} /></button>
    </th>
  );
  const OTh = ({ k, children, right }: { k: OSort; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-3 font-bold ${right ? 'text-right' : ''}`}>
      <button onClick={() => setOsort((s) => (s.key === k ? { key: k, asc: !s.asc } : { key: k, asc: k !== 'total' }))} className={`inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-zinc-200 ${osort.key === k ? 'text-[#f5d77f]' : ''}`}>{children}<SortArrows dir={osort.key === k ? (osort.asc ? 'asc' : 'desc') : null} /></button>
    </th>
  );

  return (
    <div className="space-y-6">
      {migrationMissing && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">Run <b>supabase/migrations/20261017_fake_order_projects.sql</b> in Supabase once. Until then projects cannot be stored.</div>}

      {/* Active | Finished */}
      <div className="flex w-fit gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
        <Link href="/productivity/admin/fake-order" className={`rounded-lg px-4 py-1.5 text-xs font-bold ${active ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#d4af37]' : 'text-zinc-500 hover:text-zinc-300'}`}>Active</Link>
        <Link href="/productivity/admin/fake-order/finished" className={`rounded-lg px-4 py-1.5 text-xs font-bold ${!active ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#d4af37]' : 'text-zinc-500 hover:text-zinc-300'}`}>Finished</Link>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">{error}</div>}

      {/* Projects */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-200">{active ? 'Projects' : 'Finished projects'}</h2>
          {active && <button onClick={() => { setShowProject((v) => !v); setError(''); }} className="inline-flex items-center gap-2 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#f5d77f] hover:bg-[#d4af37]/20"><Plus className="h-4 w-4" /> Start project</button>}
        </div>

        {active && showProject && (
          <div className="grid gap-3 rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-4 sm:grid-cols-[1fr_180px_auto]">
            <label className={lab}>Client invoice (Friends Order / Paket Optimize Shopee New Store)
              <select value={cand} onChange={(e) => setCand(e.target.value)} className={`${field} mt-1 block w-full`}>
                <option value="">{candidates.length ? 'Choose the client' : 'No invoice waiting for a project'}</option>
                {candidates.map((c) => <option key={`${c.invoiceId}|${c.productName}`} value={`${c.invoiceId}|${c.productName}`}>{c.clientName} · {c.productName} · {c.invoiceNumber} ({dmy(c.issueDate)})</option>)}
              </select>
            </label>
            <label className={lab}>Start date<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${field} mt-1 block w-full`} /></label>
            <div className="flex items-end"><button onClick={startProject} disabled={pending} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">{pending && <Loader2 className="h-4 w-4 animate-spin" />} Start</button></div>
          </div>
        )}

        <div className="gold-glass-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[10px] text-zinc-400">
                <tr>
                  <PTh k="client">Client</PTh><PTh k="product">Project</PTh>
                  <th className="px-3 py-3 font-bold uppercase tracking-wider">Invoice</th>
                  <PTh k="start">Start</PTh>
                  {!active && <th className="px-3 py-3 font-bold uppercase tracking-wider">Finished</th>}
                  <th className="px-3 py-3 font-bold uppercase tracking-wider">Days</th>
                  <PTh k="orders" right>Orders</PTh><PTh k="total" right>Total</PTh><th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {sortedProjects.length === 0 && <tr><td colSpan={active ? 8 : 9} className="p-8 text-center text-zinc-500">{active ? 'No running project. Press "Start project" and choose a client invoice.' : 'No finished project yet.'}</td></tr>}
                {sortedProjects.map((p) => {
                  const s = stats.get(p.id) || { count: 0, total: 0 };
                  return (
                    <tr key={p.id} className="hover:bg-zinc-900/30">
                      <td className="px-3 py-3 font-semibold text-zinc-100">{p.clientName}</td>
                      <td className="px-3 py-3 text-zinc-300">{p.productName}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-zinc-500">{p.invoiceNumber || '-'}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-zinc-300">{dmy(p.startDate)}</td>
                      {!active && <td className="whitespace-nowrap px-3 py-3 font-mono text-zinc-300">{dmy(p.finishedAt || '')}</td>}
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-zinc-500">{daysBetween(p.startDate, p.finishedAt || today())}d</td>
                      <td className="px-3 py-3 text-right font-mono text-zinc-300">{s.count}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-[#f5d77f]">{rp(s.total)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {active ? (
                          <>
                            <button onClick={() => { setProjectFilter(p.id); setShowOrder(true); }} className="mr-1 rounded-lg border border-[#d4af37]/40 px-2.5 py-1.5 text-[11px] font-bold text-[#f5d77f] hover:bg-[#d4af37]/10" title="Add a friends order to this project">+ Order</button>
                            <button onClick={() => finish(p)} disabled={pending} className="mr-1 inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500/10" title="Finish: moves to Finished"><Check className="h-3 w-3" /> Finish</button>
                          </>
                        ) : (
                          <button onClick={() => run(() => reopenFakeOrderProject(p.id))} disabled={pending} className="mr-1 inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-[11px] font-bold text-zinc-300 hover:border-[#d4af37]/60" title="Back to Active"><RotateCcw className="h-3 w-3" /> Reopen</button>
                        )}
                        <button onClick={() => removeProject(p)} disabled={pending} className="rounded-lg border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {active && <p className="text-[11px] text-zinc-600">A renewal is a new invoice: when the client renews, the new invoice shows up under "Start project" and starts over as a new project.</p>}
      </section>

      {/* Friends orders */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-200">Friends orders</h2>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className={`${field} w-[260px] py-2 text-xs`}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.clientName} · {p.productName} ({dmy(p.startDate)})</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client, order no or buyer" className={`${field} w-full min-w-[180px] py-2 text-xs sm:w-[260px]`} />
          {active && <button onClick={() => { setShowOrder((v) => !v); setError(''); }} disabled={!targetProject} title={targetProject ? '' : 'Choose the client in the filter first'} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#f5d77f] hover:bg-[#d4af37]/20 disabled:opacity-40"><Plus className="h-4 w-4" /> Add friends order</button>}
        </div>

        {active && showOrder && (
          <form ref={orderForm} onSubmit={submitOrder} className="grid gap-3 rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] p-4 sm:grid-cols-2 lg:grid-cols-6">
            <input type="hidden" name="projectId" value={targetProject} />
            <div className="text-[11px] text-zinc-400 lg:col-span-6">For: <b className="text-zinc-200">{projectById.get(targetProject)?.clientName || '-'}</b> · {projectById.get(targetProject)?.productName}</div>
            <label className={lab}>No Friends Order<input name="orderNo" required className={`${field} mt-1 block w-full`} /></label>
            <label className={lab}>Buyer name<input name="buyerName" className={`${field} mt-1 block w-full`} /></label>
            <label className={lab}>Total (Rp)
              <input type="hidden" name="total" value={totalInput} />
              <RupiahInput value={totalInput} onValueChange={setTotalInput} className={`${field} mt-1 block w-full text-right font-mono`} />
            </label>
            <label className={lab}>Proof VA (image)<input name="proofVa" type="file" accept="image/*" className={`${field} mt-1 block w-full text-xs`} /></label>
            <label className={lab}>Proof Review (image)<input name="proofReview" type="file" accept="image/*" className={`${field} mt-1 block w-full text-xs`} /></label>
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-6">
              <button disabled={pending} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50">{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
            </div>
          </form>
        )}

        <div className="gold-glass-panel overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#d4af37]/10 bg-zinc-900/50 text-[10px] text-zinc-400">
                <tr>{!projectFilter && <OTh k="client">Client</OTh>}<OTh k="orderNo">No Friends Order</OTh><OTh k="buyer">Buyer name</OTh><OTh k="total" right>Total</OTh><th className="px-3 py-3 font-bold uppercase tracking-wider">Proof VA</th><th className="px-3 py-3 font-bold uppercase tracking-wider">Proof Review</th>{active && <th className="px-3 py-3" />}</tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredOrders.length === 0 && <tr><td colSpan={(projectFilter ? 5 : 6) + (active ? 1 : 0)} className="p-8 text-center text-zinc-500">No friends order yet.</td></tr>}
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-zinc-900/30">
                    {!projectFilter && <td className="px-3 py-3 font-semibold text-zinc-100">{o.clientName}{o.projectId && projectById.get(o.projectId) ? <div className="text-[10px] font-normal text-zinc-600">{projectById.get(o.projectId)!.productName}</div> : null}</td>}
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[#f5d77f]">{o.orderNo}</td>
                    <td className="px-3 py-3 text-zinc-300">{o.buyerName || '-'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-zinc-100">{rp(o.total)}</td>
                    <td className="px-3 py-3">
                      {o.proofUrl ? (
                        <button onClick={() => setProofView(o.proofUrl)} title="Open the proof">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={o.proofUrl} alt="proof" className="h-9 w-9 rounded border border-zinc-700 object-cover" />
                        </button>
                      ) : <span className="inline-flex items-center gap-1 text-zinc-700"><ImageIcon className="h-3.5 w-3.5" /> none</span>}
                    </td>
                    <td className="px-3 py-3">
                      {o.proofReviewUrl ? (
                        <button onClick={() => setProofView(o.proofReviewUrl)} title="Open the proof">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={o.proofReviewUrl} alt="proof" className="h-9 w-9 rounded border border-zinc-700 object-cover" />
                        </button>
                      ) : <span className="inline-flex items-center gap-1 text-zinc-700"><ImageIcon className="h-3.5 w-3.5" /> none</span>}
                    </td>
                    {active && <td className="px-3 py-3 text-right"><button onClick={() => window.confirm(`Delete friends order ${o.orderNo}?`) && run(() => deleteFakeOrder(o.id))} disabled={pending} className="rounded-lg border border-red-500/30 p-1.5 text-red-400 hover:bg-red-500/10" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button></td>}
                  </tr>
                ))}
              </tbody>
              {filteredOrders.length > 0 && (
                <tfoot><tr className="border-t border-zinc-700/80 bg-zinc-900/30"><td className="px-3 py-3 font-bold uppercase tracking-wider text-zinc-400" colSpan={projectFilter ? 2 : 3}>{filteredOrders.length} friends order(s)</td><td className="px-3 py-3 text-right font-mono font-bold text-[#f5d77f]">{rp(ordersTotal)}</td><td colSpan={active ? 3 : 2} /></tr></tfoot>
              )}
            </table>
          </div>
        </div>
      </section>

      {proofView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setProofView('')}>
          <button className="absolute right-4 top-4 text-zinc-300 hover:text-white" onClick={() => setProofView('')}><X className="h-6 w-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={proofView} alt="proof" className="max-h-[90vh] max-w-[90vw] rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
