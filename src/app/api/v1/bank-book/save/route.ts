import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { storeStatement, type BankBookLineInput } from '@/lib/bank-book/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Stores a parsed bank statement in Buku Bank. Same job as the saveBankStatement action, but a plain
 * request: it keeps working when a page was opened before an update (no action id to go stale) and it
 * always answers with the real message.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { bankAccountId?: string; fileName?: string; lines?: BankBookLineInput[] };
    const bankAccountId = String(body.bankAccountId || '');
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (!bankAccountId || lines.length === 0) return NextResponse.json({ success: true, saved: 0, skipped: 0 });

    const supabase = await createClient();
    const ctx = await getAuthenticatedWorkspaceContext(supabase);
    if (!FINANCE_ROLES.includes(ctx.role)) return NextResponse.json({ success: false, error: 'Not allowed.' }, { status: 403 });

    const { data: bank } = await supabase.from('workspace_bank_accounts').select('id').eq('id', bankAccountId).eq('workspace_id', ctx.activeWorkspaceId).maybeSingle();
    if (!bank) return NextResponse.json({ success: false, error: 'That bank account does not belong to this company.' });

    const res = await storeStatement(supabase, { workspaceId: ctx.activeWorkspaceId, bankAccountId, fileName: String(body.fileName || 'statement'), lines });
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Could not save the statement.' });
  }
}
