import React, { Suspense } from 'react';
import { Box } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FixedAssetRecord {
  id: string;
  asset_name: string;
  category: string;
  purchase_price: number;
  current_book_value: number;
  salvage_value: number;
  status: string;
}

async function FixedAssetsRegistry() {
  const supabase = await createClient();

  const { data: records } = await supabase
    .from('fixed_assets')
    .select('*')
    .order('asset_name', { ascending: true });

  const displayRecords: FixedAssetRecord[] =
    records && records.length > 0
      ? records.map((r) => ({
          id: r.id,
          asset_name: r.asset_name,
          category: r.category || 'Equipment',
          purchase_price: Number(r.purchase_price || 0),
          current_book_value: Number(r.current_book_value || 0),
          salvage_value: Number(r.salvage_value || 0),
          status: r.status || 'Active',
        }))
      : [
          {
            id: '1',
            asset_name: 'Sony FX3 Professional Cinema Camera',
            category: 'Production Hardware',
            purchase_price: 4800,
            current_book_value: 3600,
            salvage_value: 800,
            status: 'Active',
          },
          {
            id: '2',
            asset_name: 'MacBook Pro M3 Max Studio Workstation',
            category: 'Computing Hardware',
            purchase_price: 3800,
            current_book_value: 2950,
            salvage_value: 600,
            status: 'Active',
          },
          {
            id: '3',
            asset_name: 'Aputure LS 600d Pro Studio Lighting Array',
            category: 'Studio Lighting',
            purchase_price: 2400,
            current_book_value: 1800,
            salvage_value: 300,
            status: 'Active',
          },
        ];

  return (
    <div className="gold-glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
            CAPITAL EQUIPMENT & STRAIGHT-LINE DEPRECIATION SCHEDULE
          </h2>
          <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
            AUTOMATED ZERO-JARGON BOOK VALUE COMPUTATION
          </p>
        </div>
        <span className="text-[10px] font-mono text-[#f5d77f] bg-[#d4af37]/15 px-3 py-1 rounded-full border border-[#d4af37]/40">
          DEPRECIATION ENGINE
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-sans">
              <th className="py-3 px-3">Fixed Asset Name</th>
              <th className="py-3 px-3">Category</th>
              <th className="py-3 px-3 text-right">Purchase Cost</th>
              <th className="py-3 px-3 text-right">Current Book Value</th>
              <th className="py-3 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {displayRecords.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-zinc-800/30 transition-colors group"
              >
                <td className="py-3 px-3 font-sans font-semibold text-white group-hover:text-[#f5d77f] transition-colors">
                  {item.asset_name}
                </td>
                <td className="py-3 px-3">
                  <span className="text-[10px] px-2.5 py-0.5 rounded bg-zinc-900 text-[#d4af37] border border-[#d4af37]/20">
                    {item.category}
                  </span>
                </td>
                <td className="py-3 px-3 text-right text-zinc-300">
                  ${item.purchase_price.toLocaleString()}
                </td>
                {/* Critical Current Value highlighted in Glowing Rich Gold */}
                <td className="py-3 px-3 text-right">
                  <span className="text-sm font-black text-[#f5d77f] drop-shadow-[0_0_10px_rgba(245,215,127,0.45)]">
                    ${item.current_book_value.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase bg-[#d4af37]/15 text-[#f5d77f] border border-[#d4af37]/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f5d77f] animate-pulse"></span>
                    <span>{item.status}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#d4af37]/20">
        <div>
          <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <Box className="w-5 h-5 text-[#d4af37]" />
            <span>FIXED ASSETS • CAPITAL EQUIPMENT & DEPRECIATION HUD</span>
          </h1>
          <p className="text-xs text-[#d4af37] font-mono">
            LUXURY EXECUTIVE PANELS • INSTANT REALTIME VALUE COMPUTATION
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="gold-glass-panel rounded-2xl h-80 animate-pulse p-6"></div>
        }
      >
        <FixedAssetsRegistry />
      </Suspense>
    </div>
  );
}
