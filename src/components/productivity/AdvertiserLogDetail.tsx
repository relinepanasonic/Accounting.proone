'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2, Pencil } from 'lucide-react';
import { fetchAdvertiserLogDetail } from '@/app/actions/advertiser';

interface LogSummary {
  client_id: string;
  client_name: string;
  report_date: string;
  advertiser_name: string;
  recommendation?: string;
}

interface SessionRow {
  session: number;
  note: string | null;
  data_inkubasi: any;
  data_group: any;
  data_mandiri: any;
  screenshot_url: string | null;
  created_at: string;
  updated_at?: string | null;
  advertiser_name: string;
}

const num = (v: unknown) => parseFloat(String(v ?? '').replace(/\D/g, '') || '0');
const rupiah = (n: number) => (n ? `Rp ${n.toLocaleString('id-ID')}` : '-');
const text = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));

// A row counts as "worked on" when the advertiser typed anything meaningful into it.
const hasData = (r: any) =>
  Boolean(r) && ['iklanProduk', 'infoIklan', 'modalHarian', 'biayaIklan', 'penjualan', 'konversi', 'produkTerjual', 'note'].some((k) => String(r[k] ?? '').trim() !== '');

function totals(rows: any[]) {
  const modal = rows.reduce((s, r) => s + num(r.modalHarian), 0);
  const biaya = rows.reduce((s, r) => s + num(r.biayaIklan), 0);
  const jual = rows.reduce((s, r) => s + num(r.penjualan), 0);
  return { modal, biaya, jual, roas: biaya > 0 ? (jual / biaya).toFixed(2) : '-' };
}

function normalizeGroup(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  // Older records stored groups as { hero: [], reguler: [], low: [] }.
  if (raw && typeof raw === 'object') {
    return [
      ...(raw.hero || []).map((r: any) => ({ ...r, groupCategory: 'Hero', groupName: 'Group Hero 1' })),
      ...(raw.reguler || []).map((r: any) => ({ ...r, groupCategory: 'Reguler', groupName: 'Group Reguler 1' })),
      ...(raw.low || []).map((r: any) => ({ ...r, groupCategory: 'Low', groupName: 'Group Low 1' })),
    ];
  }
  return [];
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2">
      <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-sm font-bold text-zinc-100 font-mono">{value}</div>
    </div>
  );
}

function RowsTable({ rows, kind }: { rows: any[]; kind: 'inkubasi' | 'group' | 'mandiri' }) {
  const isMandiri = kind === 'mandiri';
  const t = totals(rows);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Modal harian" value={rupiah(t.modal)} />
        <Stat label="Biaya iklan" value={rupiah(t.biaya)} />
        <Stat label="Penjualan" value={rupiah(t.jual)} />
        <Stat label="ROAS" value={t.roas} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-zinc-950/60 uppercase text-[10px] text-zinc-500">
            <tr>
              <th className="px-3 py-2">{isMandiri ? 'Info iklan' : 'Iklan produk'}</th>
              <th className="px-3 py-2">Modal</th>
              <th className="px-3 py-2">Target ROAS</th>
              <th className="px-3 py-2">Biaya</th>
              <th className="px-3 py-2">Penjualan</th>
              {!isMandiri && <th className="px-3 py-2">Konversi</th>}
              {!isMandiri && <th className="px-3 py-2">Terjual</th>}
              {isMandiri && <th className="px-3 py-2">Diagnosis</th>}
              <th className="px-3 py-2">ROAS</th>
              <th className="px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2 max-w-[220px] truncate">{text(isMandiri ? r.infoIklan : r.iklanProduk)}</td>
                <td className="px-3 py-2 font-mono">{rupiah(num(r.modalHarian))}</td>
                <td className="px-3 py-2 font-mono">{text(r.targetRoas)}</td>
                <td className="px-3 py-2 font-mono">{rupiah(num(r.biayaIklan))}</td>
                <td className="px-3 py-2 font-mono">{rupiah(num(r.penjualan))}</td>
                {!isMandiri && <td className="px-3 py-2 font-mono">{text(r.konversi)}</td>}
                {!isMandiri && <td className="px-3 py-2 font-mono">{text(r.produkTerjual)}</td>}
                {isMandiri && <td className="px-3 py-2">{text(r.diagnosis)}</td>}
                <td className="px-3 py-2 font-mono text-[#f5d77f]">{text(r.roas)}</td>
                <td className="px-3 py-2 max-w-[240px] truncate text-zinc-400">{text(r.note)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#d4af37]">{title}</h4>
        <span className="text-[10px] font-mono text-zinc-500">{count} row{count === 1 ? '' : 's'}</span>
      </div>
      {count === 0 ? <p className="text-xs text-zinc-600">Nothing entered.</p> : children}
    </div>
  );
}

const stamp = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

export function AdvertiserLogDetail({
  log, onClose, onEdit,
}: {
  log: LogSummary;
  onClose: () => void;
  onEdit: (session: number) => void;
}) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [active, setActive] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;
    fetchAdvertiserLogDetail(log.client_id, log.report_date).then((res) => {
      if (cancelled) return;
      const rows = (res.data || []) as SessionRow[];
      setSessions(rows);
      if (rows.length > 0) setActive(rows[0].session);
    });
    return () => {
      cancelled = true;
    };
  }, [log.client_id, log.report_date]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const current = sessions?.find((s) => s.session === active) || null;
  const inkubasi = current ? (Array.isArray(current.data_inkubasi) ? current.data_inkubasi : []).filter(hasData) : [];
  const groups = current ? normalizeGroup(current.data_group).filter(hasData) : [];
  const mandiri = current ? (Array.isArray(current.data_mandiri) ? current.data_mandiri : []).filter(hasData) : [];

  const groupNames = Array.from(new Set(groups.map((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}`)));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-3 md:p-8 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-2xl border border-[#d4af37]/30 bg-[#0e0f14] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 p-5 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-extrabold text-white">{log.client_name}</h2>
            <p className="text-xs text-zinc-400 mt-1">
              {new Date(log.report_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} ·{' '}
              <span className="text-[#d4af37] font-mono">{log.advertiser_name}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sessions === null ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 text-[#d4af37] animate-spin" /></div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">No saved data for this day.</div>
        ) : (
          <div className="p-5 space-y-5">
            {log.recommendation && (
              <div className="rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-2 text-xs text-[#f5d77f]">
                <span className="font-bold uppercase tracking-wider">Recommendation: </span>{log.recommendation}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3].map((n) => {
                const done = sessions.some((s) => s.session === n);
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={!done}
                    onClick={() => setActive(n)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                      active === n && done
                        ? 'bg-[#d4af37] text-black border-[#d4af37]'
                        : done
                          ? 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:border-[#d4af37]/50'
                          : 'bg-transparent text-zinc-700 border-zinc-800 cursor-not-allowed'
                    }`}
                  >
                    Sesi {n}{done ? '' : ' · empty'}
                  </button>
                );
              })}
            </div>

            {current && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-zinc-500">
                    Saved {stamp(current.created_at)}
                    {current.updated_at && current.updated_at !== current.created_at ? ` · last edited ${stamp(current.updated_at)}` : ''}
                    {' '}by <span className="text-zinc-300">{current.advertiser_name}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => onEdit(current.session)}
                    className="inline-flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-white font-bold"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit Sesi {current.session}
                  </button>
                </div>

                {current.note && (
                  <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-2">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Session note</div>
                    <div className="text-sm text-zinc-200 whitespace-pre-wrap">{current.note}</div>
                  </div>
                )}

                {current.screenshot_url && (
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Screenshot</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={current.screenshot_url} alt="Advertiser screenshot" className="max-h-[360px] rounded-lg border border-zinc-800 object-contain" />
                  </div>
                )}

                <Section title="Inkubasi" count={inkubasi.length}>
                  <RowsTable rows={inkubasi} kind="inkubasi" />
                </Section>

                <Section title="Iklan Group" count={groups.length}>
                  <div className="space-y-4">
                    {groupNames.map((key) => {
                      const [category, name] = key.split('|');
                      const rows = groups.filter((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}` === key);
                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="text-[11px] font-bold text-zinc-300">
                            {name} {category && <span className="ml-1 text-[10px] text-zinc-500 uppercase">{category}</span>}
                          </div>
                          <RowsTable rows={rows} kind="group" />
                        </div>
                      );
                    })}
                  </div>
                </Section>

                <Section title="Mandiri" count={mandiri.length}>
                  <RowsTable rows={mandiri} kind="mandiri" />
                </Section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
