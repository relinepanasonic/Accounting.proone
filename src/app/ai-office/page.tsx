import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { getOfficeAccess } from '@/lib/ai/office-auth';
import { OfficeView } from '@/components/ai-office/OfficeView';

export const dynamic = 'force-dynamic';

export default async function AIOfficePage() {
  const access = await getOfficeAccess();

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">AI Office</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Brief the boss. It plans the work, the floors below do it, and quality control checks it before you get the report.
        </p>
      </div>

      {access ? (
        <OfficeView />
      ) : (
        <div className="gold-glass-panel border-red-500/40 rounded-2xl p-10 text-center max-w-xl mx-auto">
          <ShieldAlert className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-xs text-zinc-300 font-mono">The AI Office is restricted to the Founder and Superadmins.</p>
        </div>
      )}
    </div>
  );
}
