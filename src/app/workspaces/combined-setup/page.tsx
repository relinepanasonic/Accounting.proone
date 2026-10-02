import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { SelectorClient } from './SelectorClient';

export const dynamic = 'force-dynamic';

export default async function CombinedSetupPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);

  if (!ctx.userId) redirect('/login');

  const eligible = ctx.availableWorkspaces.filter(w => 
    ['founder', 'superadmin', 'accounting', 'admin'].includes(w.role)
  );
  
  if (eligible.length < 2) {
    redirect('/workspaces'); // Need at least 2 high-level workspaces to combine
  }

  // Fetch logos
  const { data: rows } = await supabase
    .from('workspaces')
    .select('id, logo_url')
    .in('id', eligible.map((w) => w.id));
    
  const logoMap = new Map((rows || []).map(r => [r.id, r.logo_url]));

  const workspacesWithLogos = eligible.map(w => ({
    id: w.id,
    name: w.name,
    role: w.role,
    logo_url: logoMap.get(w.id) || undefined
  }));

  const firstName = (ctx.userName || '').split(/[\s.@]/)[0];

  return <SelectorClient workspaces={workspacesWithLogos} firstName={firstName} />;
}
