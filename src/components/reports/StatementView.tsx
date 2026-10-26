'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Printer, CheckCircle2, AlertTriangle, TrendingUp, Scale, Waves } from 'lucide-react';
import type { Statement } from '@/lib/reports/financial-statements';
import type { LedgerHealth } from '@/lib/reports/financial-data';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const sel = 'rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-200 outline-none focus:border-[#d4af37]/60';

/** 1.234.567 and (1.234.567) for negatives; "-" for nothing. Rupiah in full. */
const fmt = (n: number | undefined) => {
  if (n === undefined) return '';
  const r = Math.round(n);
  if (r === 0) return '-';
  const s = Math.abs(r).toLocaleString('id-ID');
  return r < 0 ? `(${s})` : s;
};

export const REPORTS = [
  { key: 'profit-loss', id: 'Laba Rugi', en: 'Profit & Loss', icon: TrendingUp },
  { key: 'balance-sheet', id: 'Neraca', en: 'Balance Sheet', icon: Scale },
  { key: 'cash-flow', id: 'Arus Kas', en: 'Cash Flow', icon: Waves },
] as const;

export interface EntityOption { id: string; name: string }

/** A financial statement as it is printed: Indonesian line first, English under it, current and comparative columns. */
export function StatementView({ statement, kind, entities, entityId, year, month, to, eliminated, health }: {
  statement: Statement; kind: string; entities: EntityOption[]; entityId: string; year: number; month: number; years: number[]; to: string; eliminated: number; health: LedgerHealth;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(true);
  const go = (p: { entity?: string; year?: number; month?: number }) => {
    const e = p.entity ?? entityId; const y = p.year ?? year; const m = p.month ?? month;
    router.push(`/reports/${kind}?entity=${encodeURIComponent(e)}&year=${y}&month=${m}`);
  };
  const thisYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => thisYear - i);
  const lines = detail ? statement.lines : statement.lines.filter((l) => l.kind !== 'account');

  return (
    <div className="space-y-5">
      <div className="print:hidden flex flex-wrap items-center gap-2">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.key} href={`/reports/${r.key}?entity=${encodeURIComponent(entityId)}&year=${year}&month=${month}`}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold ${r.key === kind ? 'border-[#d4af37]/60 bg-[#d4af37]/10 text-[#f5d77f]' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'}`}>
              <Icon className="h-4 w-4" />{r.id} <span className="font-normal opacity-70">/ {r.en}</span>
            </Link>
          );
        })}
      </div>

      <div className="print:hidden flex flex-wrap items-center gap-2">
        <select value={entityId} onChange={(e) => go({ entity: e.target.value })} className={`${sel} min-w-[220px]`} aria-label="Entity">
          {entities.length > 1 && <option value="all">Konsolidasi (seluruh perusahaan)</option>}
          {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={year} onChange={(e) => go({ year: Number(e.target.value) })} className={sel} aria-label="Year">{yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <select value={month} onChange={(e) => go({ month: Number(e.target.value) })} className={sel} aria-label="Month">
          <option value={0}>{year === thisYear ? 'Tahun berjalan s.d. hari ini' : 'Satu tahun penuh'}</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <label className="flex items-center gap-2 text-[11px] text-zinc-400"><input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} className="accent-[#d4af37]" />Rincian akun</label>
        <button type="button" onClick={() => window.print()} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-2 text-xs font-bold text-[#f5d77f] hover:bg-[#d4af37]/20"><Printer className="h-4 w-4" />Cetak / Simpan PDF</button>
      </div>

      {(health.mismatched > 0 || health.orphans > 0) && (
        <div className="print:hidden mx-auto flex max-w-[900px] items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><b>Data buku besar perlu dibersihkan / The ledger needs a clean-up.</b> {health.mismatched} faktur dibukukan lebih dari sekali atau dengan jumlah yang salah{health.orphans ? ` dan ${health.orphans} jurnal faktur tanpa faktur` : ''}: pendapatan dan piutang di laporan ini lebih besar sekitar <b>Rp {health.overstated.toLocaleString('id-ID')}</b> dari faktur yang sebenarnya. / {health.mismatched} invoices are posted more than once or with a wrong amount: revenue and receivables here are about Rp {health.overstated.toLocaleString('id-ID')} higher than the invoices say.</div>
        </div>
      )}
      <article className="mx-auto max-w-[900px] rounded-2xl border border-[#d4af37]/20 bg-[#0e0f14] p-6 sm:p-10 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black">
        <header className="mb-6 border-b border-zinc-700 pb-5 text-center print:border-black">
          <div className="text-sm font-extrabold uppercase tracking-wider text-white print:text-black">{statement.entity}</div>
          <h1 className="mt-1 text-base font-extrabold tracking-wide text-[#f5d77f] print:text-black">{statement.titleId}</h1>
          <div className="text-[11px] italic text-zinc-400 print:text-zinc-700">{statement.titleEn}</div>
          <div className="mt-2 text-xs text-zinc-300 print:text-black">{statement.periodId}</div>
          <div className="text-[11px] italic text-zinc-500 print:text-zinc-700">{statement.periodEn}</div>
          <div className="mt-1 text-[10px] text-zinc-500 print:text-zinc-700">(Disajikan dalam Rupiah penuh / Expressed in full Rupiah)</div>
        </header>

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-zinc-600 text-[10px] uppercase tracking-wider text-zinc-400 print:border-black print:text-black">
              <th className="py-2 text-left font-bold">Keterangan / Description</th>
              <th className="w-[150px] py-2 text-right font-bold">{statement.currentLabel}</th>
              <th className="w-[150px] py-2 text-right font-bold">{statement.compareLabel}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const pad = l.level === 0 ? 'pl-0' : l.level === 1 ? 'pl-3' : l.level === 2 ? 'pl-7' : 'pl-11';
              if (l.kind === 'heading') {
                return <tr key={l.id}><td colSpan={3} className={`pb-1 pt-4 ${pad} text-[11px] font-extrabold tracking-wide text-[#f5d77f] print:text-black`}>{l.label}{l.labelEn && <span className="ml-2 font-normal italic text-zinc-500 print:text-zinc-600">{l.labelEn}</span>}</td></tr>;
              }
              const strong = l.kind === 'total' || l.kind === 'subtotal';
              const top = l.kind === 'total' ? 'border-t border-zinc-500 print:border-black' : l.kind === 'subtotal' ? 'border-t border-zinc-700 print:border-zinc-500' : '';
              const cls = l.kind === 'account' ? 'text-[11px] text-zinc-500 print:text-zinc-700' : strong ? 'font-extrabold text-white print:text-black' : 'text-zinc-200 print:text-black';
              return (
                <tr key={l.id} className={top}>
                  <td className={`py-1 ${pad} ${cls}`}>{l.code && <span className="mr-2 font-mono text-[10px] opacity-60">{l.code}</span>}{l.label}{l.labelEn && l.kind !== 'account' && <div className="text-[10px] font-normal italic text-zinc-500 print:text-zinc-600">{l.labelEn}</div>}</td>
                  <td className={`py-1 text-right font-mono tabular-nums ${cls}`}>{fmt(l.amount)}</td>
                  <td className={`py-1 text-right font-mono tabular-nums ${cls} ${l.kind === 'account' ? '' : 'text-zinc-400 print:text-zinc-700'}`}>{fmt(l.compare)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <footer className="mt-8 space-y-3 border-t border-zinc-700 pt-4 text-[10px] leading-relaxed text-zinc-500 print:border-black print:text-zinc-700">
          <p>Laporan ini disusun berdasarkan Standar Akuntansi Keuangan (SAK) di Indonesia: PSAK 1 (Penyajian Laporan Keuangan) dan PSAK 2 (Laporan Arus Kas, metode tidak langsung), dengan dasar akrual dari jurnal umum perusahaan. / Prepared in accordance with Indonesian Financial Accounting Standards (PSAK 1 and PSAK 2, indirect method), on the accrual basis, from the company ledger.</p>
          {eliminated > 0 && <p>Laporan konsolidasian: penjualan, beban pokok, piutang dan utang antar-perusahaan (New Wave dan PT Pintu) telah dieliminasi ({eliminated} faktur). / Consolidated: intercompany sales, cost, receivables and payables (New Wave and PT Pintu) are eliminated ({eliminated} invoices).</p>}
          <p>Periode: sampai dengan {to}. Pembanding: periode yang sama tahun sebelumnya (neraca: akhir tahun sebelumnya). / Comparative: the same period of the previous year (balance sheet: the end of the previous year).</p>
          <div className="print:hidden space-y-1.5 pt-1">
            {statement.checks.map((c) => (
              <div key={c.id} className={`flex items-start gap-2 ${c.ok ? 'text-emerald-400' : 'text-red-400'}`}>{c.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}<span>{c.id} / {c.en}{c.detail ? ` - ${c.detail}` : ''}</span></div>
            ))}
            {statement.warnings.map((w) => <div key={w} className="flex items-start gap-2 text-amber-300"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{w}</span></div>)}
          </div>
        </footer>
      </article>
    </div>
  );
}
