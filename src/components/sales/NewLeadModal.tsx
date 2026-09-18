'use client';

import React, { useState, useTransition } from 'react';
import { createDeal } from '@/app/actions/sales';
import { Plus, X } from 'lucide-react';

export function NewLeadModal({ clients }: { clients: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // Force the stage to be Lead for new entries in this database
    formData.set('stage', 'Lead');
    
    startTransition(() => {
      createDeal(formData).then(() => {
        setIsOpen(false);
      }).catch(err => {
        alert("Failed to create lead: " + err.message);
      });
    });
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-gradient-to-r from-[#d4af37] to-[#f5d77f] text-black text-sm font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center shadow-lg"
      >
        <Plus className="w-4 h-4 mr-2" />
        New Lead
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl w-full max-w-md overflow-hidden shadow-[0_0_40px_rgba(212,175,55,0.15)] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/50">
              <h2 className="text-lg font-bold text-zinc-100 font-serif">Add New Lead</h2>
              <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Lead / Deal Title</label>
                <input 
                  type="text" 
                  name="title" 
                  required 
                  placeholder="e.g. Website Redesign"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#d4af37]/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Client</label>
                <select 
                  name="client_id" 
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#d4af37]/50"
                >
                  <option value="">Select a client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Expected Value (Rp)</label>
                <input 
                  type="text" 
                  name="value" 
                  placeholder="e.g. 50000000"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#d4af37]/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Salesman Name</label>
                  <input 
                    type="text" 
                    name="salesman_name" 
                    placeholder="e.g. Nico"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#d4af37]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Close Date</label>
                  <input 
                    type="date" 
                    name="expected_close_date" 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#d4af37]/50 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Notes</label>
                <textarea 
                  name="notes" 
                  rows={3}
                  placeholder="Optional notes about this lead..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#d4af37]/50"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="w-full py-2 bg-gradient-to-r from-[#d4af37] to-[#f5d77f] rounded-lg text-black font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
