import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { jakartaDay, LOG_TIMEZONE, type DashboardUploadLogResult } from '@/lib/integrations/dashboard-uploads';

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00+07:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: LOG_TIMEZONE });

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LOG_TIMEZONE });

export function AdminUploadLog({ log }: { log: DashboardUploadLogResult }) {
  if (!log.ok) {
    return (
      <div className="bg-[#0e0f14] border border-amber-500/30 rounded-xl p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">Admin Upload Log</h2>
          <p className="text-xs text-zinc-400 mt-1">Log unavailable: {log.error}</p>
        </div>
      </div>
    );
  }

  // Group uploads by admin and Jakarta day.
  const byAdminDay = new Map<string, Map<string, number>>();
  const adminNames = new Set<string>(log.admins.map((a) => a.name));
  for (const u of log.uploads) {
    adminNames.add(u.admin);
    const day = jakartaDay(new Date(u.uploadedAt));
    const perDay = byAdminDay.get(u.admin) || new Map<string, number>();
    perDay.set(day, (perDay.get(day) || 0) + 1);
    byAdminDay.set(u.admin, perDay);
  }
  const admins = Array.from(adminNames).sort((a, b) => a.localeCompare(b));
  const today = log.days[0];
  const days = [...log.days].reverse(); // oldest -> newest, left to right

  const recent = [...log.uploads]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .filter((u) => jakartaDay(new Date(u.uploadedAt)) === today);

  return (
    <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl overflow-hidden shadow-lg">
      <div className="p-4 border-b border-[#d4af37]/10 bg-zinc-900/40">
        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">Admin Upload Log</h2>
        <p className="text-xs text-zinc-400 mt-1">
          Live from dashboard.profesoronline.id, last {log.days.length} days ({LOG_TIMEZONE}). Red = no upload that day.
        </p>
      </div>

      {/* Daily matrix + weekly summary */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500 uppercase text-[10px] tracking-wider">
              <th className="text-left font-bold p-3">Admin</th>
              {days.map((d) => (
                <th key={d} className={`font-bold p-3 text-center whitespace-nowrap ${d === today ? 'text-[#f5d77f]' : ''}`}>{dayLabel(d)}</th>
              ))}
              <th className="font-bold p-3 text-center">Days active</th>
              <th className="font-bold p-3 text-center">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {admins.length === 0 && (
              <tr><td colSpan={days.length + 3} className="p-6 text-center text-zinc-500">No admins or uploads in this period.</td></tr>
            )}
            {admins.map((admin) => {
              const perDay = byAdminDay.get(admin) || new Map<string, number>();
              const total = Array.from(perDay.values()).reduce((s, n) => s + n, 0);
              const active = perDay.size;
              return (
                <tr key={admin} className="hover:bg-zinc-900/30">
                  <td className="p-3 font-semibold text-zinc-200 whitespace-nowrap">{admin}</td>
                  {days.map((d) => {
                    const n = perDay.get(d) || 0;
                    return (
                      <td key={d} className="p-3 text-center">
                        {n > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-mono"><CheckCircle2 className="w-3.5 h-3.5" />{n}</span>
                        ) : (
                          <XCircle className={`w-3.5 h-3.5 mx-auto ${d === today ? 'text-zinc-600' : 'text-red-400/80'}`} />
                        )}
                      </td>
                    );
                  })}
                  <td className="p-3 text-center font-mono text-zinc-300">{active}/{days.length}</td>
                  <td className="p-3 text-center font-mono text-[#f5d77f]">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Today's activity */}
      <div className="border-t border-[#d4af37]/10">
        <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Today ({recent.length} uploads)</div>
        <div className="divide-y divide-zinc-800/60">
          {recent.length === 0 && <div className="p-4 text-xs text-zinc-500">Nothing uploaded yet today.</div>}
          {recent.map((u) => (
            <div key={u.id} className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="font-mono text-zinc-500 w-12">{timeLabel(u.uploadedAt)}</span>
              <span className="font-semibold text-zinc-200 w-24 truncate">{u.admin}</span>
              <span className="text-zinc-400 w-40 truncate">{u.type}</span>
              <span className="text-[#f5d77f] truncate">{u.store || '-'}</span>
              {u.files && u.files.length > 0 && <span className="text-zinc-600 truncate">{u.files.length} file(s)</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
