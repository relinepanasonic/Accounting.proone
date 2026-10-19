import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { CatalogTable } from '@/components/settings/CatalogTable';
import type { CatalogProduct } from '@/components/settings/CatalogManager';
import { FINANCE_ROLES } from '@/lib/auth/workspace-context';

export const dynamic = 'force-dynamic';

export default async function OptimizingCatalogPage() {
  const supabase = await createClient();
  const { activeWorkspaceId, role, availableWorkspaces } = await getAuthenticatedWorkspaceContext(supabase);
  let query = supabase.from('products').select('*');
  if (activeWorkspaceId === '11111111-1111-1111-1111-111111111111') {
    // PT Pintu has no catalog of its own: it sees the catalog of every workspace.
    query = query.in('workspace_id', availableWorkspaces.map((w) => w.id));
  } else {
    query = query.eq('workspace_id', activeWorkspaceId);
  }
  const { data: products } = await query.order('created_at', { ascending: false });

  const fallbackCatalog: CatalogProduct[] = [
    {
      id: 'prod-seed-1',
      name: 'TikTok Live Commerce Monthly Production Retainer',
      description: 'Dedicated studio setup, host curation, and daily live shopping stream management',
      unit_price: 85000000,
    },
    {
      id: 'prod-seed-2',
      name: 'Custom HD Video Creator Package (40 Ads)',
      description: '40 short-form video ads with custom creative scripting and editing',
      unit_price: 1621750,
    },
    {
      id: 'prod-seed-3',
      name: 'Full-Funnel Brand Consulting & Strategy',
      description: 'Comprehensive e-commerce strategy & conversion attribution modeling',
      unit_price: 120000000,
    },
  ];

  const productList = products && products.length > 0 ? products : fallbackCatalog;

  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8">
      <CatalogTable
        initialProducts={productList}
        canEdit={FINANCE_ROLES.includes(role)}
        workspaces={activeWorkspaceId === '11111111-1111-1111-1111-111111111111' ? availableWorkspaces.map((w) => ({ id: w.id, name: w.name })) : undefined}
        activeWorkspaceId={activeWorkspaceId}
      />
    </div>
  );
}
