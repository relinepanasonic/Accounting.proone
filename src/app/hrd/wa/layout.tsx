import React from 'react';
import { MessageCircle } from 'lucide-react';
import { WaTabs } from '@/components/wa/WaClient';
import { waFounderAccess } from '@/lib/wa/queries';

/** HRD > WA Control: the header and the Dashboard | Admin | Advertiser | Sales tabs. Each page checks access itself. */
export default async function WaLayout({ children }: { children: React.ReactNode }) {
  const showFounder = !!(await waFounderAccess());
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-6 animate-in fade-in duration-300">
      <div className="space-y-4 border-b border-[#d4af37]/20 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-wider text-white"><MessageCircle className="h-5 w-5 text-[#d4af37]" /> WA Control</h1>
          <p className="mt-1 text-xs text-zinc-500">What the team says in WhatsApp groups: live feed, who answers, and what is waiting.</p>
        </div>
        <WaTabs showFounder={showFounder} />
      </div>
      {children}
    </div>
  );
}
