import React from 'react';
import { PabrikSosmedTabs } from '@/components/productivity/PabrikSosmedTabs';

export default function PabrikSosmedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-white flex items-center gap-2">
            PABRIK SOSMED
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage your social media content and uploads.
          </p>
        </div>
      </div>

      <PabrikSosmedTabs />
      
      <div className="pt-2">
        {children}
      </div>
    </div>
  );
}
