'use client';

import React, { useState, useTransition } from 'react';

import { formatCurrency } from '@/lib/utils/currency';
import { updateDealStage } from '@/app/actions/sales';
import { ArrowLeft, ArrowRight, DollarSign, Calendar, User, AlignLeft } from 'lucide-react';
import { NewDealModal } from './NewDealModal';

const STAGES = ['Lead', 'Contact', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export function PipelineKanban({ initialDeals, clients }: { initialDeals: any[], clients: any[] }) {
  const [deals, setDeals] = useState(initialDeals);
  const [isPending, startTransition] = useTransition();

  const handleMove = (dealId: string, direction: 'left' | 'right') => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    const currentIndex = STAGES.indexOf(deal.stage);
    let newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= STAGES.length) return;
    const newStage = STAGES[newIndex];

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage } : d));

    startTransition(() => {
      updateDealStage(dealId, newStage).catch(err => {
        console.error("Failed to update deal stage", err);
        // Revert on error
        setDeals(initialDeals);
      });
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex justify-between items-center mb-6 px-4 lg:px-8 shrink-0 mt-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">CRM Pipeline</h1>
          <p className="text-sm text-zinc-400 mt-1">Track and manage your sales opportunities.</p>
        </div>
        <NewDealModal clients={clients} />
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 lg:px-8 pb-8 scrollbar-hide flex gap-6">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage);
          const stageTotal = stageDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);

          return (
            <div key={stage} className="flex flex-col w-[300px] shrink-0 bg-zinc-900/40 rounded-xl border border-[#d4af37]/10 max-h-full">
              <div className="p-4 border-b border-[#d4af37]/10 flex items-center justify-between shrink-0 bg-zinc-900/60 rounded-t-xl">
                <h3 className="font-bold text-sm text-zinc-100 uppercase tracking-wider">{stage}</h3>
                <span className="text-xs font-mono text-[#d4af37] bg-[#d4af37]/10 px-2 py-1 rounded">
                  {stageDeals.length}
                </span>
              </div>
              <div className="px-4 py-2 text-xs font-medium text-zinc-500 border-b border-zinc-800/50">
                {formatCurrency(stageTotal)}
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
                {stageDeals.map(deal => (
                  <div key={deal.id} className="bg-[#0e0f14] border-[#d4af37]/20 p-4 shadow-lg hover:border-[#d4af37]/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-bold text-zinc-100 line-clamp-2">{deal.title}</h4>
                    </div>
                    
                    <div className="text-[#d4af37] font-mono text-sm mb-3">
                      {formatCurrency(deal.value)}
                    </div>

                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center text-xs text-zinc-400 gap-2">
                        <User className="w-3.5 h-3.5 opacity-70" />
                        <span className="truncate">{deal.clients?.name}</span>
                      </div>
                      {deal.salesman_name && (
                        <div className="flex items-center text-xs text-zinc-400 gap-2">
                          <DollarSign className="w-3.5 h-3.5 opacity-70" />
                          <span className="truncate">Rep: {deal.salesman_name}</span>
                        </div>
                      )}
                      {deal.expected_close_date && (
                        <div className="flex items-center text-xs text-zinc-400 gap-2">
                          <Calendar className="w-3.5 h-3.5 opacity-70" />
                          <span className="truncate">Close: {deal.expected_close_date}</span>
                        </div>
                      )}
                    </div>

                    {/* Mobile-friendly action buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-zinc-800/50">
                      <button
                        onClick={() => handleMove(deal.id, 'left')}
                        disabled={STAGES.indexOf(stage) === 0}
                        className="p-1.5 text-zinc-500 hover:text-[#d4af37] hover:bg-[#d4af37]/10 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMove(deal.id, 'right')}
                        disabled={STAGES.indexOf(stage) === STAGES.length - 1}
                        className="p-1.5 text-zinc-500 hover:text-[#d4af37] hover:bg-[#d4af37]/10 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500 transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
