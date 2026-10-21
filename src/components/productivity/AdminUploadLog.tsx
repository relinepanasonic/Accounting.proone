'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';
import { LOG_TIMEZONE, summarizeUploadLog, type DashboardUploadLogResult, type DashboardUpload } from '@/lib/integrations/upload-log-shared';

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00+07:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: LOG_TIMEZONE });

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: LOG_TIMEZONE });

export function AdminUploadLog({ log, title = 'Admin Upload Log', source = 'dashboard.profesoronline.id' }: { log: DashboardUploadLogResult; title?: string; source?: string }) {
  const [open, setOpen] = useState<{ admin: string; day: string } | null>(null);
  const summary = useMemo(() => (log.ok ? summarizeUploadLog(log) : null), [log]);

  if (!log.ok || !summary) {
    return (
      <div className="bg-[#0e0f14] border border-amber-500/30 rounded-xl p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">{title}</h2>
          <p className="text-xs text-zinc-400 mt-1">Log unavailable: {log.ok ? '' : log.error}</p>
        </div>
      </div>
    );
  }

  const today = log.days[0];
  const days = [...log.days].reverse(); // oldest -> newest, left to right
  const openUploads: DashboardUpload[] = open ? summary.admins.find((a) => a.name === open.admin)?.perDay[open.day] || [] : [];

  return (
    <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl overflow-hidden shadow-lg">
      <div className="p-4 border-b border-[#d4af37]/10 bg-zinc-900/40">
        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">{title}</h2>
        <p className="text-xs text-zinc-400 mt-1">
          Live from {source}, last {log.days.length} days ({LOG_TIMEZONE}). Red = no upload that day. Click a day to see the uploads.
        </p>
      </div>

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
            {summary.admins.length === 0 && (
              <tr><td colSpan={days.length + 3} className="p-6 text-center text-zinc-500">No admins listed by {source}.</td></tr>
            )}
            {summary.admins.map((row) => (
              <tr key={row.name} className="hover:bg-zinc-900/30">
                <td className="p-3 font-semibold text-zinc-200 whitespace-nowrap">{row.name}</td>
                {days.map((d) => {
                  const n = row.perDay[d]?.length || 0;
                  const selected = open?.admin === row.name && open.day === d;
                  return (
                    <td key={d} className={`p-3 text-center ${selected ? 'bg-[#d4af37]/10' : ''}`}>
                      {n > 0 ? (
                        <button onClick={() => setOpen(selected ? null : { admin: row.name, day: d })} className="inline-flex items-center gap-1 text-emerald-400 font-mono hover:text-emerald-300" title="Show the uploads">
                          <CheckCircle2 className="w-3.5 h-3.5" />{n}
                        </button>
                      ) : (
                        <XCircle className={`w-3.5 h-3.5 mx-auto ${d === today ? 'text-zinc-600' : 'text-red-400/80'}`} />
                      )}
                    </td>
                  );
                })}
                <td className="p-3 text-center font-mono text-zinc-300">{row.daysActive}/{days.length}</td>
                <td className="p-3 text-center font-mono text-[#f5d77f]">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="border-t border-[#d4af37]/10">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <span>{open.admin} · {dayLabel(open.day)} ({openUploads.length} uploads)</span>
            <button onClick={() => setOpen(null)} className="text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {openUploads.map((u) => (
              <div key={u.id} className="px-4 py-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-mono text-zinc-500 w-12">{timeLabel(u.uploadedAt)}</span>
                  <span className="text-zinc-300 font-semibold">{u.type}</span>
                  <span className="text-[#f5d77f]">{u.store || '-'}</span>
                  {u.month && <span className="text-zinc-400">{u.month}</span>}
                  {u.workspace && <span className="text-zinc-500">{u.workspace}</span>}
                </div>
                {u.files && u.files.length > 0 && <div className="mt-1 pl-16 text-[11px] text-zinc-600 break-all">{u.files.join(', ')}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.others.length > 0 && (
        <div className="border-t border-[#d4af37]/10 px-4 py-3 text-[11px] text-zinc-500">
          Also uploaded by people who are not admins (information only): {summary.others.map((o) => `${o.name} (${o.total})`).join(', ')}
        </div>
      )}
    </div>
  );
}
