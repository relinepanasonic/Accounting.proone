import React, { Suspense } from 'react';
import { Box, Plus, TrendingDown, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface AssetRecord {
  id: string;
  asset_name: string;
  asset_tag: string;
  category: string;
  purchase_date: string;
  initial_value: number;
  salvage_value: number;
  useful_life_years: number;
  status: string;
}

async function FixedAssetsTable() {
  const supabase = await createClient();

  const { data: assets, error } = await supabase
    .from('fixed_assets')
    .select('*')
    .order('purchase_date', { ascending: false });

  const displayAssets: AssetRecord[] =
    assets && assets.length > 0
      ? assets.map((a) => ({
          id: a.id,
          asset_name: a.asset_name,
          asset_tag: a.asset_tag,
          category: a.category || 'Studio Equipment',
          purchase_date: a.purchase_date || '2026-01-15',
          initial_value: Number(a.initial_value || 0),
          salvage_value: Number(a.salvage_value || 0),
          useful_life_years: Number(a.useful_life_years || 3),
          status: a.status || 'active',
        }))
      : [
          {
            id: '1',
            asset_name: '4K Studio Cameras (Sony FX6 Dual Kit)',
            asset_tag: 'FA-CAM-001',
            category: 'Studio Equipment',
            purchase_date: '2026-01-15',
            initial_value: 18500,
            salvage_value: 2500,
            useful_life_years: 4,
            status: 'active',
          },
          {
            id: '2',
            asset_name: 'Professional Ring Light & Softbox Rig',
            asset_tag: 'FA-LGT-002',
            category: 'Studio Lighting',
            purchase_date: '2026-02-10',
            initial_value: 4200,
            salvage_value: 400,
            useful_life_years: 3,
            status: 'active',
          },
          {
            id: '3',
            asset_name: 'Editing Workstations (Apple Mac Studio M3 Ultra)',
            asset_tag: 'FA-COMP-003',
            category: 'Computing Hardware',
            purchase_date: '2026-03-01',
            initial_value: 12400,
            salvage_value: 1400,
            useful_life_years: 3,
            status: 'active',
          },
        ];

  const nowMs = Date.now();

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl">
      {/* Table Header HUD Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            CAPITAL ASSET REGISTRY & STRAIGHT-LINE DEPRECIATION
          </h2>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            FORMULA: (INITIAL VALUE - SALVAGE VALUE) / USEFUL LIFE YEARS
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-full border border-cyan-500/30">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>AUTO DEPRECIATION ENGINE</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-sans">
              <th className="py-3 px-3">Asset Tag</th>
              <th className="py-3 px-3">Asset Name & Category</th>
              <th className="py-3 px-3">Purchase Date</th>
              <th className="py-3 px-3 text-right">Initial Value</th>
              <th className="py-3 px-3 text-right">Annual Deprec.</th>
              <th className="py-3 px-3 text-right">Current Book Value</th>
              <th className="py-3 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {displayAssets.map((asset) => {
              // Server-Side Straight-Line Depreciation Formula
              const initialVal = asset.initial_value;
              const salvageVal = asset.salvage_value;
              const lifeYears = asset.useful_life_years > 0 ? asset.useful_life_years : 1;

              const annualDepreciation = (initialVal - salvageVal) / lifeYears;

              const purchaseDateMs = new Date(asset.purchase_date).getTime() || nowMs;
              const yearsPassedRaw = (nowMs - purchaseDateMs) / (365.25 * 24 * 3600 * 1000);
              const yearsPassed = Math.min(lifeYears, Math.max(0, yearsPassedRaw));

              const currentValue = Math.max(
                salvageVal,
                initialVal - annualDepreciation * yearsPassed
              );

              return (
                <tr
                  key={asset.id}
                  className="hover:bg-slate-800/40 transition-colors group"
                >
                  {/* Asset Tag */}
                  <td className="py-3 px-3 font-bold text-cyan-300">
                    {asset.asset_tag}
                  </td>

                  {/* Name & Category */}
                  <td className="py-3 px-3 font-sans">
                    <div className="font-semibold text-white">
                      {asset.asset_name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {asset.category} • Life: {asset.useful_life_years} yrs
                    </div>
                  </td>

                  {/* Purchase Date */}
                  <td className="py-3 px-3 text-slate-400">
                    {asset.purchase_date}
                  </td>

                  {/* Initial Value */}
                  <td className="py-3 px-3 text-right text-slate-300 font-semibold">
                    ${initialVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>

                  {/* Annual Depreciation */}
                  <td className="py-3 px-3 text-right text-amber-400 font-semibold">
                    -${annualDepreciation.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr
                  </td>

                  {/* Current Book Value Highlighted in Cyber-Cyan */}
                  <td className="py-3 px-3 text-right">
                    <span className="text-sm font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">
                      ${currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                      <span>{asset.status}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AssetsPage() {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
            <Box className="w-5 h-5 text-amber-400" />
            <span>FIXED ASSETS • CAPITAL EQUIPMENT & DEPRECIATION HUD</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            AUTOMATED BOOK VALUE TELEMETRY • ZERO SPREADSHEET COMPLEXITY
          </p>
        </div>

        <button
          type="button"
          title="Register New Asset"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all transform hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          <span>REGISTER NEW ASSET</span>
        </button>
      </div>

      {/* RSC Assets Table with Suspense Streaming */}
      <Suspense
        fallback={
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl h-80 animate-pulse p-6">
            <div className="h-6 w-1/3 bg-slate-800 rounded mb-6"></div>
            <div className="space-y-3">
              <div className="h-10 bg-slate-800/60 rounded"></div>
              <div className="h-10 bg-slate-800/60 rounded"></div>
              <div className="h-10 bg-slate-800/60 rounded"></div>
            </div>
          </div>
        }
      >
        <FixedAssetsTable />
      </Suspense>
    </div>
  );
}
