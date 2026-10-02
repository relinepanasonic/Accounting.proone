import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, ScanSearch } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { clientMask } from '@/lib/auth/client-privacy';
import { loadLedgerCheck } from '@/lib/accounting/ledger-check';
import { LedgerCheckTable } from '@/components/ledger/LedgerCheckTable';

export const dynamic = 'force-dynamic';

export default async function LedgerCheckPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!FINANCE_ROLES.includes(ctx.role)) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-300">Ledger Check is for finance roles only.</p>
      </div>
    );
  }

  const mask = clientMask({ userEmail: ctx.userEmail, availableWorkspaces: ctx.availableWorkspaces });
  const data = await loadLedgerCheck(supabase, ctx.activeWorkspaceId, (name, assigned) => mask.name(name, assigned));

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#d4af37]/20 pb-4">
        <div>
          <Link href="/ledger" className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 hover:text-[#f5d77f]">
            <ArrowLeft className="h-3.5 w-3.5" /> Activity Ledger
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wider text-white">
            <ScanSearch className="h-5 w-5 text-[#d4af37]" /> Ledger Check · {ctx.activeWorkspaceName}
          </h1>
          <p className="mt-1 max-w-3xl text-xs text-zinc-400">
            Every invoice next to what the ledger really holds. Open a row to see each ledger line and compare it with the bank statement,
            then mark it <b className="text-emerald-300">Checked OK</b> or <b className="text-red-300">Problem</b> with a note. Nothing on this page changes the books.
          </p>
        </div>
      </div>

      <LedgerCheckTable data={data} />
    </div>
  );
}
