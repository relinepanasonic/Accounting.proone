import React from 'react';
import { getPipelineDeals } from '@/app/actions/sales';
import { PipelineKanban } from '@/components/sales/PipelineKanban';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export default async function SalesPipelinePage({
  searchParams
}: {
  searchParams: { month?: string }
}) {
  const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const month = searchParams.month || currentMonth;

  // Pass month to fetch deals for that month
  const deals = await getPipelineDeals(month);
  
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('workspace_id', activeWorkspaceId)
    .order('name');

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
      <PipelineKanban initialDeals={deals} clients={clients || []} currentMonth={month} />
    </div>
  );
}
