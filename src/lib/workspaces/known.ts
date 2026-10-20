// Workspaces the code has to recognise by id. Pure constants: safe for server and client.

/** PT Pintu Langit Inovasi Global: the legal entity that issues invoices (also for New Wave jobs). */
export const PT_WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';

/** New Wave Live Specialist. A PT invoice tagged with this id is a "New Wave job": it stays in PT Pintu, but is
 *  sent to New Wave's hour-quota system and its client is hidden from non-New Wave staff. */
export const NEW_WAVE_WORKSPACE_ID = 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3';

/** Dream of AI. */
export const DREAM_OF_AI_WORKSPACE_ID = 'f41d2a2b-1a5c-4111-ae69-0bdf494ced52';
/** Prof Toko Online. */
export const PROF_WORKSPACE_ID = 'f7262187-2a08-4454-b046-b4fd91f2f642';

/** Short codes for narrow columns: PLIG (PT Pintu Langit), ProOne (Prof Toko Online), NW (New Wave), DOA (Dream of AI). */
export function workspaceCode(id?: string | null, name?: string | null): string {
  if (id === PT_WORKSPACE_ID) return 'PLIG';
  if (id === PROF_WORKSPACE_ID) return 'ProOne';
  if (id === NEW_WAVE_WORKSPACE_ID) return 'NW';
  if (id === DREAM_OF_AI_WORKSPACE_ID) return 'DOA';
  const n = String(name || '').toLowerCase();
  if (n.includes('pintu langit')) return 'PLIG';
  if (n.includes('prof toko')) return 'ProOne';
  if (n.includes('new wave')) return 'NW';
  if (n.includes('dream of ai')) return 'DOA';
  return String(name || '-').split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 4) || '-';
}
