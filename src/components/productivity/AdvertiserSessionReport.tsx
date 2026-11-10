import React from 'react';
import {
  compareSessions,
  hasData,
  longReportDate,
  normalizeGroup,
  num,
  previousLabel,
  rupiah,
  saldoDisplay,
  text,
  totals,
  TONE_PDF,
  rowDirs,
  statChanges,
  vsLabel,
  type Pct,
  type Dir,
  type StatChanges,
  type PreviousSession,
} from '@/lib/advertiser/report-utils';

import { allShots, parseShots } from '@/lib/advertiser/screenshots';

export interface ReportSession {
  session: number;
  note: string | null;
  data_inkubasi: any;
  data_group: any;
  data_mandiri: any;
  screenshot_url: string | null;
  sisa_saldo_iklan?: string | null;
  created_at: string;
  advertiser_name: string;
}

// The printable report: white background, A4 width, no recommendation.
// Each [data-pdf-block] becomes a piece of the PDF, so a table is never cut through the middle of a block.
export const PDF_WIDTH_PX = 794;

const th: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '6px 8px', fontSize: 11, color: '#111827', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };

const DIR_COLOR: Record<string, string> = { up: '#15803d', down: '#dc2626', same: '#4b5563' };

function Stats({ rows, change, vs }: { rows: any[]; change?: StatChanges | null; vs?: string }) {
  const t = totals(rows);
  const items: [string, string, Pct | null][] = [
    ['Modal harian', rupiah(t.modal), change?.modal ?? null],
    ['Biaya iklan', rupiah(t.biaya), change?.biaya ?? null],
    ['Penjualan', rupiah(t.jual), change?.jual ?? null],
    ['ROAS', t.roas, change?.roas ?? null],
  ];
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      {items.map(([label, value, pct]) => (
        <div key={label} style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', background: '#f9fafb' }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{value}</div>
          {pct && <div style={{ fontSize: 10, fontWeight: 700, marginTop: 2, color: DIR_COLOR[pct.dir] }}>{pct.text}{vs ? <span style={{ fontWeight: 400, color: '#6b7280' }}> vs {vs}</span> : null}</div>}
        </div>
      ))}
    </div>
  );
}

function RowsTable({ rows, mandiri, prevRows }: { rows: any[]; mandiri?: boolean; prevRows?: any[] | null }) {
  const dirs = rowDirs(rows, prevRows ?? null);
  const tone = (d: Dir | null): React.CSSProperties => (d === 'up' || d === 'down' ? { color: DIR_COLOR[d], fontWeight: 700 } : {});
  const money: React.CSSProperties = { whiteSpace: 'nowrap' };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={th}>{mandiri ? 'Info iklan' : 'Iklan produk'}</th>
          <th style={th}>Modal</th>
          <th style={th}>Target ROAS</th>
          <th style={th}>Biaya</th>
          <th style={th}>Penjualan</th>
          {!mandiri && <th style={th}>Konversi</th>}
          {!mandiri && <th style={th}>Terjual</th>}
          <th style={th}>ROAS</th>
          <th style={th}>Note</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={td}>{text(mandiri ? r.infoIklan : r.iklanProduk)}</td>
            <td style={{ ...td, ...money, ...tone(dirs[i].modal) }}>{rupiah(num(r.modalHarian))}</td>
            <td style={{ ...td, ...tone(dirs[i].target) }}>{text(r.targetRoas)}</td>
            <td style={{ ...td, ...money }}>{rupiah(num(r.biayaIklan))}</td>
            <td style={{ ...td, ...money }}>{rupiah(num(r.penjualan))}</td>
            {!mandiri && <td style={td}>{text(r.konversi)}</td>}
            {!mandiri && <td style={td}>{text(r.produkTerjual)}</td>}
            <td style={{ ...td, fontWeight: 700 }}>{text(r.roas)}</td>
            <td style={td}>{text(r.note)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const block: React.CSSProperties = { padding: '18px 32px', background: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', color: '#111827' };
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#8a6d1d', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' };

export const AdvertiserSessionReport = React.forwardRef<
  HTMLDivElement,
  { clientName: string; reportDate: string; data: ReportSession; previous?: PreviousSession | null; includeScreenshot?: boolean }
>(
  function AdvertiserSessionReport({ clientName, reportDate, data, previous = null, includeScreenshot = false }, ref) {
    const inkubasi = (Array.isArray(data.data_inkubasi) ? data.data_inkubasi : []).filter(hasData);
    const groups = normalizeGroup(data.data_group).filter(hasData);
    const mandiri = (Array.isArray(data.data_mandiri) ? data.data_mandiri : []).filter(hasData);
    const saldo = saldoDisplay(data.sisa_saldo_iklan);
    const changes = compareSessions(data, previous);
    const prevRowsOf = (raw: any) => (Array.isArray(raw) ? raw : []).filter(hasData);
    const prevInk = previous ? prevRowsOf(previous.data_inkubasi) : null;
    const prevGroups = previous ? normalizeGroup(previous.data_group).filter(hasData) : null;
    const prevMan = previous ? prevRowsOf(previous.data_mandiri) : null;
    const vs = vsLabel(reportDate, previous);
    const groupKeys = Array.from(new Set(groups.map((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}`)));

    return (
      // Off-screen but really rendered, so it can be captured. The blocks inside stay in normal flow.
      <div ref={ref} aria-hidden style={{ position: 'fixed', left: -10000, top: 0, width: PDF_WIDTH_PX, pointerEvents: 'none' }}>
        <div data-report-all style={{ background: '#ffffff' }}>
        <div data-pdf-block style={{ ...block, paddingTop: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8a6d1d', textTransform: 'uppercase', letterSpacing: 2 }}>Laporan Iklan · Sesi {data.session}</div>
          <div style={{ fontSize: 24, fontWeight: 800, margin: '6px 0 4px' }}>{clientName}</div>
          <div style={{ fontSize: 12, color: '#4b5563' }}>
            {longReportDate(reportDate)} · Advertiser: {data.advertiser_name}
          </div>
          {saldo && (
            <div style={{ marginTop: 10, display: 'inline-block', border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Sisa saldo iklan</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{saldo}</div>
            </div>
          )}
          {data.note && (
            <div style={{ marginTop: 14, border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Catatan</div>
              <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{data.note}</div>
            </div>
          )}
        </div>

        <div data-pdf-block style={block}>
          <div style={sectionTitle}>Perubahan Ads</div>
          {previous ? (
            <>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>Dibandingkan dengan {previousLabel(previous)}</div>
              {changes.length === 0 && <div style={{ fontSize: 12, color: '#6b7280' }}>Belum ada data iklan untuk dibandingkan.</div>}
              {changes.map((section) => (
                <div key={section.title} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#374151', marginBottom: 4 }}>{section.title}</div>
                  {section.lines.map((line, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '3px 0', fontWeight: line.changed ? 700 : 400 }}>
                      <span style={{ width: 20, color: '#6b7280' }}>{i + 1}.</span>
                      <span style={{ flex: 1 }}>
                        {line.label.startsWith('Baris ') ? '' : <span style={{ color: '#6b7280' }}>{line.label}: </span>}
                        {line.segments.map((seg, k) => <span key={k} style={{ color: TONE_PDF[seg.tone] }}>{seg.text}</span>)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#6b7280' }}>Belum ada sesi sebelumnya untuk dibandingkan.</div>
          )}
        </div>

        {includeScreenshot && allShots(parseShots(data.screenshot_url)).length > 0 && (
          <div data-pdf-block style={block}>
            <div style={sectionTitle}>Screenshot</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {allShots(parseShots(data.screenshot_url)).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" style={{ width: 360, maxHeight: 300, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 6 }} />
              ))}
            </div>
          </div>
        )}

        {inkubasi.length > 0 && (
          <div data-pdf-block style={block}>
            <div style={sectionTitle}>GMV Max Auto</div>
            <Stats rows={inkubasi} change={statChanges(inkubasi, prevInk)} vs={vs} />
            <RowsTable rows={inkubasi} prevRows={prevInk} />
          </div>
        )}

        {groupKeys.map((key) => {
          const [category, name] = key.split('|');
          const rows = groups.filter((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}` === key);
          const prevRows = prevGroups ? prevGroups.filter((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}` === key) : null;
          return (
            <div data-pdf-block key={key} style={block}>
              <div style={sectionTitle}>
                Iklan Group · {name}
                {category ? ` (${category})` : ''}
              </div>
              <Stats rows={rows} change={statChanges(rows, prevRows)} vs={vs} />
              <RowsTable rows={rows} prevRows={prevRows} />
            </div>
          );
        })}

        {mandiri.length > 0 && (
          <div data-pdf-block style={block}>
            <div style={sectionTitle}>Mandiri</div>
            <Stats rows={mandiri} change={statChanges(mandiri, prevMan)} vs={vs} />
            <RowsTable rows={mandiri} mandiri prevRows={prevMan} />
          </div>
        )}

        {inkubasi.length + groups.length + mandiri.length === 0 && (
          <div data-pdf-block style={block}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Belum ada data iklan yang diisi untuk sesi ini.</div>
          </div>
        )}
        </div>
      </div>
    );
  }
);
