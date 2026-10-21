import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';

export const dynamic = 'force-dynamic';

/** Admin > Fake Order. The content is not defined yet. */
export default function AdminFakeOrderPage() {
  return (
    <div className="p-4 lg:p-8 space-y-6">
      <DivisionTabs base="/productivity/admin" active="fake" />
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]"><ShieldAlert className="w-8 h-8" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Fake Order</h1>
          <p className="text-sm text-zinc-400 mt-1">This page is reserved. Tell Claude what it should show.</p>
        </div>
      </div>
    </div>
  );
}
