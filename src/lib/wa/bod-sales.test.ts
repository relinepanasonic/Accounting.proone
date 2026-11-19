import { describe, it, expect } from 'vitest';
import { buildSalesBod, conversionsOf, movementOf, overdueOf, reachedCounts, showRateOf, stuckOf, unconfirmedTomorrow, type SalesDeal, type SalesMeeting } from './bod-sales';

const DAY = '2026-11-16';                       // a Monday
const at = (day: string, hhmm = '03:00') => `${day}T${hhmm}:00Z`;   // 10:00 WIB
const deal = (o: Partial<SalesDeal>): SalesDeal => ({ id: Math.random().toString(36).slice(2), stage: 'Lead', value: 0, salesman_name: 'Rani', created_at: at('2026-11-01'), stage_changed_at: at('2026-11-01'), ...o });
const meet = (o: Partial<SalesMeeting>): SalesMeeting => ({ status: 'booked', created_at: at('2026-11-10'), starts_at: at('2026-11-20'), owner_name: 'Rani', lead_name: 'Budi', ...o });

describe('what moved today', () => {
  const deals = [
    deal({ created_at: at(DAY) }), deal({ created_at: at(DAY), salesman_name: 'Lucy' }),
    deal({ proposal_sent_at: at(DAY) }), deal({ invoice_requested_at: at(DAY) }), deal({ invoice_generated_at: at(DAY) }),
    deal({ stage: 'Deal', paid_at: at(DAY), salesman_name: 'Lucy' }), deal({ stage: 'Deal', acc_approved_at: at(DAY) }),
    deal({ created_at: at('2026-11-15') }),                       // yesterday: not counted
  ];
  const meetings = [meet({ created_at: at(DAY) }), meet({ status: 'done', starts_at: at(DAY) }), meet({ status: 'no_show', starts_at: at(DAY), owner_name: 'Lucy' }), meet({ status: 'done', starts_at: at('2026-11-14') })];
  const m = movementOf(deals, meetings, DAY);
  it('counts each step on the day (Jakarta time)', () => {
    expect(m.total).toEqual({ newLeads: 2, meetingsBooked: 1, meetingsHeld: 1, noShow: 1, proposalsSent: 1, invoicesRequested: 1, invoicesSent: 1, newActive: 2 });
  });
  it('and per salesperson, the busiest first', () => {
    const lucy = m.bySales.find((x) => x.name === 'Lucy')!;
    expect(lucy).toMatchObject({ newLeads: 1, newActive: 1, noShow: 1 });
    expect(m.bySales[0].name).toBe('Rani');
  });
  it('a time just after midnight in Jakarta belongs to the next day', () => {
    expect(movementOf([deal({ created_at: '2026-11-15T17:30:00Z' })], [], DAY).total.newLeads).toBe(1);   // 00:30 WIB on the 16th
    expect(movementOf([deal({ created_at: '2026-11-16T17:30:00Z' })], [], DAY).total.newLeads).toBe(0);   // 00:30 WIB on the 17th
  });
});

describe('the funnel and its conversion', () => {
  const deals = [
    deal({ stage: 'Lead' }), deal({ stage: 'Warm' }), deal({ stage: 'Meeting Booked' }), deal({ stage: 'Meeting Done' }), deal({ stage: 'Negotiation' }),
    deal({ stage: 'Invoice' }), deal({ stage: 'Deal' }), deal({ stage: 'Cold Case' }),
  ];
  it('a deal in a later stage counts for the earlier ones; Lost is left out', () => {
    const r = reachedCounts(deals);
    expect(r.get('Lead')).toBe(7);
    expect(r.get('Meeting Booked')).toBe(5);
    expect(r.get('Deal')).toBe(1);
  });
  it('lead to meeting to held to negotiation to invoice to paid', () => {
    const c = conversionsOf(deals);
    expect(c[0]).toMatchObject({ from: 'Lead', to: 'Meeting Booked', fromCount: 7, toCount: 5 });
    expect(c[1]).toMatchObject({ from: 'Meeting Booked', to: 'Meeting Done', fromCount: 5, toCount: 4 });
    expect(c[4]).toMatchObject({ from: 'Invoice', to: 'Deal', fromCount: 2, toCount: 1, pct: 0.5 });
  });
  it('no deals gives no percentage', () => {
    expect(conversionsOf([])[0].pct).toBeNull();
  });
});

describe('what needs attention', () => {
  it('deals stuck too long in a stage, the longest first', () => {
    const s = stuckOf([deal({ stage: 'Negotiation', stage_changed_at: at('2026-11-05'), client: 'Toko A' }), deal({ stage: 'Warm', stage_changed_at: at('2026-11-14') }), deal({ stage: 'Warm', stage_changed_at: at('2026-11-08'), client: 'Toko B' }), deal({ stage: 'Meeting Booked', stage_changed_at: at('2026-10-01') })], DAY);
    expect(s.map((x) => [x.client, x.days])).toEqual([['Toko A', 11], ['Toko B', 8]]);    // 2 days in Warm is fine; a booked meeting is never "stuck"
  });
  it('tomorrow\'s meetings that nobody confirmed', () => {
    const u = unconfirmedTomorrow([meet({ starts_at: at('2026-11-17') }), meet({ starts_at: at('2026-11-17'), confirmed_at: at(DAY) }), meet({ starts_at: at('2026-11-18') }), meet({ status: 'cancelled', starts_at: at('2026-11-17') })], DAY);
    expect(u).toHaveLength(1);
  });
  it('invoices unpaid after the due date, the biggest first', () => {
    const o = overdueOf([{ total: 3000000, paid: 0, due: '2026-11-10', client: 'A' }, { total: 5000000, paid: 1000000, due: '2026-11-01', client: 'B' }, { total: 2000000, paid: 2000000, due: '2026-10-01', client: 'C' }, { total: 9000000, paid: 0, due: '2026-11-20', client: 'D' }], DAY);
    expect(o.map((x) => [x.client, x.balance, x.daysLate])).toEqual([['B', 4000000, 15], ['A', 3000000, 6]]);
  });
});

describe('show rate and the whole page', () => {
  it('of the meetings that came due in 30 days, the share held', () => {
    expect(showRateOf([meet({ status: 'done', starts_at: at('2026-11-10') }), meet({ status: 'done', starts_at: at('2026-11-11') }), meet({ status: 'no_show', starts_at: at('2026-11-12') }), meet({ status: 'done', starts_at: at('2026-09-01') })], DAY)).toBeCloseTo(2 / 3);
    expect(showRateOf([], DAY)).toBeNull();
  });
  it('builds everything from empty input without errors', () => {
    const b = buildSalesBod({ deals: [], meetings: [], invoices: [], paymentsToday: { count: 0, amount: 0 } }, DAY);
    expect(b.movement.newLeads).toBe(0);
    expect(b.funnel).toHaveLength(14);
    expect(b.stuck).toEqual([]);
  });
});
