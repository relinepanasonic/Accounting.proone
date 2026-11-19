/**
 * Finished: a client whose project ran out in the ERP but who is still a client (not Churn, which only a person sets, and not a Cold Case). The pipeline stage
 * follows the ERP's Clients page: its lifecycle (Active, Scheduled, Freeze, Finished, Churn) decides it. Pure, so the rule is tested.
 */
export type Phase = 'active' | 'finished' | null;

/**
 * One client's phase from the lifecycles of all its lines in the ERP Clients table: any line still running, scheduled or frozen makes the client Active; if
 * none is but one is Finished, the client is Finished; a client with only Churn lines is left alone (null).
 */
export function phaseOf(lifecycles: string[]): Phase {
  if (lifecycles.some((l) => l === 'active' || l === 'scheduled' || l === 'freeze')) return 'active';
  if (lifecycles.includes('finished')) return 'finished';
  return null;
}

/** The stage a deal should be in, or null to leave it. Only an Active Client and a Finished client are touched. */
export function stageForPhase(stage: string, phase: Phase): 'Deal' | 'Finished' | null {
  if (stage === 'Deal' && phase === 'finished') return 'Finished';
  if (stage === 'Finished' && phase === 'active') return 'Deal';
  return null;
}
