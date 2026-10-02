'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, LayoutDashboard, ArrowLeft, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import Image from 'next/image';

interface Workspace {
  id: string;
  name: string;
  role: string;
  logo_url?: string;
}

interface SelectorClientProps {
  workspaces: Workspace[];
  firstName: string;
}

export function SelectorClient({ workspaces, firstName }: SelectorClientProps) {
  const router = useRouter();
  // By default, select all
  const [selectedIds, setSelectedIds] = useState<string[]>(workspaces.map(w => w.id));

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleProceed = () => {
    if (selectedIds.length === 0) return;
    const query = new URLSearchParams();
    query.set('w', selectedIds.join(','));
    router.push(`/workspaces/combined-dashboard?${query.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-[#0b0c10]">
      <div className="w-full max-w-2xl">
        <a href="/workspaces" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Workspaces
        </a>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center mb-4 text-[#f5d77f] shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <LayoutDashboard className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-wide text-white font-serif">
            Combined Global Dashboard
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-md">
            Select the companies you want to merge. The dashboard will aggregate financial data and metrics across all selected workspaces.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {workspaces.map((ws) => {
            const isSelected = selectedIds.includes(ws.id);
            return (
              <button
                key={ws.id}
                onClick={() => toggle(ws.id)}
                className={`w-full text-left group relative rounded-2xl border p-4 flex items-center gap-4 transition-all ${
                  isSelected 
                    ? 'bg-[#d4af37]/10 border-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.1)]' 
                    : 'gold-glass-panel border-[#d4af37]/20 hover:border-[#d4af37]/50'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0 transition-colors ${
                  isSelected ? 'bg-[#d4af37]/20 border border-[#d4af37]/50' : 'bg-[#d4af37]/10 border border-[#d4af37]/20'
                }`}>
                  {ws.logo_url ? (
                    <img src={ws.logo_url} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className={`w-5 h-5 ${isSelected ? 'text-[#f5d77f]' : 'text-[#d4af37]'}`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{ws.name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase text-zinc-500">
                      Role: {ws.role}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 pl-4">
                  {isSelected ? (
                    <CheckCircle2 className="w-6 h-6 text-[#d4af37]" />
                  ) : (
                    <Circle className="w-6 h-6 text-zinc-600 group-hover:text-zinc-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleProceed}
            disabled={selectedIds.length === 0}
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#d4af37] hover:bg-[#f5d77f] text-black text-sm font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate Dashboard
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
