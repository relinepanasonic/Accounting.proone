'use client';

import React, { useState, useTransition } from 'react';
import { formatCurrency } from '@/lib/utils/currency';
import { updateDealStage } from '@/app/actions/sales';
import { ArrowLeft, ArrowRight, DollarSign, Calendar, User, MoreHorizontal, Plus, GripHorizontal } from 'lucide-react';
import { NewDealModal } from './NewDealModal';

const STAGES = ['Lead', 'Contact', 'Proposal', 'Negotiation', 'Won', 'Lost'];

// Stage colors for the top bar of cards or dots
const STAGE_COLORS: Record<string, string> = {
  'Lead': 'bg-zinc-400',
  'Contact': 'bg-blue-400',
  'Proposal': 'bg-purple-400',
  'Negotiation': 'bg-amber-400',
  'Won': 'bg-emerald-400',
  'Lost': 'bg-red-400'
};

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
        setDeals(initialDeals);
      });
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-6 px-4 lg:px-8 shrink-0 mt-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">CRM Pipeline</h1>
          <p className="text-sm text-zinc-400 mt-1">Track and manage your sales opportunities.</p>
        </div>
        <NewDealModal clients={clients} />
      </div>

      {/* Kanban Board Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 lg:px-8 pb-8 flex gap-5 custom-scrollbar">
        {STAGES.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage);
          const stageTotal = stageDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);

          return (
            <div 
              key={stage} 
              className="flex flex-col w-[320px] shrink-0 bg-[#0e0f14] rounded-2xl border border-zinc-800/60 max-h-full"
            >
              {/* Column Header */}
              <div className="p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${STAGE_COLORS[stage] || 'bg-zinc-500'} shadow-[0_0_8px_currentColor] opacity-80`} />
                  <h3 className="font-bold text-[15px] text-zinc-100 tracking-wide">{stage}</h3>
                  <span className="text-xs font-medium text-zinc-400 bg-zinc-800/50 px-2 py-0.5 rounded-full ml-1">
                    {stageDeals.length}
                  </span>
                </div>
                <button className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-md hover:bg-zinc-800/50">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>

              {/* Total Value Bar */}
              <div className="px-4 pb-3 text-xs font-semibold text-[#d4af37]/80 border-b border-zinc-800/50 flex justify-between items-center">
                <span>Pipeline Value</span>
                <span>{formatCurrency(stageTotal)}</span>
              </div>
              
              {/* Cards Area */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {stageDeals.map(deal => (
                  <div 
                    key={deal.id} 
                    className="group relative bg-[#13141a] rounded-xl border border-zinc-800/50 p-4 shadow-md hover:border-[#d4af37]/40 transition-all duration-200 overflow-hidden"
                  >
                    {/* Top Color Accent Bar based on Stage */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${STAGE_COLORS[stage] || 'bg-zinc-700'} opacity-70`} />

                    {/* Tag / Client Name */}
                    <div className="flex items-center justify-between mb-3 mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#d4af37]/10 text-[#f5d77f]">
                        <User className="w-3 h-3 mr-1 opacity-70" />
                        <span className="truncate max-w-[120px]">{deal.clients?.name}</span>
                      </span>
                      <button className="text-zinc-600 hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Title */}
                    <h4 className="text-[15px] font-bold text-zinc-100 leading-snug mb-2 line-clamp-2">
                      {deal.title}
                    </h4>

                    {/* Value */}
                    <div className="text-[#d4af37] font-semibold text-sm mb-4">
                      {formatCurrency(deal.value)}
                    </div>

                    {/* Progress Bar (Visual flair) */}
                    <div className="w-full h-1 bg-zinc-800 rounded-full mb-4 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#d4af37]/40 to-[#d4af37] w-1/3 rounded-full" />
                    </div>

                    {/* Footer Info */}
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <div className="flex items-center gap-3">
                        {deal.expected_close_date && (
                          <div className="flex items-center gap-1.5" title="Expected Close Date">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{new Date(deal.expected_close_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        )}
                      </div>
                      
                      {deal.salesman_name && (
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-300 shadow-sm" title={`Salesman: ${deal.salesman_name}`}>
                          {deal.salesman_name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Mobile Navigation Arrows (Overlay on hover) */}
                    <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <button
                        onClick={() => handleMove(deal.id, 'left')}
                        disabled={STAGES.indexOf(stage) === 0}
                        className="pointer-events-auto p-1.5 bg-black/80 text-zinc-300 rounded-full hover:text-[#d4af37] hover:bg-[#d4af37]/20 disabled:opacity-0 transition-all transform -translate-x-2 group-hover:translate-x-0 shadow-lg border border-zinc-700"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMove(deal.id, 'right')}
                        disabled={STAGES.indexOf(stage) === STAGES.length - 1}
                        className="pointer-events-auto p-1.5 bg-black/80 text-zinc-300 rounded-full hover:text-[#d4af37] hover:bg-[#d4af37]/20 disabled:opacity-0 transition-all transform translate-x-2 group-hover:translate-x-0 shadow-lg border border-zinc-700"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Task Button (Bottom of column) */}
              <div className="p-3 border-t border-zinc-800/50 bg-[#0e0f14] rounded-b-2xl mt-auto">
                <button className="w-full py-2 flex items-center justify-center gap-2 text-xs font-semibold text-zinc-500 hover:text-[#d4af37] hover:bg-zinc-800/40 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                  Add Deal
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(212, 175, 55, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(212, 175, 55, 0.4);
        }
      `}</style>
    </div>
  );
}
