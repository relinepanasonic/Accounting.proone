import React, { Suspense } from 'react';
import { BookMarked } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { canEditBankBook } from '@/lib/auth/bank-book-editors';
import { BankBookTable, type BankBookLine, type BankBookAccount } from '@/components/bank-book/BankBookTable';

export const dynamic = 'force-dynamic';

async function BankBookCore() {
  const supabase = await createClient();
  const { activeWorkspaceId, userEmail } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: accounts } = await supabase
    .from('workspace_bank_accounts')
    .select('id, bank_name, account_number, account_name')
    .eq('workspace_id', activeWorkspaceId);

  // One request returns at most 1000 rows: page through. The new columns need the 20261014 migration; without it the base columns still show.
  const fetchAll = async (cols: string) => {
    const out: any[] = [];
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await supabase
        .from('bank_statement_lines')
        .select(cols)
        .eq('workspace_id', activeWorkspaceId)
        .order('date', { ascending: false })
        .range(from, from + 999);
      if (error) return { rows: out, error };
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return { rows: out, error: null };
  };
  let res = await fetchAll('id, bank_account_id, date, description, counterparty, details, rek_from, notes, amount, status, file_name');
  let migrationMissing = false;
  if (res.error) {
    migrationMissing = true;
    res = await fetchAll('id, bank_account_id, date, description, notes, amount, status');
  }

  const lines: BankBookLine[] = res.rows.map((r: any) => ({
    id: r.id,
    bankAccountId: r.bank_account_id,
    date: String(r.date).slice(0, 10),
    counterparty: r.counterparty || r.description || '',
    details: r.details || '',
    rekFrom: r.rek_from || '',
    notes: r.notes || '',
    amount: Number(r.amount || 0),
    status: r.status || 'unreconciled',
    fileName: r.file_name || '',
  }));
  const banks: BankBookAccount[] = (accounts || []).map((a: any) => ({ id: a.id, bankName: a.bank_name || 'Bank', accountNumber: a.account_number || '', accountName: a.account_name || '' }));

  return <BankBookTable lines={lines} banks={banks} migrationMissing={migrationMissing} canEdit={canEditBankBook(userEmail)} />;
}

export default function BankBookPage() {
  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]"><BookMarked className="w-7 h-7" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Buku Bank</h1>
          <p className="text-sm text-zinc-400 mt-1">Upload your bank statements here (PDF or CSV). Every line is kept, per bank account.</p>
        </div>
      </div>
      <Suspense fallback={<div className="gold-glass-panel rounded-2xl h-64 animate-pulse" />}>
        <BankBookCore />
      </Suspense>
    </div>
  );
}
