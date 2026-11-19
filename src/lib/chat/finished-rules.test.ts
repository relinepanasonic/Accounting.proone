import { describe, it, expect } from 'vitest';
import { phaseOf, stageForPhase } from './finished-rules';

describe('the phase of a client, from the ERP Clients lifecycles', () => {
  it('any running, scheduled or frozen line makes it active', () => {
    expect(phaseOf(['finished', 'active'])).toBe('active');
    expect(phaseOf(['scheduled'])).toBe('active');
    expect(phaseOf(['freeze', 'finished'])).toBe('active');
  });
  it('only finished lines: finished', () => expect(phaseOf(['finished', 'finished'])).toBe('finished'));
  it('only churn, or nothing: left alone', () => { expect(phaseOf(['churn'])).toBeNull(); expect(phaseOf([])).toBeNull(); });
  it('churn does not hide a finished line', () => expect(phaseOf(['churn', 'finished'])).toBe('finished'));
});

describe('the stage that follows', () => {
  it('an Active Client whose project ended is Finished', () => expect(stageForPhase('Deal', 'finished')).toBe('Finished'));
  it('a Finished client with a new running project is an Active Client again', () => expect(stageForPhase('Finished', 'active')).toBe('Deal'));
  it('nothing else moves', () => {
    for (const [s, p] of [['Deal', 'active'], ['Deal', null], ['Finished', 'finished'], ['Finished', null], ['Invoice', 'finished'], ['Cold Case', 'finished'], ['Lost', 'active'], ['Warm', 'finished']] as const) expect(stageForPhase(s, p)).toBeNull();
  });
});
