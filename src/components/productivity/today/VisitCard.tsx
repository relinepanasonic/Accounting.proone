'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Clock, Trash2, User } from 'lucide-react';
import { deleteVisit } from '@/app/actions/planner';
import { ScreenshotThumbs } from '@/components/productivity/ScreenshotThumbs';
import type { LeadVisit } from '@/lib/productivity/planner';

const stamp = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** One meeting: client, agenda, time stamp, and the two photos (tap to enlarge). */
export function VisitCard({ visit, showSalesman, canDelete }: { visit: LeadVisit; showSalesman: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const future = new Date(visit.visit_at).getTime() > Date.now();
  const photos = [
    ...(visit.has_client_photo ? [`/api/planner/visit-photo?id=${visit.id}&k=client`] : []),
    ...(visit.has_receipt_photo ? [`/api/planner/visit-photo?id=${visit.id}&k=receipt`] : []),
  ];

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-[#0e0f14] p-4 pl-5 ${future ? 'border-sky-500/25' : 'border-zinc-800'}`}>
      <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${future ? 'bg-sky-400' : 'bg-[#d4af37]'}`} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-zinc-100">{visit.client_name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {stamp(visit.visit_at)}</span>
            {showSalesman && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {visit.salesman_name || 'Sales'}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${future ? 'border-sky-400/30 bg-sky-400/10 text-sky-300' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'}`}>{future ? 'Planned' : 'Done'}</span>
          {canDelete && (
            <button disabled={pending} onClick={() => confirm('Delete this meeting?') && start(async () => { await deleteVisit(visit.id); router.refresh(); })} aria-label="Delete meeting" className="text-zinc-600 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">{visit.agenda}</p>
      {photos.length > 0 ? (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500"><Camera className="h-3 w-3" /> With the client · receipt</div>
          <ScreenshotThumbs images={photos} size={84} />
        </div>
      ) : !future ? (
        <p className="mt-3 text-xs text-amber-300">No photos were added.</p>
      ) : null}
    </div>
  );
}
