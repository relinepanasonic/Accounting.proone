'use client';

import React, { useEffect, useState } from 'react';

const fmt = (d: Date) => ({
  time: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(d),
  date: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d),
  hour: Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(d)),
});

/** "Good Morning, Name" with a live Jakarta clock, like the planner reference. */
export function ClockHeader({ name, tagline }: { name: string; tagline: string }) {
  // Rendered empty on the server so the clock never mismatches; it fills in right after load.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const f = now ? fmt(now) : null;
  const greeting = !f ? 'Hello' : f.hour < 11 ? 'Good Morning' : f.hour < 15 ? 'Good Afternoon' : f.hour < 19 ? 'Good Evening' : 'Good Night';
  const first = (name || '').split(/[\s.@]/)[0] || 'there';

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pr-14">
      <div>
        <h1 className="font-serif text-3xl font-extrabold leading-tight text-zinc-100 sm:text-4xl">
          {greeting},
          <br />
          <span className="bg-gradient-to-r from-[#d4af37] to-[#f5d77f] bg-clip-text text-transparent">{first}</span> <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">{tagline}</p>
      </div>
      <div className="text-right">
        <div className="font-mono text-5xl font-light tracking-tight text-zinc-100 sm:text-6xl" aria-live="off">{f ? f.time : '--:--'}</div>
        <div className="mt-1 text-sm text-zinc-500">{f ? f.date : ''}</div>
      </div>
    </div>
  );
}
