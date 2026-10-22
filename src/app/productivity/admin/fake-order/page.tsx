import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { DivisionTabs } from '@/components/productivity/DivisionTabs';
import { FakeOrderBoard } from '@/components/productivity/FakeOrderTable';
import { loadFakeOrderBoard } from '@/lib/admin/fake-order-data';

export const dynamic = 'force-dynamic';

/** Admin > Fake Order > Active: the running projects and their fake orders. */
export default async function AdminFakeOrderPage() {
  const data = await loadFakeOrderBoard('active');
  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <DivisionTabs base="/productivity/admin" active="fake" />
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#d4af37]/10 rounded-xl text-[#d4af37]"><ShieldAlert className="w-8 h-8" /></div>
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Fake Order</h1>
          <p className="text-sm text-zinc-400 mt-1">Friends Order and Paket Optimize Shopee New Store: start a project, add the fake orders with proof, finish it</p>
        </div>
      </div>
      <FakeOrderBoard mode="active" {...data} />
    </div>
  );
}
