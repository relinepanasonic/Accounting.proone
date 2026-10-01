'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, Pencil, Download, MessageCircle } from 'lucide-react';
import { fetchAdvertiserLogDetail, fetchPreviousSession } from '@/app/actions/advertiser';
import {
  buildReportMessage,
  compareSessions,
  hasData,
  normalizeGroup,
  num,
  previousLabel,
  rupiah,
  saldoDisplay,
  sessionPdfFileName,
  splitReportDate,
  text,
  totals,
  type PreviousSession,
} from '@/lib/advertiser/report-utils';
import { buildReportJpeg, buildReportPdf, downloadBlob } from '@/lib/advertiser/build-pdf';
import { AdvertiserSessionReport } from './AdvertiserSessionReport';
import { RecommendationPanel } from './RecommendationList';
import type { Recommendation } from '@/lib/advertiser/optimasi';

interface LogSummary {
  client_id: string;
  client_name: string;
  report_date: string;
  advertiser_name: string;
  recommendation?: string;
  recs?: Recommendation[];
}

interface SessionRow {
  session: number;
  note: string | null;
  data_inkubasi: any;
  data_group: any;
  data_mandiri: any;
  screenshot_url: string | null;
  sisa_saldo_iklan?: string | null;
  created_at: string;
  updated_at?: string | null;
  advertiser_name: string;
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
  const reportRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<{ status: 'building' | 'ready' | 'error'; blob?: Blob; fileName?: string; error?: string }>({ status: 'building' });
  const [jpeg, setJpeg] = useState<{ blob?: Blob; fileName?: string; error?: string }>({});
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [prev, setPrev] = useState<{ loaded: boolean; data: PreviousSession | null }>({ loaded: false, data: null });
  // The big screenshot makes the PDF/JPEG heavy, so it is left out unless asked for.
  const [includeShot, setIncludeShot] = useState(false);

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

  useEffect(() => {
    if (!sessions || sessions.length === 0) return;
    let cancelled = false;
    setPrev({ loaded: false, data: null });
    fetchPreviousSession(log.client_id, log.report_date, active).then((res) => {
      if (!cancelled) setPrev({ loaded: true, data: (res.data as PreviousSession | null) ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [log.client_id, log.report_date, active, sessions]);

  const current = sessions?.find((s) => s.session === active) || null;
  const inkubasi = current ? (Array.isArray(current.data_inkubasi) ? current.data_inkubasi : []).filter(hasData) : [];
  const groups = current ? normalizeGroup(current.data_group).filter(hasData) : [];
  const mandiri = current ? (Array.isArray(current.data_mandiri) ? current.data_mandiri : []).filter(hasData) : [];

  // Build the PDF in the background whenever the viewed session changes. Browsers only allow "share" right
  // after a click, so having the file ready beforehand is what makes the WhatsApp button work.
  useEffect(() => {
    if (!current || !prev.loaded) return;
    let cancelled = false;
    setPdf({ status: 'building' });
    setJpeg({});
    setShareNotice(null);
    const timer = setTimeout(async () => {
      try {
        if (!reportRef.current) throw new Error('Report not ready.');
        const blob = await buildReportPdf(reportRef.current);
        if (!cancelled) setPdf({ status: 'ready', blob, fileName: sessionPdfFileName(log.report_date, current.session, log.client_name) });
        // The JPEG is made right after, so it is also ready when you click.
        try {
          const img = await buildReportJpeg(reportRef.current);
          if (!cancelled) setJpeg({ blob: img, fileName: sessionPdfFileName(log.report_date, current.session, log.client_name, 'jpg') });
        } catch (imgErr: any) {
          if (!cancelled) setJpeg({ error: imgErr?.message || 'Could not build the image.' });
        }
      } catch (err: any) {
        if (!cancelled) setPdf({ status: 'error', error: err?.message || 'Could not build the PDF.' });
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.session, current?.created_at, sessions, prev.loaded, prev.data, includeShot]);

  const reportMessage = current
    ? buildReportMessage({
        clientName: log.client_name,
        reportDate: log.report_date,
        session: current.session,
        sisaSaldo: current.sisa_saldo_iklan,
        sections: compareSessions(current, prev.data),
        hasPrevious: prev.data !== null,
      })
    : '';

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(reportMessage);
      setShareNotice('Message text copied. Paste it into the WhatsApp chat.');
    } catch {
      setShareNotice('Could not copy automatically: select the text in the preview below and copy it.');
    }
  };

  const handleDownloadJpeg = () => {
    if (!jpeg.blob || !jpeg.fileName) return;
    downloadBlob(jpeg.blob, jpeg.fileName);
  };

  const handleDownload = () => {
    if (pdf.status !== 'ready' || !pdf.blob || !pdf.fileName) return;
    downloadBlob(pdf.blob, pdf.fileName);
  };

  // WhatsApp Web cannot be handed a file by a web page, so: save the PDF, open WhatsApp Web, and the file is
  // attached by hand (drag it in from the browser's download bar, or use the + / paperclip button).
  const handleWhatsAppWeb = () => {
    if (pdf.status !== 'ready' || !pdf.blob || !pdf.fileName || !current) return;
    const message = reportMessage;
    window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    downloadBlob(pdf.blob, pdf.fileName);
    setShareNotice(`Saved "${pdf.fileName}" to your downloads and opened WhatsApp Web. Choose the chat, then drag the file from your browser's download list into it, or click + and Document.`);
  };

  const handleWhatsApp = async () => {
    if (pdf.status !== 'ready' || !pdf.blob || !pdf.fileName || !current) return;
    const message = reportMessage;
    const file = new File([pdf.blob], pdf.fileName, { type: 'application/pdf' });

    // Phones (and some desktop browsers) can hand the PDF straight to WhatsApp through the share sheet.
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: pdf.fileName.replace(/\.pdf$/i, ''), text: message });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // the user closed the share sheet
      }
    }

    // Otherwise: save the file and open WhatsApp, where the PDF has to be attached by hand.
    downloadBlob(pdf.blob, pdf.fileName);
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    setShareNotice('PDF saved to your downloads. In WhatsApp, choose the chat and attach that file.');
  };

  const groupNames = Array.from(new Set(groups.map((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}`)));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-3 md:p-8 overflow-y-auto" onClick={onClose}>
      {current && <AdvertiserSessionReport ref={reportRef} clientName={log.client_name} reportDate={log.report_date} data={current} previous={prev.data} includeScreenshot={includeShot} />}
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
            <RecommendationPanel recs={log.recs} />

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
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={pdf.status !== 'ready'}
                      className="inline-flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-white font-bold"
                    >
                      {pdf.status === 'building' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyText}
                      disabled={!prev.loaded}
                      title="Copy the message text for WhatsApp"
                      className="inline-flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-white font-bold"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Copy text
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadJpeg}
                      disabled={!jpeg.blob}
                      title={jpeg.error ? jpeg.error : 'Save the whole report as one JPEG image'}
                      className="inline-flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-1.5 rounded-lg text-white font-bold"
                    >
                      {!jpeg.blob && !jpeg.error ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} JPEG
                    </button>
                    <button
                      type="button"
                      onClick={handleWhatsApp}
                      disabled={pdf.status !== 'ready'}
                      title="Share sheet: WhatsApp desktop app or phone"
                      className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-1.5 rounded-lg text-white font-bold"
                    >
                      {pdf.status === 'building' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />} WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={handleWhatsAppWeb}
                      disabled={pdf.status !== 'ready'}
                      title="Opens WhatsApp Web and saves the PDF so you can drop it into the chat"
                      className="inline-flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-white font-bold"
                    >
                      {pdf.status === 'building' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />} WhatsApp Web
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(current.session)}
                      className="inline-flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-white font-bold"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit Sesi {current.session}
                    </button>
                  </div>
                </div>
                {(pdf.status === 'error' || shareNotice) && (
                  <p className={`text-xs ${pdf.status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {pdf.status === 'error' ? `PDF failed: ${pdf.error}` : shareNotice}
                  </p>
                )}
                {prev.loaded && (
                  <details className="rounded-lg border border-zinc-800 bg-black/20 px-3 py-2">
                    <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-zinc-400">Message text for WhatsApp</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-200 font-sans">{reportMessage}</pre>
                  </details>
                )}
                {pdf.status === 'ready' && pdf.fileName && <p className="text-[10px] font-mono text-zinc-600">{pdf.fileName} · no recommendation included</p>}

                <div className="flex flex-wrap items-center gap-3">
                  {saldoDisplay(current.sisa_saldo_iklan) && (
                    <div className="rounded-lg border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-[#d4af37]">Sisa saldo iklan</div>
                      <div className="text-base font-extrabold text-[#f5d77f] font-mono">{saldoDisplay(current.sisa_saldo_iklan)}</div>
                    </div>
                  )}
                  <label className="inline-flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
                    <input type="checkbox" checked={includeShot} onChange={(e) => setIncludeShot(e.target.checked)} className="accent-[#d4af37]" />
                    Include screenshot in PDF / JPEG <span className="text-zinc-600">(off = lighter file)</span>
                  </label>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-black/20 p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#d4af37]">Perubahan Ads</h4>
                    <span className="text-[11px] text-zinc-500">
                      {!prev.loaded ? 'loading...' : prev.data ? `dibandingkan dengan ${previousLabel(prev.data)}` : 'belum ada sesi sebelumnya'}
                    </span>
                  </div>
                  {prev.loaded && prev.data &&
                    compareSessions(current, prev.data).map((section) => (
                      <div key={section.title}>
                        <div className="text-[11px] font-bold text-zinc-300 mb-1">{section.title}</div>
                        <ol className="space-y-1">
                          {section.lines.map((line, i) => (
                            <li key={i} className={`text-xs flex gap-2 ${line.changed ? 'text-[#f5d77f] font-semibold' : 'text-zinc-400'}`}>
                              <span className="w-5 text-zinc-600">{i + 1}.</span>
                              <span>
                                {!line.label.startsWith('Baris ') && <span className="text-zinc-500">{line.label}: </span>}
                                {line.text}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
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

                <Section title="GMV Max Auto" count={inkubasi.length}>
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
