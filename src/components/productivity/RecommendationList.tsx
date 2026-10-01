import React from 'react';
import { actionable, type RecTone, type Recommendation } from '@/lib/advertiser/optimasi';

const TONE: Record<RecTone, string> = {
  up: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  down: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  move: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  delete: 'border-red-500/30 bg-red-500/10 text-red-300',
  check: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  stay: 'border-zinc-700 bg-zinc-900 text-zinc-400',
  watch: 'border-zinc-700 bg-zinc-900 text-zinc-500',
};

const roasText = (n: number | null) => (n === null ? '-' : n.toFixed(2));

/** Table cell: only what needs action, two at most. */
export function RecommendationChips({ recs }: { recs?: Recommendation[] }) {
  const todo = actionable(recs || []);
  if (todo.length === 0) return <span className="text-zinc-600">-</span>;
  return (
    <div className="flex max-w-[300px] flex-col gap-1 whitespace-normal">
      {todo.slice(0, 2).map((r, i) => (
        <span key={i} className={`inline-block rounded border px-2 py-1 text-[11px] font-bold ${TONE[r.tone]}`}>
          <span className="opacity-70">{r.name}: </span>{r.action}{r.streak ? ` (hari ke-${r.streak})` : ''}
        </span>
      ))}
      {todo.length > 2 && <span className="text-[10px] text-zinc-500">+{todo.length - 2} lagi, buka detail</span>}
    </div>
  );
}

/** Detail panel: every group / ad with its numbers and the advice. */
export function RecommendationPanel({ recs }: { recs?: Recommendation[] }) {
  if (!recs || recs.length === 0) return null;
  const order = ['gmv', 'hero', 'regular', 'low', 'mandiri'];
  const sorted = [...recs].sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
  return (
    <div className="rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/5 p-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#d4af37]">Rekomendasi OptimasiShopee</div>
      <div className="space-y-1.5">
        {sorted.map((r, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-md border border-zinc-800 bg-black/30 px-3 py-2 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-zinc-200">{r.name} <span className="font-normal text-zinc-500">· {r.sectionLabel}</span></div>
              <div className="font-mono text-[10px] text-zinc-500">
                Modal terpakai {r.usagePct}%{r.section === 'gmv' ? '' : ` · ROAS ${roasText(r.roas)} vs rata-rata toko ${roasText(r.avgRoas)}`}
              </div>
            </div>
            <span className={`inline-block shrink-0 rounded border px-2 py-1 text-[11px] font-bold ${TONE[r.tone]}`}>
              {r.action}{r.streak ? ` · hari ke-${r.streak}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
