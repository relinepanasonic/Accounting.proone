import React from 'react';
import { Document, Page, View, Text, Svg, Rect, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { roas, type PerfAds, type PerfTotals } from '@/lib/integrations/performance';
import { int, periodText, roasText, rp, type WeeklyPayload } from './weekly';

/** The weekly client report as a PDF: one A4 page, drawn from the numbers saved with the draft. Server-side (no browser needed). */

const GOLD = '#b8901f';
const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const GREEN = '#059669';
const RED = '#dc2626';
const BLUE = '#2563eb';

const st = StyleSheet.create({
  page: { padding: 32, paddingBottom: 44, fontFamily: 'Helvetica', fontSize: 10, color: INK },
  band: { backgroundColor: '#1f2937', borderRadius: 6, padding: 16, marginBottom: 16 },
  kicker: { fontSize: 8, color: '#fcd34d', letterSpacing: 1.5 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginTop: 4 },
  sub: { fontSize: 10, color: '#d1d5db', marginTop: 4 },
  h2: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: GOLD, marginTop: 14, marginBottom: 6 },
  head: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5 },
  th: { fontSize: 8, color: MUTED, fontFamily: 'Helvetica-Bold' },
  c1: { width: '34%' }, c2: { width: '24%', textAlign: 'right' }, c3: { width: '24%', textAlign: 'right' }, c4: { width: '18%', textAlign: 'right' },
  note: { fontSize: 8, color: MUTED, marginTop: 14 },
  footer: { position: 'absolute', bottom: 22, left: 32, right: 32, fontSize: 8, color: MUTED, flexDirection: 'row', justifyContent: 'space-between' },
});

/** "+12%" green / "-5%" red / "0%" grey, or "-" without a comparison. `goodWhenUp: false` leaves a cost neutral. */
function Change({ now, before, goodWhenUp = true }: { now: number; before: number | null | undefined; goodWhenUp?: boolean }) {
  if (!before || before <= 0) return <Text style={{ color: MUTED }}>-</Text>;
  const p = ((now - before) / before) * 100;
  if (Math.abs(p) < 0.5) return <Text style={{ color: MUTED }}>0%</Text>;
  const up = p > 0;
  const color = !goodWhenUp ? '#d97706' : up ? GREEN : RED;
  // The built-in PDF font has no arrow glyphs, so the direction is a plain + or -.
  return <Text style={{ color, fontFamily: 'Helvetica-Bold' }}>{up ? '+' : '-'}{Math.abs(p) >= 10 ? Math.round(Math.abs(p)) : (Math.round(Math.abs(p) * 10) / 10).toString().replace('.', ',')}%</Text>;
}

function Row({ label, now, before, fmt, goodWhenUp = true }: { label: string; now: number; before: number | null | undefined; fmt: (n: number) => string; goodWhenUp?: boolean }) {
  return (
    <View style={st.row} wrap={false}>
      <Text style={st.c1}>{label}</Text>
      <Text style={st.c2}>{fmt(now)}</Text>
      <Text style={[st.c3, { color: MUTED }]}>{before === null || before === undefined ? '-' : fmt(before)}</Text>
      <View style={[st.c4, { alignItems: 'flex-end' }]}><Change now={now} before={before} goodWhenUp={goodWhenUp} /></View>
    </View>
  );
}

function Bars({ items }: { items: Array<{ label: string; now: number; before: number | null }> }) {
  const max = Math.max(1, ...items.flatMap((i) => [i.now, i.before || 0]));
  const W = 150;
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      {items.map((i) => (
        <View key={i.label} style={{ width: 160 }}>
          <Text style={{ fontSize: 8, color: MUTED, marginBottom: 3 }}>{i.label}</Text>
          <Svg width={W} height={34}>
            <Rect x={0} y={2} width={Math.max(1, (W * (i.before || 0)) / max)} height={12} fill="#d1d5db" />
            <Rect x={0} y={19} width={Math.max(1, (W * i.now) / max)} height={12} fill={BLUE} />
          </Svg>
          <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>abu-abu: minggu lalu · biru: minggu ini</Text>
        </View>
      ))}
    </View>
  );
}

const adsRow = (a: PerfAds) => ({ cost: a.cost, sales: a.sales, roas: roas(a.sales, a.cost) });

export function WeeklyDocument({ p }: { p: WeeklyPayload }) {
  const { cur, prev } = p;
  const a = cur.ads.total;
  const pa = prev?.ads.total;
  const types: Array<[string, PerfAds]> = [['GMV Max Auto', cur.ads.gmvMax], ['Group Ads', cur.ads.group], ['Iklan Mandiri', cur.ads.independent]];
  const typeRows = types.filter(([, x]) => x.cost > 0 || x.sales > 0);

  return (
    <Document title={`Weekly Report ${periodText(p.from, p.to)} - ${p.store}`} author="Professor Online">
      <Page size="A4" style={st.page}>
        <View style={st.band}>
          <Text style={st.kicker}>PROFESSOR ONLINE</Text>
          <Text style={st.title}>Weekly Report</Text>
          <Text style={st.sub}>{periodText(p.from, p.to)}</Text>
          <Text style={[st.sub, { color: '#ffffff', fontFamily: 'Helvetica-Bold' }]}>{p.store}{p.client && p.client.toLowerCase() !== p.store.toLowerCase() ? ` · ${p.client}` : ''}</Text>
        </View>

        <Text style={st.h2}>Ringkasan Performa Toko</Text>
        <View style={st.head}>
          <Text style={[st.th, st.c1]}>METRIK</Text><Text style={[st.th, st.c2]}>MINGGU INI</Text><Text style={[st.th, st.c3]}>MINGGU LALU</Text><Text style={[st.th, st.c4]}>PERUBAHAN</Text>
        </View>
        <Row label="GMV Toko" now={cur.gmv} before={prev?.gmv} fmt={rp} />
        <Row label="Pesanan" now={cur.orders} before={prev?.orders} fmt={int} />
        <Row label="Pengunjung" now={cur.traffic} before={prev?.traffic} fmt={int} />

        {(a.cost > 0 || a.sales > 0) && (
          <>
            <Text style={st.h2}>Iklan</Text>
            <View style={st.head}>
              <Text style={[st.th, st.c1]}>METRIK</Text><Text style={[st.th, st.c2]}>MINGGU INI</Text><Text style={[st.th, st.c3]}>MINGGU LALU</Text><Text style={[st.th, st.c4]}>PERUBAHAN</Text>
            </View>
            <Row label="Biaya Iklan" now={a.cost} before={pa?.cost} fmt={rp} goodWhenUp={false} />
            <Row label="Penjualan dari Iklan" now={a.sales} before={pa?.sales} fmt={rp} />
            <View style={st.row} wrap={false}>
              <Text style={st.c1}>ROAS</Text>
              <Text style={st.c2}>{roasText(a.sales, a.cost)}</Text>
              <Text style={[st.c3, { color: MUTED }]}>{pa && pa.cost > 0 ? roasText(pa.sales, pa.cost) : '-'}</Text>
              <View style={[st.c4, { alignItems: 'flex-end' }]}><Change now={adsRow(a).roas} before={pa && pa.cost > 0 ? adsRow(pa).roas : null} /></View>
            </View>

            {typeRows.length > 1 && (
              <>
                <Text style={st.h2}>Rincian Jenis Iklan (minggu ini)</Text>
                <View style={st.head}>
                  <Text style={[st.th, st.c1]}>JENIS IKLAN</Text><Text style={[st.th, st.c2]}>BIAYA</Text><Text style={[st.th, st.c3]}>PENJUALAN</Text><Text style={[st.th, st.c4]}>ROAS</Text>
                </View>
                {typeRows.map(([name, x]) => (
                  <View key={name} style={st.row} wrap={false}>
                    <Text style={st.c1}>{name}</Text><Text style={st.c2}>{rp(x.cost)}</Text><Text style={st.c3}>{rp(x.sales)}</Text><Text style={st.c4}>{roasText(x.sales, x.cost)}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        <Text style={st.h2}>Perbandingan dengan Minggu Lalu</Text>
        <Bars items={[
          { label: 'GMV Toko', now: cur.gmv, before: prev ? prev.gmv : null },
          { label: 'Penjualan dari Iklan', now: a.sales, before: pa ? pa.sales : null },
          { label: 'Biaya Iklan', now: a.cost, before: pa ? pa.cost : null },
        ]} />

        <Text style={st.note}>Angka dihitung dari data toko minggu {periodText(p.from, p.to)}, dibandingkan dengan minggu sebelumnya. ROAS = penjualan dari iklan dibagi biaya iklan.</Text>
        <View style={st.footer} fixed>
          <Text>Professor Online</Text>
          <Text>Weekly Report {periodText(p.from, p.to)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderWeeklyPdf(p: WeeklyPayload): Promise<Buffer> {
  return renderToBuffer(<WeeklyDocument p={p} />);
}

export type { PerfTotals };
