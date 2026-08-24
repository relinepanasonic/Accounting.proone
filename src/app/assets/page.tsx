import React, { Suspense } from 'react';
import { Box, Edit2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { RunDepreciationButton } from '@/components/assets/RunDepreciationButton';

import { AssetRowActions } from '@/components/assets/AssetRowActions';
import { AssetRowWithHistory } from '@/components/assets/AssetRowWithHistory';

export const dynamic = 'force-dynamic';

interface FixedAssetRecord {
  id: string;
  asset_name: string;
  category: string;
  purchase_price: number;
  purchase_date?: string;
  useful_life_months: number;
  current_book_value: number;
  salvage_value: number;
  status: string;
}

async function FixedAssetsRegistry() {
  const supabase = await createClient();

  const { data: records } = await supabase
    .from('fixed_assets')
    .select('id, asset_name, category, initial_value, salvage_value, purchase_date, annual_depreciation, status, useful_life_years')
    .order('asset_name', { ascending: true });

  const displayRecords: FixedAssetRecord[] =
    records && records.length > 0
      ? records.map((r) => {
          const initialValue = Number(r.initial_value || 0);
          const annualDepr = Number(r.annual_depreciation || 0);
          
          let currentBookValue = initialValue;
          if (r.purchase_date && annualDepr > 0) {
            const purchaseDate = new Date(r.purchase_date);
            const now = new Date();
            // Calculate months elapsed
            let monthsElapsed = (now.getFullYear() - purchaseDate.getFullYear()) * 12;
            monthsElapsed -= purchaseDate.getMonth();
            monthsElapsed += now.getMonth();
            monthsElapsed = Math.max(0, monthsElapsed);
            
            const monthlyDepr = annualDepr / 12;
            const accumulatedDepreciation = monthlyDepr * monthsElapsed;
            currentBookValue = Math.max(Number(r.salvage_value || 0), initialValue - accumulatedDepreciation);
          }

          return {
            id: r.id,
            asset_name: r.asset_name,
            category: r.category || 'Equipment',
            purchase_price: initialValue,
            purchase_date: r.purchase_date,
            useful_life_months: (r.useful_life_years || 1) * 12,
            current_book_value: currentBookValue,
            salvage_value: Number(r.salvage_value || 0),
            status: r.status || 'Active',
          };
        })
      : [];

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

      {displayRecords.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-zinc-800/80 rounded-2xl my-4 space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mx-auto text-[#f5d77f]">
            <span className="font-bold text-lg">📦</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Fixed Assets Recorded Yet</h3>
            <p className="text-xs text-zinc-400 font-sans mt-1">Capital equipment, studio hardware, and computing assets will appear here once added.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-sans">
                <th className="py-3 px-3">Fixed Asset Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-center">Purchase Date</th>
                <th className="py-3 px-3 text-right">Purchase Cost</th>
                <th className="py-3 px-3 text-center">Useful Life</th>
                <th className="py-3 px-3 text-right">Current Book Value</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {displayRecords.map((item) => (
                <AssetRowWithHistory key={item.id} item={item as any} />
              ))}
            </tbody>
          </table>
        </div>
      )}
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
            <span>Fixed Asset</span>
          </h1>
          <p className="text-xs text-[#d4af37] font-mono uppercase tracking-wider">
            CAPITAL EQUIPMENT & DEPRECIATION HUD
          </p>
        </div>
        <RunDepreciationButton />
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
