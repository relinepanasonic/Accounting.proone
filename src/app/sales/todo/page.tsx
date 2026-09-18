import React from 'react';
import { Calendar as CalendarIcon, CheckSquare, Clock, Plus, ExternalLink, MoreVertical } from 'lucide-react';

export default function SalesToDoPage() {
  // Demo tasks data
  const scheduleItems = [
    { time: '09:00 AM', title: 'Client Sync: Website Redesign', type: 'meeting' },
    { time: '11:30 AM', title: 'Proposal Review - PT Maju Bersama', type: 'call' },
    { time: '02:00 PM', title: 'Follow up Lead: Nico', type: 'task' }
  ];

  const todoItems = [
    { title: 'Send contract to AADK Coffee', priority: 'High', completed: false },
    { title: 'Update pipeline stages', priority: 'Medium', completed: true },
    { title: 'Prepare monthly sales report', priority: 'Low', completed: false },
    { title: 'Draft email to new leads from landing page', priority: 'High', completed: false },
  ];

  return (
    <div className="p-4 lg:p-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Today's Brief</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage your daily tasks and meetings.</p>
        </div>
        <button className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-[#d4af37]/50 text-zinc-300 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          <CalendarIcon className="w-4 h-4 text-[#d4af37]" />
          Sync to Google Calendar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Calendar & Schedule */}
        <div className="lg:col-span-1 space-y-6">
          {/* Mini Calendar UI (Static display) */}
          <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-100 tracking-wider uppercase">September 2026</h2>
              <div className="flex gap-2">
                <button className="text-zinc-500 hover:text-zinc-300">&lt;</button>
                <button className="text-zinc-500 hover:text-zinc-300">&gt;</button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="text-[10px] font-bold text-zinc-500 uppercase">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {Array.from({ length: 30 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`py-1.5 text-xs rounded-md cursor-pointer ${
                    i + 1 === 18 
                      ? 'bg-[#d4af37] text-black font-bold' 
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl p-5 shadow-lg flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#d4af37]" /> Today's Schedule
              </h2>
              <button className="text-[#d4af37] hover:bg-[#d4af37]/10 p-1 rounded transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              {scheduleItems.map((item, idx) => (
                <div key={idx} className="flex gap-4 group">
                  <div className="text-xs font-mono font-semibold text-zinc-500 pt-1 shrink-0 w-16">
                    {item.time}
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-3 flex-1 group-hover:border-[#d4af37]/30 transition-colors">
                    <h4 className="text-sm font-bold text-zinc-200">{item.title}</h4>
                    <span className="inline-block mt-2 px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-zinc-800 text-zinc-400">
                      {item.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: To Do List */}
        <div className="lg:col-span-2">
          <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl shadow-lg flex flex-col h-full overflow-hidden">
            <div className="p-5 border-b border-[#d4af37]/10 bg-zinc-900/30 flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-[#d4af37]" /> Master Action Items
              </h2>
              <button className="bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                + Add Task
              </button>
            </div>
            
            <div className="flex-1 p-5 overflow-auto">
              <div className="space-y-3">
                {todoItems.map((todo, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    todo.completed 
                      ? 'bg-zinc-900/20 border-zinc-800/40 opacity-60' 
                      : 'bg-[#13141a] border-zinc-800 hover:border-[#d4af37]/40 shadow-sm'
                  }`}>
                    <div className="flex items-center gap-4">
                      <button className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                        todo.completed 
                          ? 'bg-[#d4af37] border-none text-black' 
                          : 'border border-zinc-600 hover:border-[#d4af37]'
                      }`}>
                        {todo.completed && <CheckSquare className="w-3.5 h-3.5" />}
                      </button>
                      <span className={`text-sm font-medium ${todo.completed ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                        {todo.title}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {!todo.completed && (
                        <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${
                          todo.priority === 'High' ? 'bg-red-500/10 text-red-400' :
                          todo.priority === 'Medium' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-blue-500/10 text-blue-400'
                        }`}>
                          {todo.priority}
                        </span>
                      )}
                      <button className="text-zinc-500 hover:text-zinc-300">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
