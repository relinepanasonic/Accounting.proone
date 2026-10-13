import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { WorkshopManager, WorkshopsHeading } from '@/components/workshops/WorkshopManager';

export const dynamic = 'force-dynamic';

/** Workshops: the Kampus Online event schedule shown on the public site. Founder and superadmins only. */
export default async function WorkshopsPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  const allowed = ctx.role === 'founder' || ctx.role === 'superadmin';

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-300">Workshops are managed by the founder and superadmins.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 lg:px-6 animate-in fade-in duration-300">
      <div>
        <WorkshopsHeading />
        <p className="mt-1 text-sm text-zinc-400">Kampus Online workshop schedule. What you save here appears on profesoronline.id/kampus/ straight away. All times are WIB.</p>
      </div>
      <WorkshopManager />
    </div>
  );
}
