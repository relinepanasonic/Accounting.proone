// Client identities of a protected workspace are hidden from people who have no business seeing them.
// Today that is New Wave Live Specialist: its invoices are issued by PT Pintu Langit / Prof Toko, so other
// superadmins and staff of those workspaces would otherwise read New Wave's client names.
//
// Who still sees them: the founder, members of the protected workspace, and the people in ALLOWED_VIEWER_EMAILS.
// Everyone else keeps the invoice number, amount and status (so the books still work) but the client shows
// as "Hidden client". This hides it in the app screens; it is not a database lock.
//
// Pure module (no next/headers) so any page can import it.
import { isFounderEmail } from '@/lib/auth/founders';

/** New Wave Live Specialist. */
const PROTECTED_WORKSPACE_IDS = ['b9f6425f-ad1f-4911-a182-ab788c5fa0e3'];

/** Besides the founder and the workspace's own members. */
const ALLOWED_VIEWER_EMAILS = ['lucyana.suryaputra@gmail.com'];

export const HIDDEN_CLIENT = 'Hidden client';

export interface ClientMask {
  /** True when this viewer is subject to hiding (not the founder, not on the allowed list). */
  active: boolean;
  /** Should the client of an invoice assigned to this workspace be hidden from this viewer? */
  hides: (assignedWorkspaceId?: string | null) => boolean;
  /** The name to show: the real one, or "Hidden client". */
  name: (realName: string | null | undefined, assignedWorkspaceId?: string | null, fallback?: string) => string;
}

export function clientMask(ctx: { userEmail?: string | null; availableWorkspaces: { id: string }[] }): ClientMask {
  const email = (ctx.userEmail || '').trim().toLowerCase();
  const exempt = isFounderEmail(email) || ALLOWED_VIEWER_EMAILS.includes(email);
  const memberOf = new Set(ctx.availableWorkspaces.map((w) => w.id));
  const hides = (assignedWorkspaceId?: string | null) =>
    !exempt && !!assignedWorkspaceId && PROTECTED_WORKSPACE_IDS.includes(assignedWorkspaceId) && !memberOf.has(assignedWorkspaceId);
  return {
    active: !exempt,
    hides,
    name: (realName, assignedWorkspaceId, fallback = 'Client') => (hides(assignedWorkspaceId) ? HIDDEN_CLIENT : realName || fallback),
  };
}
