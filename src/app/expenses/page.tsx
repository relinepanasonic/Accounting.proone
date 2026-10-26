import React, { Suspense } from 'react';
import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext, FINANCE_ROLES } from '@/lib/auth/workspace-context';
import { createAdminClient } from '@/lib/api/supabase-admin';
import { PT_WORKSPACE_ID } from '@/lib/workspaces/known';
import { assignableWorkspaces } from '@/lib/workspaces/assignable';
import { ExpenseClientTable, ExpenseRecord } from '@/components/expenses/ExpenseClientTable';

export const dynamic = 'force-dynamic';

async function ExpensesTable() {
  const supabase = await createClient();
  const { activeWorkspaceId, availableWorkspaces, role } = await getAuthenticatedWorkspaceContext(supabase);
  const isPT = activeWorkspaceId === PT_WORKSPACE_ID;

  // assigned_workspace_id needs one migration; without it the list still works.
  const ownQuery = (cols: string) =>
    supabase
      .from('transactions')
      .select(cols)
      .eq('workspace_id', activeWorkspaceId)
      .eq('type', 'expense')
      // Exclude Fixed Asset purchases: any category whose COA code starts with '1' (Asset range: 10xx, 12xx, 15xx etc.)
      // Real operating expenses use codes starting with '5' (COGS) or '6' (Opex)
      .not('category', 'ilike', '1%')
      .order('transaction_date', { ascending: false });
  const base = 'id, due_date, transaction_date, description, category, amount, reconciled, bank_reference';
  let { data: records, error } = (await ownQuery(`${base}, assigned_workspace_id`)) as any;
  if (error) ({ data: records, error } = (await ownQuery(base)) as any);
  if (error) {
    console.error('Error fetching expenses:', error);
  }

  // Another workspace: the PT Pintu expenses that were assigned to this one, shown read-only.
  let fromPt: any[] = [];
  if (!isPT && FINANCE_ROLES.includes(role)) {
    const { data: assigned } = await createAdminClient()
      .from('transactions')
      .select(base)
      .eq('workspace_id', PT_WORKSPACE_ID)
      .eq('assigned_workspace_id', activeWorkspaceId)
      .eq('type', 'expense')
      .not('category', 'ilike', '1%')
      .order('transaction_date', { ascending: false });
    fromPt = assigned || [];
  }

  const toRecord = (r: any, readOnly: boolean): ExpenseRecord => {
  const rawDesc = r.description || 'Vendor Payee';
  let vendorPart = rawDesc;
  let notesPart = '-';
  if (rawDesc.includes(' | ')) {
     const parts = rawDesc.split(' | ');
     vendorPart = parts[0];
     notesPart = parts.slice(1).join(' | ');
  } else if (rawDesc.includes(' - ')) {
     const parts = rawDesc.split(' - ');
     vendorPart = parts[0];
     notesPart = parts.slice(1).join(' - ');
  }
  return {
    id: r.id,
    date: r.due_date || r.transaction_date,
    vendor: vendorPart,
    notes: notesPart,
    category: r.category || '6000 - Operating Expenses',
    amount: Number(r.amount || 0),
    status: r.reconciled ? 'paid' : 'pending',
    // Green light: reconciled with a bank line in Bank Reconcile. Paid by PT: that reconcile lives in PT only, so no light here.
    bankMatched: !readOnly && Boolean(r.reconciled && String(r.bank_reference || '').startsWith('BANK-REF:')),
    assignedWorkspaceId: readOnly ? null : r.assigned_workspace_id ?? null,
    readOnly,
  };
  };

  // The Schedule Expense of the assets: every monthly payment (posted or still to come) as a read-only line, so it sits next to the other expenses.
  // It is already in the ledger when posted; this is only the list. Without the schedule table the list simply has none.
  let scheduled: ExpenseRecord[] = [];
  {
    const { data: lines, error: schErr } = await supabase.from('asset_schedule').select('id, asset_id, seq, due_date, amount, posted_at').eq('workspace_id', activeWorkspaceId).order('due_date').limit(5000);
    if (!schErr && lines?.length) {
      const { data: assetRows } = await supabase.from('fixed_assets').select('id, asset_name, useful_life_years').eq('workspace_id', activeWorkspaceId);
      const info = new Map((assetRows || []).map((a: any) => [a.id, a]));
      scheduled = lines.map((l: any) => {
        const a: any = info.get(l.asset_id);
        const total = Math.max(1, Math.round(Number(a?.useful_life_years || 1) * 12));
        return {
          id: `schedule-${l.id}`,
          date: String(l.due_date).slice(0, 10),
          vendor: a?.asset_name || 'Asset',
          notes: `Asset schedule ${l.seq}/${total}`,
          category: '6100 - Depreciation Expense',
          amount: Number(l.amount || 0),
          status: l.posted_at ? 'paid' : 'pending',
          readOnly: true,
          schedule: l.posted_at ? 'posted' : 'upcoming',
        } as ExpenseRecord;
      });
    }
  }

  const displayRecords: ExpenseRecord[] = [
    ...scheduled,
    ...fromPt.map((r) => toRecord(r, true)),
    ...((records as any[]) || []).map((r) => toRecord(r, false)),
  ].sort((x, y) => String(y.date).localeCompare(String(x.date)));

  return (
    <div className="gold-glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
            Expenses List
          </h2>
          
        </div>
        
      </div>

      <ExpenseClientTable initialRecords={displayRecords} workspaces={isPT ? (await assignableWorkspaces({ role, availableWorkspaces })).filter((w) => w.id !== PT_WORKSPACE_ID) : undefined} fromPtLabel="PT Pintu" />
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#d4af37]/20">
        <div>
          <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#d4af37]" />
            <span>Expenses</span>
          </h1>
          
        </div>

        <Link
          href="/expenses/new"
          className="gold-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs uppercase tracking-wider"
        >
          <Plus className="w-4 h-4" />
          <span>RECORD NEW EXPENSE</span>
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="gold-glass-panel rounded-2xl h-80 animate-pulse p-6"></div>
        }
      >
        <ExpensesTable />
      </Suspense>
    </div>
  );
}



