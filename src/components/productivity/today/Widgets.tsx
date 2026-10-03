import React from 'react';
import Link from 'next/link';
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react';
import type { Deadline, Weather } from '@/lib/productivity/planner';
import { weatherWords } from '@/lib/productivity/planner';

/** The glass-like card every widget sits in. */
export function Widget({ title, action, children, className = '' }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-zinc-800/80 bg-[#0e0f14]/90 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur ${className}`}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- schedule
export interface ScheduleItem {
  key: string;
  time: string | null; // "09:30" or null = all day
  title: string;
  subtitle: string;
  tone: 'gold' | 'sky' | 'emerald' | 'violet' | 'rose';
  href?: string;
}
const BAR: Record<ScheduleItem['tone'], string> = { gold: 'bg-[#d4af37]', sky: 'bg-sky-400', emerald: 'bg-emerald-400', violet: 'bg-violet-400', rose: 'bg-rose-400' };

export function ScheduleWidget({ items, dayLabel }: { items: ScheduleItem[]; dayLabel: string }) {
  return (
    <Widget title={dayLabel === 'Today' ? "Today's Schedule" : `Schedule · ${dayLabel}`} action={<Link href="/productivity/meetings" className="text-[11px] font-bold text-[#f5d77f] hover:underline">All meetings</Link>}>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-600">Nothing scheduled.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.slice(0, 5).map((it) => {
            const inner = (
              <div className="flex items-stretch gap-3 rounded-xl bg-black/25 p-2.5 hover:bg-black/40">
                <span className={`w-1 shrink-0 rounded-full ${BAR[it.tone]}`} />
                <div className="w-11 shrink-0 text-xs font-mono text-zinc-400">{it.time ?? 'All day'}</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-100">{it.title}</div>
                  <div className="truncate text-xs text-zinc-500">{it.subtitle}</div>
                </div>
              </div>
            );
            return <li key={it.key}>{it.href ? <Link href={it.href}>{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </Widget>
  );
}

// ---------------------------------------------------------------- weather
function WeatherIcon({ code, className }: { code: number; className?: string }) {
  const cls = className || 'h-12 w-12';
  if (code === 0) return <Sun className={`${cls} text-[#f5d77f]`} />;
  if (code <= 2) return <CloudSun className={`${cls} text-[#f5d77f]`} />;
  if (code === 3) return <Cloud className={`${cls} text-zinc-300`} />;
  if (code <= 48) return <CloudFog className={`${cls} text-zinc-400`} />;
  if (code <= 67 || (code >= 80 && code <= 82)) return <CloudRain className={`${cls} text-sky-300`} />;
  if (code <= 86) return <CloudSnow className={`${cls} text-sky-100`} />;
  return <CloudLightning className={`${cls} text-amber-300`} />;
}

export function WeatherWidget({ weather }: { weather: Weather | null }) {
  if (!weather) {
    return (
      <Widget title="Weather">
        <p className="py-10 text-center text-xs text-zinc-600">Weather is not available right now.</p>
      </Widget>
    );
  }
  return (
    <Widget title={`Weather · ${weather.city}`}>
      <div className="flex flex-col items-center text-center">
        <WeatherIcon code={weather.code} className="h-14 w-14" />
        <div className="mt-1 text-5xl font-light text-zinc-100">{weather.temp}°</div>
        <div className="text-sm text-zinc-400">{weatherWords(weather.code)}</div>
        <div className="mt-1 text-xs text-zinc-500">↑ {weather.hi}° &nbsp; ↓ {weather.lo}°</div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3 text-center">
        {weather.days.map((d) => (
          <div key={d.day} className="flex flex-col items-center gap-1">
            <span className="text-[11px] text-zinc-500">{new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short' })}</span>
            <WeatherIcon code={d.code} className="h-6 w-6" />
            <span className="text-xs text-zinc-300">{d.hi}°</span>
          </div>
        ))}
      </div>
    </Widget>
  );
}

// ---------------------------------------------------------------- deadlines
const CHIP = {
  high: 'border-red-500/40 bg-red-500/10 text-red-300',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  low: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
};

export function DeadlinesWidget({ items }: { items: Deadline[] }) {
  return (
    <Widget title="Upcoming Deadlines" action={<Link href="/productivity/tasks" className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-bold text-zinc-300 hover:border-[#d4af37]/50">View All</Link>}>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-600">No deadline in the next 30 days.</p>
      ) : (
        <ul className="divide-y divide-zinc-900">
          {items.map((d) => (
            <li key={d.id}>
              <Link href={d.href} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#d4af37]/10 text-[11px] font-extrabold text-[#f5d77f]">{d.due.slice(8)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-100">{d.title}</span>
                  <span className="block truncate text-xs text-zinc-500">{d.subtitle}</span>
                </span>
                <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-bold capitalize ${CHIP[d.priority]}`}>{d.priority}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}
