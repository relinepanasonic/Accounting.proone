'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

const MODES = [
  { key: 'focus', label: 'Focus', seconds: 25 * 60 },
  { key: 'break', label: 'Break', seconds: 5 * 60 },
] as const;

/** A 25-minute focus timer (and a 5-minute break). Runs in the browser only. */
export function FocusTimer() {
  const [mode, setMode] = useState<(typeof MODES)[number]>(MODES[0]);
  const [left, setLeft] = useState<number>(MODES[0].seconds);
  const [running, setRunning] = useState(false);
  const endsAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    // Count against the clock, not the number of ticks, so a background tab cannot slow it down.
    endsAt.current = Date.now() + left * 1000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        setRunning(false);
        try { navigator.vibrate?.(300); } catch { /* not supported */ }
      }
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const pick = (m: (typeof MODES)[number]) => {
    setMode(m);
    setLeft(m.seconds);
    setRunning(false);
  };
  const reset = () => {
    setLeft(mode.seconds);
    setRunning(false);
  };

  const R = 78;
  const C = 2 * Math.PI * R;
  const progress = 1 - left / mode.seconds;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-100">Focus Timer</h3>
        <div className="inline-flex rounded-full border border-zinc-800 bg-black/30 p-0.5 text-[10px] font-bold">
          {MODES.map((m) => (
            <button key={m.key} onClick={() => pick(m)} className={`rounded-full px-2.5 py-1 ${mode.key === m.key ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'text-zinc-500 hover:text-zinc-300'}`}>{m.label}</button>
          ))}
        </div>
      </div>
      <div className="relative mx-auto my-auto flex h-48 w-48 items-center justify-center">
        <svg viewBox="0 0 180 180" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="90" cy="90" r={R} fill="none" stroke="#27272a" strokeWidth="8" />
          <circle cx="90" cy="90" r={R} fill="none" stroke="url(#gold)" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: 'stroke-dashoffset 0.5s linear' }} />
          <defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d4af37" /><stop offset="100%" stopColor="#f5d77f" /></linearGradient></defs>
        </svg>
        <div className="text-center">
          <div className="font-mono text-4xl font-light text-zinc-100" role="timer">{mm}:{ss}</div>
          <div className="text-xs text-zinc-500">{left === 0 ? 'Time is up' : mode.label}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4">
        <button
          onClick={() => (left === 0 ? reset() : setRunning((r) => !r))}
          aria-label={running ? 'Pause' : 'Start'}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#d4af37] to-[#f5d77f] text-black shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:scale-105"
        >
          {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-px" />}
        </button>
        <button onClick={reset} aria-label="Reset" className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 hover:text-zinc-100"><RotateCcw className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
