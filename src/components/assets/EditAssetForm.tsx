'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle } from 'lucide-react';
import { updateFixedAsset } from '@/app/actions/fixed-assets';
import { RupiahInput } from '@/components/ui/RupiahInput';
import Link from 'next/link';

interface EditAssetFormProps {
  initialData: any;
}

export function EditAssetForm({ initialData }: EditAssetFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [assetName, setAssetName] = useState(initialData?.asset_name || '');
  // Display as months, but store in DB as years (can be fractional like 1.5 if DB type changed to NUMERIC)
  const [usefulLifeMonths, setUsefulLifeMonths] = useState<number>((initialData?.useful_life_years || 1) * 12);
  const [salvageValue, setSalvageValue] = useState<number | ''>(initialData?.salvage_value || 0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const initialValue = initialData?.initial_value || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName) {
      setErrorMsg('Asset name is required');
      return;
    }
    if (usefulLifeMonths < 1) {
      setErrorMsg('Useful life must be at least 1 month');
      return;
    }

    const usefulLifeYears = usefulLifeMonths / 12;

    // Recalculate annual depreciation
    const depBase = initialValue - Number(salvageValue || 0);
    const annualDepreciation = depBase / usefulLifeYears;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await updateFixedAsset(initialData.id, {
        asset_name: assetName,
        category: initialData.category,
        useful_life_years: usefulLifeYears,
        salvage_value: Number(salvageValue || 0),
        // annual_depreciation is generated, so we omit it
      });

      if (res.success) {
        router.push('/assets');
      } else {
        setErrorMsg(res.error || 'Failed to update asset');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="gold-glass-panel rounded-2xl p-6 sm:p-8 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-[#d4af37]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
      
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{errorMsg}</p>
        </div>
      )}

      <div className="space-y-6 relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-[10px] font-bold tracking-widest text-[#d4af37] uppercase">Asset Name</label>
            <input
              type="text"
              required
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/50 transition-all font-sans text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-widest text-[#d4af37] uppercase">Useful Life (Months)</label>
            <input
              type="number"
              required
              min="1"
              step="1"
              value={usefulLifeMonths}
              onChange={(e) => setUsefulLifeMonths(Number(e.target.value))}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/50 transition-all font-sans text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-widest text-[#d4af37] uppercase">Salvage Value (Rp)</label>
            <RupiahInput
              value={salvageValue}
              onChange={setSalvageValue}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/50 transition-all font-sans text-sm"
              placeholder="0"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              Estimated resale value at the end of its useful life (often 0).
            </p>
          </div>
        </div>

        {/* Display live preview of calculation */}
        <div className="bg-black/20 rounded-xl p-4 border border-zinc-800 flex justify-between items-center mt-4">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">New Annual Depreciation</p>
            <p className="text-sm font-mono text-[#d4af37]">
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format((initialValue - Number(salvageValue || 0)) / (usefulLifeMonths / 12))} / year
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">Purchase Value</p>
            <p className="text-sm font-mono text-white">
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(initialValue)}
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-800 flex flex-col sm:flex-row justify-end items-center gap-4">
          <Link
            href="/assets"
            className="text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-widest transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#d4af37] text-zinc-950 font-bold uppercase tracking-wider text-sm hover:bg-[#f5d77f] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(212,175,55,0.3)]"
          >
            <Check className="w-4 h-4" />
            <span>{isPending ? 'Saving...' : 'UPDATE ASSET'}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
