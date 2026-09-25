'use client';

import React, { useState, useTransition } from 'react';
import { toggleClientAssignment } from '@/app/actions/assignments';
import { UserPlus, Loader2, Search, CheckSquare, Square } from 'lucide-react';

interface Client {
  id: string;
  name: string;
}

interface StaffMember {
  user_id: string;
  role: string;
  profiles: { full_name: string; email: string };
}

interface AssignmentManagerProps {
  clients: Client[];
  staff: StaffMember[];
  assignments: { client_id: string; user_id: string }[];
}

export function AssignmentManager({ clients, staff, assignments }: AssignmentManagerProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>(staff[0]?.user_id || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleToggle = (clientId: string, isCurrentlyAssigned: boolean) => {
    if (!selectedUserId) return;
    
    startTransition(async () => {
      await toggleClientAssignment(clientId, selectedUserId, !isCurrentlyAssigned);
    });
  };

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // Get assignments for the currently selected user
  const userAssignedClientIds = new Set(
    assignments.filter(a => a.user_id === selectedUserId).map(a => a.client_id)
  );

  return (
    <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl overflow-hidden shadow-xl flex flex-col md:flex-row min-h-[600px]">
      
      {/* Left Sidebar: Staff Selection */}
      <div className="w-full md:w-1/3 bg-zinc-900/40 border-r border-[#d4af37]/20 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-100 uppercase flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#d4af37]" /> Select Staff
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {staff.map(member => {
            const isSelected = member.user_id === selectedUserId;
            return (
              <button
                key={member.user_id}
                onClick={() => setSelectedUserId(member.user_id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all flex flex-col ${
                  isSelected ? 'bg-[#d4af37]/15 border border-[#d4af37]/30 shadow-md' : 'hover:bg-zinc-800/50 border border-transparent'
                }`}
              >
                <span className={`font-bold text-sm ${isSelected ? 'text-[#f5d77f]' : 'text-zinc-200'}`}>
                  {member.profiles?.full_name || member.profiles?.email}
                </span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono mt-1">
                  ROLE: {member.role}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Area: Client Assignments */}
      <div className="w-full md:w-2/3 flex flex-col relative">
        {isPending && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
          </div>
        )}
        
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-zinc-100 uppercase">Assign Clients</h2>
            <p className="text-xs text-zinc-500 mt-1">Select clients for the active staff member.</p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search clients..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] focus:outline-none w-64"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
          {filteredClients.map(client => {
            const isAssigned = userAssignedClientIds.has(client.id);
            return (
              <button
                key={client.id}
                onClick={() => handleToggle(client.id, isAssigned)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                  isAssigned 
                    ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <div className={`shrink-0 ${isAssigned ? 'text-emerald-400' : 'text-zinc-600'}`}>
                  {isAssigned ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold truncate text-sm ${isAssigned ? 'text-emerald-50' : 'text-zinc-300'}`}>
                    {client.name}
                  </div>
                </div>
              </button>
            );
          })}
          {filteredClients.length === 0 && (
            <div className="col-span-full p-8 text-center text-zinc-500">
              No clients match your search.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
