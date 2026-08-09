import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { CatalogManager, type CatalogProduct } from '@/components/settings/CatalogManager';

export const dynamic = 'force-dynamic';

export default async function CatalogSettingsPage() {
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);
  let query = supabase.from('products').select('*');
  if (activeWorkspaceId === '11111111-1111-1111-1111-111111111111') {
    query = query.in('workspace_id', [
      '11111111-1111-1111-1111-111111111111', // PT Pintu Langit
      'f7262187-2a08-4454-b046-b4fd91f2f642', // Prof Toko Online
      'b9f6425f-ad1f-4911-a182-ab788c5fa0e3', // New Wave
    ]);
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

  return <CatalogManager initialProducts={productList} />;
}
