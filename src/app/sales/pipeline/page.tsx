import React from 'react';
import { getPipelineDeals } from '@/app/actions/sales';
import { PipelineKanban } from '@/components/sales/PipelineKanban';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export default async function SalesPipelinePage() {
  const deals = await getPipelineDeals();
  
  // We need to fetch clients for the New Deal modal
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('workspace_id', activeWorkspaceId)
    .order('name');

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300 h-full">
      <PipelineKanban initialDeals={deals} clients={clients || []} />
    </div>
  );
}
