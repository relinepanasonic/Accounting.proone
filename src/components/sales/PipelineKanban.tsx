'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ArrowRight, Calendar, CheckCircle2, Clock, Download, FileText, Loader2, MessageCircle, Play, Send, ShieldCheck, Snowflake, User, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { PIPELINE_STAGES, MANUAL_STAGES, PROPOSAL_STAGES, computeProjectTerms, followUpDueDay, stageLabel, type NegotiationNote, type RequestItem } from '@/lib/sales/flow';
import { addNegotiationNote, approveWithoutPayment, askAcc, cancelInvoiceRequest, createInvoiceShare, decideAcc, markFollowedUp, markProposalSent, moveDeal, startProject } from '@/app/actions/sales-flow';
import { NewLeadModal } from '@/components/sales/NewLeadModal';
import { RequestInvoiceModal, type CatalogProduct } from '@/components/sales/RequestInvoiceModal';

const STAGE_COLORS: Record<string, string> = {
  Lead: 'bg-zinc-400',
  Contacted: 'bg-blue-400',
  Negotiation: 'bg-amber-400',
  Invoice: 'bg-sky-400',
  Deal: 'bg-emerald-400',
  'Cold Case': 'bg-slate-500',
};

interface Deal {
  created_at: string;
  stage_changed_at: string | null;
  last_followup_at: string | null;
  proposal_sent_at: string | null;
  negotiation_notes: NegotiationNote[];
  neg_acc_status: 'requested' | 'approved' | 'rejected' | null;
  neg_acc_requested_from_name: string | null;
  neg_acc_by_name: string | null;
  neg_acc_at: string | null;
  neg_acc_comment: string | null;
  id: string;
  title: string;
  stage: string;
  value: number;
  client_name: string;
  client_phone: string | null;
  salesman_id: string | null;
  salesman_name: string | null;
  expected_close_date: string | null;
  invoice_requested_at: string | null;
  invoice_generated_at: string | null;
  paid_at: string | null;
  acc_approved_at: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  request: { id: string; status: string; items: RequestItem[]; note: string | null } | null;
  project: { id: string; start_date: string; end_date: string | null; deliverables: { name: string; unit: string; total: number }[]; status: string; handler_assigned_at: string | null } | null;
}

interface Viewer {
  role: string;
  userId: string | null;
  isFinance: boolean;
  isOwner: boolean;
}

const todayJakarta = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

const stamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const day = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }) : '');

const stopDrag = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

/** 08xx -> 628xx, digits only. */
const waPhone = (p: string | null) => {
  const d = (p || '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('0') ? `62${d.slice(1)}` : d;
};

function DroppableColumn({ id, total, count, children }: { id: string; total: number; count: number; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ backgroundColor: isOver ? 'rgba(212,175,55,0.05)' : undefined, borderColor: isOver ? 'rgba(212,175,55,0.5)' : undefined }}
      className="flex flex-col w-[320px] shrink-0 bg-[#0e0f14] rounded-2xl border border-zinc-800/60 max-h-full transition-colors duration-200"
    >
      <div className="p-4 flex items-center gap-3 shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${STAGE_COLORS[id] || 'bg-zinc-500'} opacity-80`} />
        <h3 className="font-bold text-[15px] text-zinc-100 tracking-wide">{stageLabel(id)}</h3>
        <span className="text-xs font-medium text-zinc-400 bg-zinc-800/50 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="px-4 pb-3 text-xs font-semibold text-[#d4af37]/80 border-b border-zinc-800/50 flex justify-between">
        <span>Value</span>
        <span>{formatCurrency(total)}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">{children}</div>
    </div>
  );
}

function Btn({ children, onClick, tone = 'gold', disabled }: { children: React.ReactNode; onClick: () => void; tone?: 'gold' | 'green' | 'ghost' | 'red'; disabled?: boolean }) {
  const cls = {
    gold: 'bg-[#d4af37]/15 text-[#f5d77f] border-[#d4af37]/40 hover:bg-[#d4af37]/25',
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25',
    ghost: 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500',
    red: 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20',
  }[tone];
  return (
    <button disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }} {...stopDrag} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50 ${cls}`}>
      {children}
    </button>
  );
}

function DealCard({
  deal, viewer, products, approvers, onMove, onError,
}: {
  deal: Deal; viewer: Viewer; products: CatalogProduct[]; approvers: { id: string; name: string }[];
  onMove?: (id: string, dir: 'left' | 'right') => void; onError: (m: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [requesting, setRequesting] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [approver, setApprover] = useState(approvers[0]?.id || '');
  const [accComment, setAccComment] = useState('');
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id, data: { deal } });

  const manual = MANUAL_STAGES.includes(deal.stage);
  const waiting = deal.request?.status === 'requested';
  const hasInvoice = Boolean(deal.invoice_number && deal.invoice_generated_at);
  const won = deal.stage === 'Deal';
  const canAct = viewer.isFinance || viewer.role === 'sales';
  const inNegotiation = deal.stage === 'Negotiation';
  const accOk = deal.neg_acc_status === 'approved';
  const dueDay = followUpDueDay(deal);
  const today = todayJakarta();
  const proposalOpen = PROPOSAL_STAGES.includes(deal.stage) && !deal.proposal_sent_at;

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.success) return onError(res.error || 'Something went wrong.');
      after?.();
      router.refresh();
    });

  /** Make the share link, then open WhatsApp (or the download page) with it. */
  const share = (how: 'wa' | 'wab' | 'download') =>
    start(async () => {
      const res = await createInvoiceShare(deal.id);
      if (!res.success) return onError(res.error);
      const link = `${window.location.origin}/share/invoice/${res.token}`;
      if (how === 'download') {
        window.open(`${link}?dl=1`, '_blank');
        return;
      }
      const text = `Halo ${res.clientName}, berikut invoice ${res.invoiceNumber} sebesar Rp ${Math.round(res.total).toLocaleString('id-ID')}.\nBuka dan unduh di sini: ${link}`;
      const phone = waPhone(res.phone);
      const web = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      // WhatsApp Business has its own Android package; elsewhere the phone decides which app opens wa.me.
      if (how === 'wab' && /Android/i.test(navigator.userAgent)) {
        window.location.href = `intent://send/?${phone ? `phone=${phone}&` : ''}text=${encodeURIComponent(text)}#Intent;scheme=smsto;package=com.whatsapp.w4b;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      } else {
        window.open(web, '_blank');
      }
    });

  const preview = deal.request ? computeProjectTerms(deal.request.items, startDate) : { endDate: null, deliverables: [] };

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 50 : 1 }}
        className={`group relative bg-[#13141a] rounded-xl border border-zinc-800/50 p-4 shadow-md hover:border-[#d4af37]/40 transition-all overflow-hidden ${manual ? 'cursor-grab active:cursor-grabbing' : ''}`}
        {...(manual ? listeners : {})}
        {...attributes}
      >
        <div className={`absolute top-0 left-0 right-0 h-1 ${STAGE_COLORS[deal.stage] || 'bg-zinc-700'} opacity-70`} />

        <div className="flex items-center justify-between mb-3 mt-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#d4af37]/10 text-[#f5d77f]">
            <User className="w-3 h-3 mr-1 opacity-70" />
            <span className="truncate max-w-[170px]">{deal.client_name}</span>
          </span>
          {deal.salesman_name && (
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-300" title={`Salesman: ${deal.salesman_name}`}>
              {deal.salesman_name.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <h4 className="text-[15px] font-bold text-zinc-100 leading-snug mb-1 line-clamp-2">{deal.title}</h4>
        <div className="text-[#d4af37] font-semibold text-sm mb-3">{formatCurrency(deal.value)}</div>
        {deal.expected_close_date && manual && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-2"><Calendar className="w-3.5 h-3.5" /> Close {day(deal.expected_close_date)}</div>
        )}

        {/* ---- tasks while the lead is warming up ---- */}
        {canAct && dueDay && (
          <div className="mb-3 space-y-2 rounded-lg border border-zinc-800 bg-black/20 p-2.5 text-[11px]" {...stopDrag}>
            <div className="flex items-center justify-between gap-2">
              <span className={dueDay < today ? 'text-red-300' : dueDay === today ? 'text-amber-300' : 'text-zinc-400'}>
                {dueDay < today ? `Follow-up overdue since ${day(dueDay)}` : dueDay === today ? 'Follow up today' : `Next follow-up ${day(dueDay)}`}
              </span>
              <Btn tone="ghost" disabled={pending} onClick={() => run(() => markFollowedUp(deal.id))}><CheckCircle2 className="w-3.5 h-3.5" /> Followed up</Btn>
            </div>
            {PROPOSAL_STAGES.includes(deal.stage) && (
              proposalOpen ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-amber-300">Task: send the proposal</span>
                  <Btn tone="gold" disabled={pending} onClick={() => run(() => markProposalSent(deal.id))}><Send className="w-3.5 h-3.5" /> Proposal sent</Btn>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-300"><CheckCircle2 className="w-3 h-3" /> Proposal sent {stamp(deal.proposal_sent_at)}</div>
              )
            )}
          </div>
        )}
        {deal.stage === 'Cold Case' && (
          <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-slate-600/40 bg-slate-500/10 p-2.5 text-[11px] text-slate-300"><Snowflake className="w-3.5 h-3.5" /> Cold case: no more follow-up tasks. Drag it back to Lead to wake it up.</div>
        )}

        {/* ---- negotiation: notes and the ACC of a superadmin / the founder ---- */}
        {inNegotiation && (
          <div className="mb-3 space-y-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px]" {...stopDrag}>
            <div className="font-bold uppercase tracking-wider text-amber-300">Negotiation notes</div>
            {deal.negotiation_notes.length === 0 && <div className="text-zinc-500">No notes yet. Write what the client asked and what was agreed.</div>}
            {deal.negotiation_notes.slice(-3).map((n, i) => (
              <div key={i} className="rounded-md bg-black/30 p-2">
                <div className="mb-0.5 text-[10px] text-zinc-500">{n.by} · {stamp(n.at)}</div>
                <div className="whitespace-pre-wrap text-zinc-200">{n.text}</div>
              </div>
            ))}
            {deal.negotiation_notes.length > 3 && (
              <details className="text-zinc-400">
                <summary className="cursor-pointer">Earlier notes ({deal.negotiation_notes.length - 3})</summary>
                {deal.negotiation_notes.slice(0, -3).map((n, i) => (
                  <div key={i} className="mt-1 rounded-md bg-black/30 p-2"><div className="text-[10px] text-zinc-500">{n.by} · {stamp(n.at)}</div><div className="whitespace-pre-wrap text-zinc-300">{n.text}</div></div>
                ))}
              </details>
            )}
            {canAct && (
              <div className="flex gap-2">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a negotiation note" className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100" />
                <Btn tone="gold" disabled={pending || note.trim().length < 2} onClick={() => run(() => addNegotiationNote(deal.id, note), () => setNote(''))}>Add</Btn>
              </div>
            )}

            <div className="border-t border-amber-500/20 pt-2">
              <div className="mb-1 font-bold uppercase tracking-wider text-amber-300">ACC (superadmin / founder)</div>
              {accOk ? (
                <div className="flex items-center gap-1.5 text-emerald-300"><ShieldCheck className="w-3.5 h-3.5" /> ACC by <b>{deal.neg_acc_by_name}</b> · {stamp(deal.neg_acc_at)}{deal.neg_acc_comment ? <span className="text-zinc-400"> · {deal.neg_acc_comment}</span> : null}</div>
              ) : (
                <div className="space-y-1.5">
                  {deal.neg_acc_status === 'requested' && <div className="text-amber-300">Waiting for ACC from {deal.neg_acc_requested_from_name || 'an owner'}.</div>}
                  {deal.neg_acc_status === 'rejected' && <div className="text-red-300">Sent back by {deal.neg_acc_by_name}{deal.neg_acc_comment ? `: ${deal.neg_acc_comment}` : ''}</div>}
                  {canAct && deal.neg_acc_status !== 'requested' && !viewer.isOwner && (
                    <div className="flex gap-2">
                      <select value={approver} onChange={(e) => setApprover(e.target.value)} className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100">
                        {approvers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <Btn tone="gold" disabled={pending || !approver} onClick={() => run(() => askAcc(deal.id, approver))}>Ask ACC</Btn>
                    </div>
                  )}
                  {viewer.isOwner && (
                    <div className="space-y-1.5">
                      <input value={accComment} onChange={(e) => setAccComment(e.target.value)} placeholder="Comment (optional)" className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100" />
                      <div className="flex gap-2">
                        <Btn tone="green" disabled={pending} onClick={() => run(() => decideAcc(deal.id, true, accComment))}><ShieldCheck className="w-3.5 h-3.5" /> ACC</Btn>
                        <Btn tone="red" disabled={pending} onClick={() => run(() => decideAcc(deal.id, false, accComment))}>Send back</Btn>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- milestones: when it was requested, when the invoice was made ---- */}
        {(deal.invoice_requested_at || hasInvoice) && (
          <div className="space-y-1 rounded-lg border border-zinc-800 bg-black/20 p-2.5 text-[11px]">
            {deal.invoice_requested_at && (
              <div className="flex items-center gap-1.5 text-zinc-400"><Clock className="w-3 h-3 text-sky-300" /> Requested <span className="text-zinc-200">{stamp(deal.invoice_requested_at)}</span></div>
            )}
            {hasInvoice ? (
              <div className="flex items-center gap-1.5 text-zinc-400"><CheckCircle2 className="w-3 h-3 text-emerald-300" /> Invoice generated <span className="text-zinc-200">{stamp(deal.invoice_generated_at)}</span></div>
            ) : waiting ? (
              <div className="flex items-center gap-1.5 text-amber-300"><Loader2 className="w-3 h-3 animate-spin" /> Waiting for Accounting</div>
            ) : null}
            {hasInvoice && <div className="font-mono text-[#f5d77f]">{deal.invoice_number}{deal.invoice_status ? <span className="ml-2 font-sans text-zinc-500 uppercase">{deal.invoice_status}</span> : null}</div>}
            {deal.paid_at && <div className="flex items-center gap-1.5 text-emerald-300"><CheckCircle2 className="w-3 h-3" /> Paid {stamp(deal.paid_at)}</div>}
            {deal.acc_approved_at && !deal.paid_at && <div className="flex items-center gap-1.5 text-emerald-300"><ShieldCheck className="w-3 h-3" /> Approved by Accounting {stamp(deal.acc_approved_at)}</div>}
          </div>
        )}

        {/* ---- actions ---- */}
        <div className="mt-3 flex flex-wrap gap-2" {...stopDrag}>
          {canAct && inNegotiation && accOk && !waiting && !hasInvoice && <Btn onClick={() => setRequesting(true)}><FileText className="w-3.5 h-3.5" /> Request invoice</Btn>}
          {canAct && inNegotiation && !accOk && <span className="text-[10px] text-zinc-500">Request invoice opens after ACC.</span>}
          {canAct && waiting && !hasInvoice && <Btn tone="red" disabled={pending} onClick={() => run(() => cancelInvoiceRequest(deal.request!.id))}><X className="w-3.5 h-3.5" /> Cancel request</Btn>}
          {canAct && hasInvoice && (
            <>
              <Btn tone="green" disabled={pending} onClick={() => share('wa')}><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</Btn>
              <Btn tone="green" disabled={pending} onClick={() => share('wab')}><Send className="w-3.5 h-3.5" /> WA Business</Btn>
              <Btn tone="ghost" disabled={pending} onClick={() => share('download')}><Download className="w-3.5 h-3.5" /> Download</Btn>
            </>
          )}
          {viewer.isFinance && hasInvoice && !won && <Btn tone="ghost" disabled={pending} onClick={() => run(() => approveWithoutPayment(deal.id))}><ShieldCheck className="w-3.5 h-3.5" /> Approve without payment</Btn>}
        </div>

        {/* ---- deal won: start the project ---- */}
        {won && !deal.project && canAct && (
          <div className="mt-3 space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3" {...stopDrag}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Start the project</div>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 [color-scheme:dark]" />
            <div className="text-[11px] text-zinc-400">
              {preview.endDate ? <>Ends <b className="text-zinc-100">{day(preview.endDate)}</b></> : 'No end date (no product has a project length)'}
              {preview.deliverables.length > 0 && <div>{preview.deliverables.map((d) => `${d.total} ${d.unit}`).join(' · ')} to deliver</div>}
            </div>
            <Btn tone="green" disabled={pending || !startDate} onClick={() => run(() => startProject(deal.id, startDate))}><Play className="w-3.5 h-3.5" /> Start project</Btn>
          </div>
        )}
        {deal.project && (
          <div className="mt-3 space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-[11px]">
            <div className="font-bold uppercase tracking-wider text-emerald-300">Project {deal.project.status === 'pre_start' ? 'starts soon' : 'running'}</div>
            <div className="text-zinc-300">{day(deal.project.start_date)}{deal.project.end_date ? ` → ${day(deal.project.end_date)}` : ''}</div>
            {deal.project.deliverables.length > 0 && <div className="text-zinc-400">{deal.project.deliverables.map((d) => `${d.total} ${d.unit}`).join(' · ')}</div>}
            <div className={deal.project.handler_assigned_at ? 'text-emerald-300' : 'text-amber-300'}>{deal.project.handler_assigned_at ? 'Handler assigned' : 'Waiting for a handler (superadmin)'}</div>
          </div>
        )}

        {/* arrows for phones (no drag) */}
        {manual && onMove && (
          <div className="mt-3 flex justify-between lg:hidden" {...stopDrag}>
            <button onClick={() => onMove(deal.id, 'left')} disabled={MANUAL_STAGES.indexOf(deal.stage) <= 0} className="p-1.5 rounded-full border border-zinc-700 text-zinc-300 disabled:opacity-20"><ArrowLeft className="w-4 h-4" /></button>
            <button onClick={() => onMove(deal.id, 'right')} disabled={MANUAL_STAGES.indexOf(deal.stage) >= MANUAL_STAGES.length - 1} className="p-1.5 rounded-full border border-zinc-700 text-zinc-300 disabled:opacity-20"><ArrowRight className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      {requesting && <RequestInvoiceModal dealId={deal.id} clientName={deal.client_name} products={products} onClose={() => setRequesting(false)} />}
    </>
  );
}

export function PipelineKanban({
  initialDeals, products, salesmen, approvers, viewer, currentMonth,
}: {
  initialDeals: Deal[]; products: CatalogProduct[]; salesmen: { id: string; name: string }[]; approvers: { id: string; name: string }[]; viewer: Viewer; currentMonth: string;
}) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [error, setError] = useState('');
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  useEffect(() => setDeals(initialDeals), [initialDeals]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const moveTo = async (dealId: string, stage: string) => {
    const before = deals;
    setError('');
    setDeals((p) => p.map((d) => (d.id === dealId ? { ...d, stage } : d)));
    const res = await moveDeal(dealId, stage);
    if (!res.success) {
      setDeals(before);
      setError(res.error);
    } else router.refresh();
  };

  const handleDragEnd = (event: any) => {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;
    const deal = deals.find((d) => d.id === active.id);
    if (!deal || deal.stage === over.id) return;
    moveTo(deal.id, String(over.id));
  };

  const handleArrow = (dealId: string, dir: 'left' | 'right') => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const next = MANUAL_STAGES[MANUAL_STAGES.indexOf(deal.stage) + (dir === 'left' ? -1 : 1)];
    if (next) moveTo(dealId, next);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: any) => setActiveDeal(e.active.data.current.deal)} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-[calc(100vh-140px)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 px-4 lg:px-8 shrink-0 mt-4">
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Sales Pipeline</h1>
            <p className="text-sm text-zinc-400 mt-1">Follow up each lead, negotiate, get the ACC, then request the invoice. Paid cards become the Deals of their month; unanswered leads go to Cold Case.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-zinc-400">Deal month:</label>
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => e.target.value && router.push(`/sales/pipeline?month=${e.target.value}`)}
              className="bg-[#0e0f14] border border-[#d4af37]/30 text-zinc-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#d4af37] [color-scheme:dark]"
            />
            <NewLeadModal salesmen={salesmen} canPickSalesman={viewer.role !== 'sales'} />
          </div>
        </div>

        {error && (
          <div className="mx-4 lg:mx-8 mb-3 flex items-start justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300 shrink-0">
            <span>{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 lg:px-8 pb-8 flex gap-5 custom-scrollbar">
          {PIPELINE_STAGES.map((stage) => {
            const list = deals.filter((d) => d.stage === stage);
            return (
              <DroppableColumn key={stage} id={stage} total={list.reduce((s, d) => s + Number(d.value || 0), 0)} count={list.length}>
                {list.map((deal) => (
                  <DealCard key={deal.id} deal={deal} viewer={viewer} products={products} approvers={approvers} onMove={handleArrow} onError={setError} />
                ))}
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <div className="opacity-80 rotate-2 scale-105 pointer-events-none rounded-xl border border-[#d4af37]/40 bg-[#13141a] p-4 w-[290px]">
              <div className="text-xs text-[#f5d77f] font-bold">{activeDeal.client_name}</div>
              <div className="text-sm font-bold text-zinc-100">{activeDeal.title}</div>
            </div>
          ) : null}
        </DragOverlay>

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(212, 175, 55, 0.2); border-radius: 4px; }
        `}</style>
      </div>
    </DndContext>
  );
}
