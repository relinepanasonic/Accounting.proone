'use client';

import React, { useId } from 'react';
import type { CardExtra } from '@/lib/data/dashboard';

const rp = (n: number) => {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1_000_000_000) return `${sign}Rp ${(a / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (a >= 1_000_000) return `${sign}Rp ${(a / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  return `${sign}Rp ${Math.round(a).toLocaleString('id-ID')}`;
};

/** A smooth area line: the trend behind the number. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const id = useId().replace(/:/g, '');
  const W = 120, H = 34, PAD = 3;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [PAD + (i * (W - PAD * 2)) / Math.max(1, values.length - 1), H - PAD - ((v - min) / span) * (H - PAD * 2)] as const);
  // smooth curve (Catmull-Rom to Bezier)
  const path = pts.map((p, i) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p2 = p, p3 = pts[i + 1] || p;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    return `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-9 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {pts.length > 1 && <path d={`${path} L${last[0]},${H} L${pts[0][0]},${H} Z`} fill={`url(#g${id})`} />}
      {pts.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      {last && <circle cx={last[0]} cy={last[1]} r="2" fill={color} />}
    </svg>
  );
}

/** Under a card's number: its mini chart and the small per-company numbers (ProOne, PLIG...). */
export function CardExtras({ extra, color, count, ratio }: { extra?: CardExtra; color: string; count?: boolean; ratio?: boolean }) {
  if (!extra) return null;
  const hasTrend = extra.series.some((v) => v !== 0);
  return (
    <div className="mt-3">
      <div className={hasTrend ? '' : 'opacity-30'}><Sparkline values={extra.series.length ? extra.series : [0, 0]} color={color} /></div>
      {extra.split.length > 1 && (
        <div className="mt-2 space-y-0.5 border-t border-white/5 pt-2">
          {extra.split.map((s) => (
            <div key={s.code} className="flex items-center justify-between font-mono text-[10.5px] leading-tight">
              <span className="text-zinc-500">{s.code}</span>
              <span className="text-zinc-300">{ratio ? (s.value > 0 ? `${s.value.toFixed(2)}x` : '-') : count ? Math.round(s.value) : rp(s.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
