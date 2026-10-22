import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { FakeOrderBoard } from '@/components/productivity/FakeOrderTable';
import { loadFakeOrderBoard } from '@/lib/admin/fake-order-data';

export const dynamic = 'force-dynamic';

/** Admin > Fake Order > Finished: the projects that ended. A renewal starts over as a new project. */
export default async function AdminFakeOrderFinishedPage() {
  const data = await loadFakeOrderBoard('finished');
  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/admin" active="fake" />
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]"><ShieldAlert className="w-8 h-8" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Fake Order · Finished</h1>
          <p className="text-sm text-zinc-400 mt-1">The projects that are done, with their fake orders</p>
        </div>
      </div>
      <FakeOrderBoard mode="finished" {...data} />
    </div>
  );
}
