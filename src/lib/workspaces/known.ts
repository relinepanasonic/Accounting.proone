// Workspaces the code has to recognise by id. Pure constants: safe for server and client.

/** PT Pintu Langit Inovasi Global: the legal entity that issues invoices (also for New Wave jobs). */
export const PT_WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';

/** New Wave Live Specialist. A PT invoice tagged with this id is a "New Wave job": it stays in PT Pintu, but is
 *  sent to New Wave's hour-quota system and its client is hidden from non-New Wave staff. */
export const NEW_WAVE_WORKSPACE_ID = 'b9f6425f-ad1f-4911-a182-ab788c5fa0e3';
