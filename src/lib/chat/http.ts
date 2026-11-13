import { NextResponse } from 'next/server';
import { chatUser, type ChatUser } from './auth';

const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ChatCall { me: ChatUser; request: Request; id: string; body: any }
type Handler = (c: ChatCall) => Promise<NextResponse | { ok: false; status: number; error: string } | Record<string, unknown>>;

/**
 * The same checks for every chat API route: a signed-in person with a chat role (401 otherwise), a well-formed chat id when the route has one,
 * and a JSON body when there is one. A handler returns data (sent as JSON) or { ok: false, status, error } (sent as that error).
 */
export function chatRoute(handler: Handler, opts: { needsBody?: boolean; roles?: readonly string[] } = {}) {
  return async (request: Request, ctx?: { params: Promise<{ id?: string }> }) => {
    const me = await chatUser(request);
    if (!me) return new NextResponse(null, { status: 401, headers: NO_STORE });
    if (opts.roles && !opts.roles.includes(me.role)) return NextResponse.json({ error: 'Only admins can change this.' }, { status: 403, headers: NO_STORE });
    // For a route without a dynamic part (/agents, /conversations) Next gives params that resolve to nothing: never read .id of undefined.
    const id = ctx ? ((await ctx.params) as { id?: string } | undefined)?.id ?? '' : '';
    if (ctx && id && !UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: NO_STORE });
    let body: any = null;
    if (opts.needsBody) {
      try { body = await request.json(); } catch { return NextResponse.json({ error: 'The body must be JSON.' }, { status: 400, headers: NO_STORE }); }
    }
    try {
      const r = await handler({ me, request, id, body });
      if (r instanceof NextResponse) return r;
      if ((r as any).ok === false) return NextResponse.json({ error: (r as any).error }, { status: (r as any).status, headers: NO_STORE });
      return NextResponse.json(r, { headers: NO_STORE });
    } catch (e: any) {
      console.error('chat api failed', request.method, new URL(request.url).pathname, e);
      return NextResponse.json({ error: 'Something went wrong.' }, { status: 500, headers: NO_STORE });
    }
  };
}
