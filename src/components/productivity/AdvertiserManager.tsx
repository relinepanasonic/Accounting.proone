'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Loader2, PlayCircle, History, CheckCircle2, Circle } from 'lucide-react';
import { fetchAdvertiserLogs } from '@/app/actions/advertiser';
import { AdvertiserDashboard } from './AdvertiserDashboard';
import { ClientSelect } from '@/components/ui/ClientSelect';

interface Client {
  id: string;
  name: string;
}

interface AdvertiserManagerProps {
  clients: Client[];
}

export function AdvertiserManager({ clients }: AdvertiserManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // New Record State
  const [selectedClient, setSelectedClient] = useState<string>(clients[0]?.id || '');
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [session, setSession] = useState<number>(1);
  const [showNewModal, setShowNewModal] = useState(false);

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    const res = await fetchAdvertiserLogs();
    setLogs(res.data || []);
    setIsLoadingLogs(false);
  };

  useEffect(() => {
    if (!isEditing) {
      loadLogs();
    }
  }, [isEditing]);

  const handleStartRecord = () => {
    setIsEditing(true);
    setShowNewModal(false);
  };

  if (isEditing) {
    return (
      <AdvertiserDashboard 
        clients={clients}
        initialClient={selectedClient}
        initialDate={reportDate}
        initialSession={session}
        onBack={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight text-white flex items-center gap-2">
            <History className="w-6 h-6 text-[#d4af37]" />
            ADVERTISING LOGS
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Track daily advertising records across your clients and sessions.
          </p>
        </div>

        <button 
          onClick={() => setShowNewModal(true)}
          className="gold-btn flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider"
        >
          <PlayCircle className="w-5 h-5 text-black" />
          START RECORD
        </button>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#0e0f14] border border-[#d4af37]/30 p-6 rounded-2xl w-full max-w-md space-y-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-3">
              START NEW RECORD
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Client</label>
                <ClientSelect
                  value={selectedClient}
                  onChange={setSelectedClient}
                  options={clients.map(c => ({ id: c.id, name: c.name }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Tanggal (Date)</label>
                <input 
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Sesi</label>
                <select
                  value={session}
                  onChange={(e) => setSession(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-colors"
                >
                  <option value={1}>Sesi 1</option>
                  <option value={2}>Sesi 2</option>
                  <option value={3}>Sesi 3</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button 
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white font-bold"
              >
                CANCEL
              </button>
              <button 
                onClick={handleStartRecord}
                className="px-6 py-2 bg-[#d4af37] text-black rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-[#f5d77f] transition-colors"
              >
                PROCEED
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="gold-glass-panel rounded-2xl border border-[#d4af37]/20 overflow-hidden relative">
        {isLoadingLogs && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-bold">Tanggal</th>
                <th className="px-6 py-4 font-bold">Advertiser</th>
                <th className="px-6 py-4 font-bold">Client</th>
                <th className="px-6 py-4 font-bold text-center">Sesi 1</th>
                <th className="px-6 py-4 font-bold text-center">Sesi 2</th>
                <th className="px-6 py-4 font-bold text-center">Sesi 3</th>
                <th className="px-6 py-4 font-bold">Note</th>
                <th className="px-6 py-4 font-bold">Date/Time Stamp</th>
                <th className="px-6 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
              {logs.length === 0 && !isLoadingLogs ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-zinc-500">
                    No records found. Click "Start Record" to create one.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">
                      {new Date(log.report_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-[#d4af37] font-mono">{log.advertiser_name}</td>
                    <td className="px-6 py-4 font-bold">{log.client_name}</td>
                    
                    <td className="px-6 py-4 text-center">
                      {log.sessions[1] ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" /> : <Circle className="w-4 h-4 text-zinc-700 mx-auto" />}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {log.sessions[2] ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" /> : <Circle className="w-4 h-4 text-zinc-700 mx-auto" />}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {log.sessions[3] ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" /> : <Circle className="w-4 h-4 text-zinc-700 mx-auto" />}
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="max-w-[200px] truncate text-xs text-zinc-400">
                        {log.note || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                      <div>{new Date(log.created_at).toLocaleDateString()}</div>
                      <div>{new Date(log.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          setSelectedClient(log.client_id);
                          setReportDate(log.report_date);
                          // Default to the first available session or just 1
                          setSession(log.sessions[1] ? 1 : log.sessions[2] ? 2 : 3);
                          setIsEditing(true);
                        }}
                        className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-white font-bold transition-colors"
                      >
                        VIEW / EDIT
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
