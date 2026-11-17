import { chatRoute } from '@/lib/chat/http';
import * as deals from '@/lib/chat/deal-edit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/chat/deals/<id>: the lead's details for the edit form. */
export const GET = chatRoute(({ me, id }) => deals.getDealDetail(me.workspaceId, id));
/** PATCH /api/v1/chat/deals/<id> { name, store, pic, phone, address, notes, value, title }: edit the lead (the owner, or the finance roles and the BOD). */
export const PATCH = chatRoute(({ me, id, body }) => deals.editDeal(me.workspaceId, id, body, me), { needsBody: true });
/** DELETE /api/v1/chat/deals/<id>: delete the lead (never one with an invoice, a request or a project). */
export const DELETE = chatRoute(({ me, id }) => deals.deleteDeal(me.workspaceId, id, me));
