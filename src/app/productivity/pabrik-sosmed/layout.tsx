import React from 'react';
import { PabrikSosmedTabs } from '@/components/productivity/PabrikSosmedTabs';

export default function PabrikSosmedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="shrink-0 mb-4">
        <PabrikSosmedTabs />
      </div>
      
      <div className="flex-1 w-full overflow-hidden relative rounded-xl border border-zinc-800/60 bg-[#0a0a0a]">
        {children}
      </div>
    </div>
  );
}
