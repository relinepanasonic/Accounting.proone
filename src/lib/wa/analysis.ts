import type { PerfTotals } from '@/lib/integrations/performance';
import { cvrOf, int, roasOf, rp, type WeekPoint } from './weekly';

/**
 * "Temuan & Langkah Berikutnya" of the weekly report: a few findings and recommendations written from the numbers by fixed rules,
 * like the monthly report of Dashboard Prof. No AI: every sentence is built from a figure that is in the report. Pure.
 */

export interface Finding { tone: 'win' | 'watch'; title: string; text: string }
export interface Analysis { findings: Finding[]; tips: string[] }

const pct = (n: number) => `${Math.abs(n) >= 10 ? Math.round(Math.abs(n)) : (Math.round(Math.abs(n) * 10) / 10).toString().replace('.', ',')}%`;
const change = (now: number, before: number | null | undefined) => (before && before > 0 ? ((now - before) / before) * 100 : null);
const x1 = (n: number) => `${(Math.round(n * 10) / 10).toString().replace('.', ',')}x`;

const TYPES: Array<{ key: 'gmvMax' | 'group' | 'independent'; name: string }> = [
  { key: 'gmvMax', name: 'GMV Max Auto' },
  { key: 'group', name: 'Iklan Grup' },
  { key: 'independent', name: 'Iklan Mandiri' },
];

export function analyze(cur: PerfTotals, prev: PerfTotals | null, series?: WeekPoint[]): Analysis {
  const findings: Finding[] = [];
  const tips: string[] = [];
  const addTip = (t: string) => { if (!tips.includes(t)) tips.push(t); };

  // 1. Penjualan against last week.
  const salesCh = change(cur.sales, prev?.sales);
  if (salesCh !== null && salesCh >= 5) findings.push({ tone: 'win', title: `Penjualan naik ${pct(salesCh)}`, text: `${rp(cur.sales)} minggu ini vs ${rp(prev!.sales)} minggu lalu.` });
  if (salesCh !== null && salesCh <= -5) {
    findings.push({ tone: 'watch', title: `Penjualan turun ${pct(salesCh)}`, text: `${rp(cur.sales)} minggu ini vs ${rp(prev!.sales)} minggu lalu.` });
    addTip('Cek stok produk terlaris dan harga pesaing minggu ini, lalu lihat apakah ada hari dengan penjualan yang jatuh.');
  }

  // 2. Penjualan against the average of the 4 weeks before (only weeks that had sales).
  const before = (series || []).slice(0, -1).map((w) => w.sales).filter((s) => s > 0);
  if (before.length >= 3) {
    const avg = before.reduce((a, b) => a + b, 0) / before.length;
    const d = ((cur.sales - avg) / avg) * 100;
    if (d >= 10) findings.push({ tone: 'win', title: `${pct(d)} di atas rata-rata ${before.length} minggu sebelumnya`, text: `Penjualan minggu ini ${rp(cur.sales)}; rata-rata ${before.length} minggu sebelumnya ${rp(avg)}.` });
    else if (d <= -10) findings.push({ tone: 'watch', title: `${pct(d)} di bawah rata-rata ${before.length} minggu sebelumnya`, text: `Penjualan minggu ini ${rp(cur.sales)}; rata-rata ${before.length} minggu sebelumnya ${rp(avg)}.` });
  }

  // 3. ROAS (Penjualan / Biaya Iklan).
  const roasNow = roasOf(cur);
  const roasCh = prev && roasOf(prev) > 0 && roasNow > 0 ? change(roasNow, roasOf(prev)) : null;
  if (roasCh !== null && roasCh <= -10) {
    findings.push({ tone: 'watch', title: `ROAS turun ${pct(roasCh)}`, text: `${x1(roasNow)} minggu ini vs ${x1(roasOf(prev))} minggu lalu.` });
    addTip('Tinjau iklan dengan ROAS rendah dan kurangi modal pada iklan yang boros.');
  }
  if (roasCh !== null && roasCh >= 10) findings.push({ tone: 'win', title: `ROAS naik ${pct(roasCh)}`, text: `${x1(roasNow)} minggu ini vs ${x1(roasOf(prev))} minggu lalu: setiap Rp 1 iklan menghasilkan Rp ${(Math.round(roasNow * 10) / 10).toString().replace('.', ',')} penjualan.` });

  // 4. Biaya iklan naik tetapi penjualan tidak ikut naik.
  const costCh = change(cur.ads.total.cost, prev?.ads.total.cost);
  if (costCh !== null && costCh >= 15 && (salesCh === null || salesCh < 5)) {
    findings.push({ tone: 'watch', title: `Biaya iklan naik ${pct(costCh)}, penjualan belum ikut`, text: `Biaya iklan ${rp(cur.ads.total.cost)} (minggu lalu ${rp(prev!.ads.total.cost)}); penjualan ${salesCh === null ? 'belum bisa dibandingkan' : `${salesCh >= 0 ? 'naik' : 'turun'} ${pct(salesCh)}`}.` });
    addTip('Biaya iklan naik lebih cepat daripada penjualan: cek iklan yang boros dan tahan kenaikan modal sampai ROAS pulih.');
  }

  // 5. Keranjang yang tidak jadi pesanan.
  if (cur.addToCart > 0 && cur.orders > 0) {
    const gone = (1 - cur.orders / cur.addToCart) * 100;
    if (gone > 90) {
      findings.push({ tone: 'watch', title: `${pct(gone)} keranjang tidak jadi pesanan`, text: `${int(cur.addToCart)} masuk keranjang menghasilkan ${int(cur.orders)} pesanan.` });
      addTip('Keranjang ditinggalkan biasanya karena ongkir atau stok. Cek batas gratis ongkir dan voucher.');
    }
  }

  // 6. Conversion rate (pesanan / pengunjung) against last week.
  const cvrNow = cvrOf(cur);
  const cvrCh = prev && cvrOf(prev) > 0 && cvrNow > 0 ? change(cvrNow, cvrOf(prev)) : null;
  if (cvrCh !== null && cvrCh <= -15) {
    findings.push({ tone: 'watch', title: `Conversion rate turun ${pct(cvrCh)}`, text: `${(Math.round(cvrNow * 100) / 100).toString().replace('.', ',')}% pengunjung yang order, minggu lalu ${(Math.round(cvrOf(prev) * 100) / 100).toString().replace('.', ',')}%.` });
    addTip('Conversion turun: periksa harga, foto produk, dan ulasan pada produk yang paling banyak dikunjungi.');
  }

  // 7. Which ad type takes the budget but earns less than another.
  const types = TYPES.map((t) => ({ ...t, cost: cur.ads[t.key].cost, sales: cur.ads[t.key].sales })).filter((t) => t.cost > 0);
  const totalCost = types.reduce((a, t) => a + t.cost, 0);
  if (types.length >= 2 && totalCost > 0) {
    const best = [...types].sort((a, b) => b.sales / b.cost - a.sales / a.cost)[0];
    const heavy = [...types].sort((a, b) => b.cost - a.cost)[0];
    const share = (heavy.cost / totalCost) * 100;
    const rHeavy = heavy.sales / heavy.cost;
    const rBest = best.sales / best.cost;
    if (heavy.key !== best.key && share >= 40 && rBest >= rHeavy * 1.2) {
      findings.push({ tone: 'watch', title: `${heavy.name} adalah belanja paling besar tetapi bukan yang paling efisien`, text: `${heavy.name} mengambil ${pct(share)} budget iklan di ${x1(rHeavy)}, sedangkan ${best.name} menghasilkan ${x1(rBest)}.` });
      addTip(`Pindahkan sebagian budget ${heavy.name} ke ${best.name} lalu ukur ulang minggu depan.`);
    }
  }

  const watch = findings.filter((f) => f.tone === 'watch');
  const win = findings.filter((f) => f.tone === 'win');
  const ordered = [...watch.slice(0, 3), ...win.slice(0, 3)].slice(0, 5);
  if (ordered.length === 0) ordered.push({ tone: 'win', title: 'Performa stabil', text: 'Tidak ada perubahan besar dibanding minggu lalu.' });
  if (tips.length === 0) tips.push('Pertahankan strategi minggu ini dan pantau lagi minggu depan.');
  return { findings: ordered, tips: tips.slice(0, 3) };
}
