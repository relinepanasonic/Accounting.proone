import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Box } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { NewAssetForm } from '@/components/assets/NewAssetForm';

export const dynamic = 'force-dynamic';

/** Assets > Add asset: an asset bought before, or outside the Expenses flow. */
export default async function NewAssetPage() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  // The asset accounts of this company (12xx), except the accumulated depreciation account.
  const { data } = await supabase.from('global_chart_of_accounts').select('account_code, account_name').eq('workspace_id', activeWorkspaceId).eq('is_active', true).like('account_code', '12%').order('account_code');
  const categories = (data || [])
    .filter((a: any) => !/accumulated|akumulasi/i.test(String(a.account_name)))
    .map((a: any) => ({ code: String(a.account_code), name: String(a.account_name) }));
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-[800px] space-y-6 px-6 py-8">
      <div className="flex items-center gap-3 border-b border-[#d4af37]/20 pb-4">
        <Link href="/assets" className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:border-[#d4af37]/40 hover:text-white"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wider text-white"><Box className="h-5 w-5 text-[#d4af37]" /><span>Add Asset</span></h1>
          <p className="font-mono text-xs uppercase tracking-wider text-[#d4af37]">Cost, months and the monthly Schedule Expense</p>
        </div>
      </div>
      {categories.length === 0
        ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">This company has no asset account (12xx) in its chart of accounts yet. Add one in COA Mapping first.</div>
        : <NewAssetForm categories={categories} today={today} />}
    </div>
  );
}
