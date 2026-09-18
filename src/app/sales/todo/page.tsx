'use client';

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, CheckSquare, Clock, Plus, MoreVertical, X } from 'lucide-react';
import { getTasks, createTask, toggleTaskComplete } from '@/app/actions/sales-ext';

export default function SalesToDoPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const data = await getTasks();
    setTasks(data);
    setLoading(false);
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const res = await createTask(formData);
    
    if (res && res.error) {
      alert("System Error: " + res.error + "\n\n(Did you run the SQL script for tasks?)");
    } else {
      setIsModalOpen(false);
      fetchTasks();
    }
    setSubmitting(false);
  };

  const handleToggle = async (id: string, current: boolean) => {
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !current } : t));
    const res = await toggleTaskComplete(id, current);
    if (res && res.error) {
      alert("Error: " + res.error);
      fetchTasks(); // revert
    }
  };

  // Filter tasks
  const scheduleItems = tasks.filter(t => t.scheduled_time && !t.completed).sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
  const todoItems = tasks.filter(t => !t.scheduled_time).sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });

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
          {/* Mini Calendar UI */}
          <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-100 tracking-wider uppercase">September 2026</h2>
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
              <button onClick={() => setIsModalOpen(true)} className="text-[#d4af37] hover:bg-[#d4af37]/10 p-1 rounded transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              {loading && <div className="text-xs text-zinc-500">Loading schedule...</div>}
              {!loading && scheduleItems.length === 0 && <div className="text-xs text-zinc-500">No scheduled events.</div>}
              {scheduleItems.map((item) => (
                <div key={item.id} className="flex gap-4 group">
                  <div className="text-xs font-mono font-semibold text-zinc-500 pt-1 shrink-0 w-16">
                    {new Date(item.scheduled_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-3 flex-1 group-hover:border-[#d4af37]/30 transition-colors relative">
                    <h4 className="text-sm font-bold text-zinc-200">{item.title}</h4>
                    <span className="inline-block mt-2 px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-zinc-800 text-zinc-400">
                      {item.type}
                    </span>
                    <button onClick={() => handleToggle(item.id, item.completed)} className="absolute top-3 right-3 text-zinc-500 hover:text-emerald-400">
                      <CheckSquare className="w-4 h-4" />
                    </button>
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
                <CheckSquare className="w-5 h-5 text-[#d4af37]" /> To Do List
              </h2>
              <button onClick={() => setIsModalOpen(true)} className="bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                + Add Task
              </button>
            </div>
            
            <div className="flex-1 p-5 overflow-auto">
              <div className="space-y-3">
                {loading && <div className="text-sm text-zinc-500 text-center py-4">Loading tasks...</div>}
                {!loading && todoItems.length === 0 && <div className="text-sm text-zinc-500 text-center py-4">All caught up! No tasks left.</div>}
                {todoItems.map((todo) => (
                  <div key={todo.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    todo.completed 
                      ? 'bg-zinc-900/20 border-zinc-800/40 opacity-60' 
                      : 'bg-[#13141a] border-zinc-800 hover:border-[#d4af37]/40 shadow-sm'
                  }`}>
                    <div className="flex items-center gap-4">
                      <button onClick={() => handleToggle(todo.id, todo.completed)} className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl w-full max-w-md shadow-2xl relative">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
              <h2 className="text-lg font-bold text-zinc-100 font-serif">Add New Task or Schedule</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleCreateTask} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Title</label>
                <input type="text" name="title" required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#d4af37]/50" placeholder="E.g. Follow up with client" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Type</label>
                  <select name="type" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#d4af37]/50">
                    <option value="task">Task</option>
                    <option value="call">Call</option>
                    <option value="meeting">Meeting</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Priority</label>
                  <select name="priority" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#d4af37]/50">
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Schedule Time (Optional)</label>
                <input type="datetime-local" name="scheduled_time" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#d4af37]/50 [color-scheme:dark]" />
                <p className="text-[10px] text-zinc-500 mt-1">If set, this will appear in the schedule instead of the To Do list.</p>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={submitting} className="w-full bg-[#d4af37] text-black font-bold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {submitting ? 'Saving...' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
