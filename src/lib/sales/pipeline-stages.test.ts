import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/api/supabase-admin', () => ({ createAdminClient: () => ({}) }));
import { FOLLOWUP_DAYS, isForward, LOCKED_STAGES, MANUAL_STAGES, PIPELINE_STAGES, STAGE_HINT, stageLabel } from './flow';
import { mayAutoMove } from '@/lib/chat/pipeline';
import { checkStage, mayMoveDeal } from '@/lib/chat/crm-link';

describe('the pipeline: new lead to meeting to active client', () => {
  it('fifteen stages in order, each with a hint; the old stored names read with their new labels', () => {
    expect([...PIPELINE_STAGES]).toEqual(['Lead', 'Contacted', 'Qualified', 'Warm', 'Meeting Offered', 'Meeting Booked', 'Meeting Offline', 'Meeting Done', 'Negotiation', 'Invoice Requested', 'Invoice', 'Deal', 'Finished', 'Cold Case', 'Lost']);
    for (const s of PIPELINE_STAGES) expect(STAGE_HINT[s]).toBeTruthy();
    expect(['Lead', 'Invoice', 'Deal', 'Cold Case', 'Warm'].map(stageLabel)).toEqual(['New Lead', 'Invoice Sent', 'Active Client', 'Cold Leads', 'Warm']);
  });
  it('every stage is either picked by hand or set by the invoice flow, never both', () => {
    for (const s of PIPELINE_STAGES) expect(MANUAL_STAGES.includes(s) !== LOCKED_STAGES.includes(s)).toBe(true);
    expect(LOCKED_STAGES).toEqual(['Invoice Requested', 'Invoice', 'Deal', 'Finished']);
  });
  it('no follow-up task while a meeting is booked or the deal is with Accounting', () => {
    for (const s of ['Meeting Booked', 'Invoice Requested', 'Invoice', 'Deal', 'Cold Case']) expect(FOLLOWUP_DAYS[s]).toBeUndefined();
    expect(FOLLOWUP_DAYS.Warm).toBe(2);
  });
});

describe('automatic moves (bot, booking, meeting)', () => {
  it('only forward', () => {
    expect(isForward('Lead', 'Meeting Booked')).toBe(true);
    expect(mayAutoMove('Warm', 'Meeting Booked')).toBe(true);
    expect(mayAutoMove('Negotiation', 'Meeting Done')).toBe(false);
    expect(mayAutoMove('Meeting Booked', 'Meeting Booked')).toBe(false);
  });
  it('never touch a deal that is with Accounting, and never put one there', () => {
    expect(mayAutoMove('Invoice Requested', 'Cold Case')).toBe(false);
    expect(mayAutoMove('Invoice', 'Deal')).toBe(false);
    expect(mayAutoMove('Negotiation', 'Invoice Requested')).toBe(false);
  });
  it('an unknown stage name moves nothing', () => {
    expect(mayAutoMove('Won', 'Meeting Done')).toBe(false);
  });
});

describe('a person moving a deal from the chat dashboard', () => {
  it('may pick the hand stages; the invoice stages explain how they are reached', () => {
    expect(checkStage('Meeting Booked')).toEqual({ ok: true, stage: 'Meeting Booked' });
    expect(checkStage('Cold Case')).toEqual({ ok: true, stage: 'Cold Case' });
    expect(checkStage('Invoice Requested')).toMatchObject({ ok: false });
    expect(checkStage('Deal')).toMatchObject({ ok: false });
    expect(checkStage('Won')).toMatchObject({ ok: false, error: 'Unknown stage.' });
  });
  it('a deal with a requested invoice cannot be moved until the request is cancelled', () => {
    expect(mayMoveDeal('founder', 'u1', { salesman_id: 'u1', stage: 'Invoice Requested' })).toMatchObject({ ok: false });
    expect(mayMoveDeal('sales', 'u1', { salesman_id: 'u1', stage: 'Warm' })).toEqual({ ok: true });
    expect(mayMoveDeal('sales', 'u1', { salesman_id: 'u2', stage: 'Warm' })).toMatchObject({ ok: false });
  });
});
