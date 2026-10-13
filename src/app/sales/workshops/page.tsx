import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { WorkshopManager, WorkshopsHeading } from '@/components/workshops/WorkshopManager';

export const dynamic = 'force-dynamic';

/** Sales > Workshops: the Kampus Online event schedule shown on the public site. A sales jobdesk: sales, superadmins and the founder manage it. */
export default async function WorkshopsPage() {
  const supabase = await createClient();
  const ctx = await getAuthenticatedWorkspaceContext(supabase);
  const allowed = ['founder', 'superadmin', 'sales'].includes(ctx.role);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <p className="text-sm text-zinc-300">Workshops are managed by sales, superadmins and the founder.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 lg:p-8 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <WorkshopsHeading />
        <p className="mt-1 text-sm text-zinc-400">Kampus Online workshop schedule. What you save here appears on profesoronline.id/kampus/ straight away. All times are WIB.</p>
      </div>
      <WorkshopManager />
    </div>
  );
}
