import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { WorkspaceDetailTabs } from '@/components/settings/WorkspaceDetailTabs';
import { RegisterWorkspaceCard } from '@/components/settings/RegisterWorkspaceCard';

export const dynamic = 'force-dynamic';

/** Company Settings: the identity of the active company, and a way to register one more company (workspace). */
export default async function CompanySettingsPage() {
  const supabase = await createClient();
  const wsContext = await getAuthenticatedWorkspaceContext(supabase);
  const activeId = wsContext.activeWorkspaceId;
  if (!activeId) return notFound();

  const { data: ws } = await supabase.from('workspaces').select('*').eq('id', activeId).single();
  const seedWs = wsContext.availableWorkspaces?.find((w) => w.id === activeId);
  if (!ws && !seedWs) return notFound();

  const workspaceName = ws?.name || seedWs?.name || 'Company';
  const isTaxRegistered = ws?.is_tax_registered !== undefined && ws?.is_tax_registered !== null ? Boolean(ws.is_tax_registered) : Number(ws?.tax_rate_percent || 0) > 0;
  const taxRatePercent = ws?.tax_rate_percent !== undefined ? Number(ws.tax_rate_percent) : (isTaxRegistered ? 11 : 0);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 lg:p-8">
      <WorkspaceDetailTabs
        targetWorkspaceId={activeId}
        workspaceName={workspaceName}
        isTaxRegistered={isTaxRegistered}
        taxRatePercent={taxRatePercent}
        logoUrl={ws?.logo_url || ws?.company_logo_url || ''}
        tagline={ws?.brand_tagline || ws?.tagline || ''}
        phone={ws?.contact_phone || ws?.phone || ''}
        email={ws?.official_email || ws?.email || ''}
        website={ws?.website_url || ws?.website || ''}
      />
      <RegisterWorkspaceCard />
    </div>
  );
}
