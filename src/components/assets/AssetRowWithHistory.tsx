'use client';

import React, { useState } from 'react';
import { AssetRowActions } from './AssetRowActions';
import { getAssetDepreciationHistory } from '@/app/actions/fixed-assets';
import { formatIndoDate } from '@/lib/utils';

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

export function AssetRowWithHistory({ item }: { item: FixedAssetRecord }) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpen = async () => {
    setIsOpen(true);
    setIsLoading(true);
    const data = await getAssetDepreciationHistory(item.id);
    setHistory(data);
    setIsLoading(false);
  };

  return (
    <>
      <tr className="hover:bg-zinc-800/30 transition-colors group cursor-pointer" onClick={handleOpen}>
        <td className="py-3 px-3 font-sans font-semibold text-white group-hover:text-[#f5d77f] transition-colors">
          {item.asset_name}
        </td>
        <td className="py-3 px-3">
          <span className="text-[10px] px-2.5 py-0.5 rounded bg-zinc-900 text-[#d4af37] border border-[#d4af37]/20">
            {item.category}
          </span>
        </td>
        <td className="py-3 px-3 text-zinc-400 font-mono text-center">
          {formatIndoDate(item.purchase_date)}
        </td>
        <td className="py-3 px-3 text-right text-zinc-300">
          Rp {item.purchase_price.toLocaleString('en-US')}
        </td>
        <td className="py-3 px-3 text-center text-zinc-400">
          {item.useful_life_months} months
        </td>
        <td className="py-3 px-3 text-right">
          <span className="text-sm font-black text-[#f5d77f] drop-shadow-[0_0_10px_rgba(245,215,127,0.45)]">
            Rp {item.current_book_value.toLocaleString('en-US')}
          </span>
        </td>
        <td className="py-3 px-3 text-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase bg-[#d4af37]/15 text-[#f5d77f] border border-[#d4af37]/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f5d77f] animate-pulse"></span>
            <span>{item.status}</span>
          </span>
        </td>
        <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
          <AssetRowActions id={item.id} />
        </td>
      </tr>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setIsOpen(false)}>
          <div className="gold-glass-panel rounded-2xl w-full max-w-lg p-6 border border-[#d4af37]/30 shadow-[0_0_50px_rgba(212,175,55,0.15)] animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
              <div>
                <h3 className="text-[#f5d77f] font-bold text-lg">{item.asset_name}</h3>
                <p className="text-xs text-zinc-400 font-mono mt-1">DEPRECIATION EXPENSE HISTORY</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Book Value</div>
                <div className="text-white font-bold font-mono">Rp {item.current_book_value.toLocaleString('en-US')}</div>
              </div>
            </div>

            <div className="min-h-[150px] max-h-[300px] overflow-y-auto pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
                  <p className="text-xs font-mono">NO DEPRECIATION LOGGED YET</p>
                  <p className="text-[10px] mt-1">Run Monthly Depreciation engine to log.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                      <div>
                        <div className="text-xs font-bold text-zinc-200">{log.description}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-1">REF: {log.reference_id}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-red-400">- Rp {Number(log.debit_amount).toLocaleString('en-US')}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-1">{formatIndoDate(log.transaction_date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsOpen(false)}
              className="w-full mt-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-black bg-[#f5d77f] hover:bg-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}


