import { describe, it, expect } from 'vitest';
import { adTotals, advertisingRows, endingsOf, pipelineOf, sessionStatus, SPARK_DAYS, type BodDaily } from './bod-daily';
import { renderBodDailyPdf } from './bod-daily-pdf';

const row = (r: Partial<{ biaya: string; penjualan: string }> = {}) => [{ biayaIklan: r.biaya ?? '', penjualan: r.penjualan ?? '' }];
/** A session 1 inputted on `date` holds the numbers of the day before it. */
const s1 = (client: string, date: string, biaya: string, penjualan: string, store = 'ProOne - toko-a') => ({ client_id: client, report_date: date, session: 1, store_label: store, data_inkubasi: row({ biaya, penjualan }), data_group: [], data_mandiri: [] });
const names = new Map([['c1', 'Client Satu'], ['c2', 'Client Dua']]);

describe('advertisingRows', () => {
  it('reads Sales and Ads Cost of the day BEFORE the session-1 day, with ROAS and the change against the day before', () => {
    const reports = [
      s1('c1', '2026-11-11', 'Rp 100,000', 'Rp 400,000'),   // numbers of 10 Nov
      s1('c1', '2026-11-12', 'Rp 120,000', 'Rp 600,000'),   // numbers of 11 Nov
    ];
    const rows = advertisingRows(reports, names, '2026-11-11');
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r).toMatchObject({ client: 'Client Satu', store: 'ProOne - toko-a', sales: 600000, cost: 120000, roas: 5 });
    expect(r.salesTrend).toBeCloseTo(50);        // 400k -> 600k
    expect(r.costTrend).toBeCloseTo(20);
    expect(r.roasTrend).toBeCloseTo(25);         // 4 -> 5
    expect(r.salesSeries).toHaveLength(SPARK_DAYS);
    expect(r.salesSeries.slice(-2)).toEqual([400000, 600000]);
  });
  it('keeps two stores of one client apart, leaves out a store without any numbers, and sorts by Sales', () => {
    const reports = [
      s1('c1', '2026-11-12', 'Rp 10,000', 'Rp 50,000', 'ProOne - a'),
      s1('c1', '2026-11-12', 'Rp 20,000', 'Rp 900,000', 'ProOne - b'),
      s1('c2', '2026-11-12', '', '', 'ProOne - empty'),
    ];
    const rows = advertisingRows(reports, names, '2026-11-11');
    expect(rows.map((r) => r.store)).toEqual(['ProOne - b', 'ProOne - a']);
  });
  it('a day without numbers gives no trend instead of a false drop', () => {
    const rows = advertisingRows([s1('c1', '2026-11-12', 'Rp 10,000', 'Rp 50,000')], names, '2026-11-11');
    expect(rows[0].salesTrend).toBeNull();
  });
});

describe('adTotals and sessionStatus', () => {
  it('adds the stores up and takes ROAS from the totals, not the average of ROAS', () => {
    const rows = advertisingRows([s1('c1', '2026-11-12', 'Rp 100,000', 'Rp 200,000', 'a'), s1('c2', '2026-11-12', 'Rp 300,000', 'Rp 1,200,000', 'b')], names, '2026-11-11');
    const t = adTotals(rows);
    expect(t).toMatchObject({ sales: 1400000, cost: 400000, roas: 3.5 });
  });
  it('counts the clients that inputted each session on the day, only for clients that have an advertiser', () => {
    const reps = [
      { client_id: 'c1', report_date: '2026-11-12', session: 1 }, { client_id: 'c1', report_date: '2026-11-12', session: 2 },
      { client_id: 'c2', report_date: '2026-11-12', session: 1 }, { client_id: 'c2', report_date: '2026-11-11', session: 2 },
      { client_id: 'x', report_date: '2026-11-12', session: 1 },
    ];
    expect(sessionStatus(reps, ['c1', 'c2', 'c3'], '2026-11-12')).toEqual({ clients: 3, s1: 2, s2: 1, s3: 0 });
  });
});

describe('pipelineOf', () => {
  const deals = [
    { salesman_name: 'Lucy', stage: 'Lead', value: 1000, created_at: '2026-11-12T03:00:00Z', stage_changed_at: '2026-11-12T03:00:00Z' },
    { salesman_name: 'Lucy', stage: 'Negotiation', value: 5000, created_at: '2026-11-01T03:00:00Z', stage_changed_at: '2026-11-12T05:00:00Z' },
    { salesman_name: 'Rani', stage: 'Deal', value: 9000, created_at: '2026-10-01T03:00:00Z', stage_changed_at: '2026-10-20T03:00:00Z' },
    { salesman_name: null, stage: 'Cold Case', value: 0, created_at: '2026-09-01T03:00:00Z', stage_changed_at: null },
    { salesman_name: 'Rani', stage: 'Weird', value: 0, created_at: '2026-10-01T03:00:00Z', stage_changed_at: null },
  ];
  it('counts every stage (an unknown one counts as Lead), per salesperson, with new and moved on the day', () => {
    const p = pipelineOf(deals, '2026-11-12');
    expect(p.stages.map((s) => [s.stage, s.count])).toEqual([['Lead', 2], ['Contacted', 0], ['Negotiation', 1], ['Invoice', 0], ['Deal', 1], ['Cold Case', 1]]);
    expect(p.total).toBe(5);
    expect(p.newOnDay).toBe(1);        // the Lead entered that day
    expect(p.movedOnDay).toBe(1);      // the Negotiation deal that changed stage that day (a new deal is not also "moved")
    const lucy = p.bySales.find((x) => x.name === 'Lucy')!;
    expect(lucy).toMatchObject({ total: 2, newOnDay: 1, movedOnDay: 1 });
    expect(p.bySales.find((x) => x.name === 'Tanpa sales')!.counts['Cold Case']).toBe(1);
  });
});

describe('endingsOf', () => {
  const clients = [
    { name: 'Ended today', service_end_date: '2026-11-13' },
    { name: 'Ended 3 days ago', service_end_date: '2026-11-10', sales_name: 'Lucy' },
    { name: 'Ended 14 days ago', service_end_date: '2026-10-30' },
    { name: 'Ended 15 days ago', service_end_date: '2026-10-29' },
    { name: 'Ends tomorrow', service_end_date: '2026-11-14' },
    { name: 'Ends in 14 days', service_end_date: '2026-11-27' },
    { name: 'Ends in 15 days', service_end_date: '2026-11-28' },
    { name: 'No date', service_end_date: null },
    { name: 'Bad date', service_end_date: 'soon' },
  ];
  it('lists the projects that ended in the last 14 days (newest first) and those ending in the next 14 days (nearest first)', () => {
    const e = endingsOf(clients, '2026-11-13');
    expect(e.ended.map((x) => [x.client, x.days])).toEqual([['Ended today', 0], ['Ended 3 days ago', 3], ['Ended 14 days ago', 14]]);
    expect(e.soon.map((x) => [x.client, x.days])).toEqual([['Ends tomorrow', 1], ['Ends in 14 days', 14]]);
    expect(e.ended[1].sales).toBe('Lucy');
  });
});

describe('renderBodDailyPdf', () => {
  const sample: BodDaily = {
    reportDay: '2026-11-12', dataDay: '2026-11-11',
    sessions: { clients: 22, s1: 11, s2: 11, s3: 4 },
    advertisers: [{ name: 'Ayu', clients: 22, s1: 11, s2: 11, s3: 0 }, { name: 'Devi', clients: 15, s1: 11, s2: 5, s3: 0 }],
    ads: advertisingRows([s1('c1', '2026-11-11', 'Rp 100,000', 'Rp 400,000'), s1('c1', '2026-11-12', 'Rp 120,000', 'Rp 600,000')], names, '2026-11-11'),
    totals: { sales: 600000, cost: 120000, roas: 5, salesSeries: [0, 0, 0, 0, 0, 400000, 600000], costSeries: [0, 0, 0, 0, 0, 100000, 120000], roasSeries: [0, 0, 0, 0, 0, 4, 5] },
    admin: { lines: [{ name: 'Vani', files: 4, total: 8, uploaded: 2, uploadedNames: ['onat.hardware', 'botanea'], pendingNames: ['mery.farma'] }], errors: [], fo: { startedOnDay: ['Client Satu'], ongoing: 3 } },
    pipeline: pipelineOf([{ salesman_name: 'Lucy', stage: 'Lead', value: 1, created_at: '2026-11-12T03:00:00Z' }], '2026-11-12'),
    endings: endingsOf([{ name: 'Client Lama', service_end_date: '2026-11-10', sales_name: 'Lucy' }, { name: 'Client Baru', service_end_date: '2026-11-20' }], '2026-11-13'),
  };
  it('makes a 3-page PDF (one page per section) from the data', async () => {
    const pdf = await renderBodDailyPdf(sample);
    expect(Buffer.from(pdf.subarray(0, 4)).toString()).toBe('%PDF');
    const pages = (Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pages).toBe(3);
  }, 60000);
  it('still makes the PDF when there is no data at all', async () => {
    const empty: BodDaily = { ...sample, ads: [], totals: { sales: 0, cost: 0, roas: 0, salesSeries: [], costSeries: [], roasSeries: [] }, advertisers: [], admin: { lines: [], errors: [], fo: { startedOnDay: [], ongoing: 0 } }, pipeline: pipelineOf([], '2026-11-12'), endings: { ended: [], soon: [] } };
    const pdf = await renderBodDailyPdf(empty);
    expect(pdf.byteLength).toBeGreaterThan(1000);
  }, 60000);
});
