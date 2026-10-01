import React from 'react';
import { hasData, longReportDate, normalizeGroup, num, rupiah, text, totals } from '@/lib/advertiser/report-utils';

export interface ReportSession {
  session: number;
  note: string | null;
  data_inkubasi: any;
  data_group: any;
  data_mandiri: any;
  screenshot_url: string | null;
  created_at: string;
  advertiser_name: string;
}

// The printable report: white background, A4 width, no recommendation.
// Each [data-pdf-block] becomes a piece of the PDF, so a table is never cut through the middle of a block.
export const PDF_WIDTH_PX = 794;

const th: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '6px 8px', fontSize: 11, color: '#111827', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };

function Stats({ rows }: { rows: any[] }) {
  const t = totals(rows);
  const items: [string, string][] = [
    ['Modal harian', rupiah(t.modal)],
    ['Biaya iklan', rupiah(t.biaya)],
    ['Penjualan', rupiah(t.jual)],
    ['ROAS', t.roas],
  ];
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', background: '#f9fafb' }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function RowsTable({ rows, mandiri }: { rows: any[]; mandiri?: boolean }) {
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
          {mandiri && <th style={th}>Diagnosis</th>}
          <th style={th}>ROAS</th>
          <th style={th}>Note</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={td}>{text(mandiri ? r.infoIklan : r.iklanProduk)}</td>
            <td style={td}>{rupiah(num(r.modalHarian))}</td>
            <td style={td}>{text(r.targetRoas)}</td>
            <td style={td}>{rupiah(num(r.biayaIklan))}</td>
            <td style={td}>{rupiah(num(r.penjualan))}</td>
            {!mandiri && <td style={td}>{text(r.konversi)}</td>}
            {!mandiri && <td style={td}>{text(r.produkTerjual)}</td>}
            {mandiri && <td style={td}>{text(r.diagnosis)}</td>}
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

export const AdvertiserSessionReport = React.forwardRef<HTMLDivElement, { clientName: string; reportDate: string; data: ReportSession }>(
  function AdvertiserSessionReport({ clientName, reportDate, data }, ref) {
    const inkubasi = (Array.isArray(data.data_inkubasi) ? data.data_inkubasi : []).filter(hasData);
    const groups = normalizeGroup(data.data_group).filter(hasData);
    const mandiri = (Array.isArray(data.data_mandiri) ? data.data_mandiri : []).filter(hasData);
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
          {data.note && (
            <div style={{ marginTop: 14, border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Catatan</div>
              <div style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{data.note}</div>
            </div>
          )}
        </div>

        {data.screenshot_url && (
          <div data-pdf-block style={block}>
            <div style={sectionTitle}>Screenshot</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.screenshot_url} alt="" style={{ maxWidth: '100%', maxHeight: 640, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 6 }} />
          </div>
        )}

        {inkubasi.length > 0 && (
          <div data-pdf-block style={block}>
            <div style={sectionTitle}>Inkubasi</div>
            <Stats rows={inkubasi} />
            <RowsTable rows={inkubasi} />
          </div>
        )}

        {groupKeys.map((key) => {
          const [category, name] = key.split('|');
          const rows = groups.filter((g) => `${g.groupCategory || ''}|${g.groupName || 'Group'}` === key);
          return (
            <div data-pdf-block key={key} style={block}>
              <div style={sectionTitle}>
                Iklan Group · {name}
                {category ? ` (${category})` : ''}
              </div>
              <Stats rows={rows} />
              <RowsTable rows={rows} />
            </div>
          );
        })}

        {mandiri.length > 0 && (
          <div data-pdf-block style={block}>
            <div style={sectionTitle}>Mandiri</div>
            <Stats rows={mandiri} />
            <RowsTable rows={mandiri} mandiri />
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
