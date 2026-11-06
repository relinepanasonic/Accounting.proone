'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Loader2, PlayCircle, History, CheckCircle2, Circle, CircleDashed } from 'lucide-react';
import { fetchAdvertiserLogs } from '@/app/actions/advertiser';
import { AdvertiserDashboard } from './AdvertiserDashboard';
import { ClientSelect } from '@/components/ui/ClientSelect';
import { AdvertiserLogDetail } from './AdvertiserLogDetail';

interface Client {
  id: string;
  name: string;
  /** The store linked in the Clients table ("Company - Store"). */
  store_name?: string | null;
  /** Every store of the client ("Company - Store"). */
  stores?: string[];
}

const COMPANIES = ['ProOne', 'Reline', 'Alpha', 'Lighting Solution'];
/** "ProOne - japarutomo" -> company and store. */
const splitStore = (v?: string | null) => { const m = /^\s*(ProOne|Reline|Alpha|Lighting Solution)\s+-\s*(.*)$/i.exec(v || ''); return m ? { company: COMPANIES.find((c) => c.toLowerCase() === m[1].toLowerCase()) || m[1], store: m[2].trim() } : { company: '', store: '' }; };

interface AdvertiserManagerProps {
  clients: Client[];
}

export function AdvertiserManager({ clients }: AdvertiserManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // New Record State
  const [selectedClient, setSelectedClient] = useState<string>(clients[0]?.id || '');
  // The log is kept per STORE: a client can have several. "Company - Store".
  const [storeCompany, setStoreCompany] = useState<string>(splitStore(clients[0]?.stores?.[0] || clients[0]?.store_name).company || 'ProOne');
  const [storeName, setStoreName] = useState<string>(splitStore(clients[0]?.stores?.[0] || clients[0]?.store_name).store);
  const [storeError, setStoreError] = useState('');
  const storeLabel = storeName.trim() ? `${storeCompany} - ${storeName.trim()}` : '';
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [session, setSession] = useState<number>(1);
  const [showNewModal, setShowNewModal] = useState(false);
  const [detailLog, setDetailLog] = useState<any | null>(null);
  const [detailSession, setDetailSession] = useState(1);

  // Filter State
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterAdvertiser, setFilterAdvertiser] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('');
  const [filterStore, setFilterStore] = useState<string>('');

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

  // Choosing a client suggests its linked store; the stores already logged for it are offered too.
  const pickClient = (id: string) => {
    setSelectedClient(id);
    const known = logs.find((l) => l.client_id === id && l.store_label);
    const c = clients.find((x) => x.id === id);
    const linked = splitStore(c?.stores?.[0] || c?.store_name);
    const from = known ? splitStore(known.store_label) : linked;
    setStoreCompany(from.company || 'ProOne');
    setStoreName(from.store);
    setStoreError('');
  };
  const chosen = clients.find((c) => c.id === selectedClient);
  const storesOfClient = Array.from(new Set([
    ...(chosen?.stores || (chosen?.store_name ? [chosen.store_name] : [])),
    ...logs.filter((l) => l.client_id === selectedClient && l.store_label).map((l) => l.store_label as string),
  ].filter((x) => splitStore(x).store)));

  const handleStartRecord = () => {
    if (!storeName.trim()) { setStoreError('Type the store of this log.'); return; }
    setStoreError('');
    setIsEditing(true);
    setShowNewModal(false);
  };

  if (isEditing) {
    return (
      <AdvertiserDashboard 
        clients={clients}
        initialClient={selectedClient}
        initialStore={storeLabel}
        initialDate={reportDate}
        initialSession={session}
        onBack={() => setIsEditing(false)}
      />
    );
  }

  const uniqueStores = Array.from(new Set(logs.map((l) => l.store_label as string).filter(Boolean))).sort();
  const uniqueAdvertisers = Array.from(new Set(logs.map(l => l.advertiser_name))).filter(Boolean).sort();

  const filteredLogs = logs.filter(log => {
    let match = true;
    if (filterMonth && !log.report_date.startsWith(filterMonth)) match = false;
    if (filterAdvertiser && log.advertiser_name !== filterAdvertiser) match = false;
    if (filterClient && log.client_id !== filterClient) match = false;
    if (filterStore && (log.store_label || '') !== filterStore) match = false;
    return match;
  });

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
          className="gold-btn flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider w-full md:w-auto"
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
                  onChange={pickClient}
                  options={clients.map(c => ({ id: c.id, name: c.name }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Store</label>
                <div className="flex gap-2">
                  <select value={storeCompany} onChange={(e) => setStoreCompany(e.target.value)} className="w-[42%] bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]">
                    {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input list="log-stores" value={storeName} onChange={(e) => { setStoreName(e.target.value); setStoreError(''); }} placeholder="Store name" className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37]" />
                  <datalist id="log-stores">{storesOfClient.map((st) => <option key={st} value={splitStore(st).store} />)}</datalist>
                </div>
                <p className="mt-1 text-[10px] text-zinc-500">A client can have several stores: each store has its own log.</p>
                {storeError && <p className="mt-1 text-[11px] text-red-400">{storeError}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Tanggal (Date)</label>
                <input 
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer focus:outline-none focus:border-[#d4af37] transition-colors"
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

      {detailLog && (
        <AdvertiserLogDetail
          log={detailLog}
          initialSession={detailSession}
          onClose={() => setDetailLog(null)}
          onEdit={(sessionNumber) => {
            setSelectedClient(detailLog.client_id);
            { const sp = splitStore(detailLog.store_label); setStoreCompany(sp.company || 'ProOne'); setStoreName(sp.store); }
            setReportDate(detailLog.report_date);
            setSession(sessionNumber);
            setDetailLog(null);
            setIsEditing(true);
          }}
        />
      )}

      {/* Logs Table Area */}
      <div className="gold-glass-panel rounded-2xl border border-[#d4af37]/20 overflow-hidden relative">
        
        {/* Filters */}
        <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/40 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input 
              type="month"
              aria-label="Month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer focus:outline-none focus:border-[#d4af37] transition-colors"
            />
          </div>
          <div className="flex-1">
            <select 
              aria-label="Advertiser"
              value={filterAdvertiser}
              onChange={(e) => setFilterAdvertiser(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-colors"
            >
              <option value="">All Advertisers</option>
              {uniqueAdvertisers.map(adv => (
                <option key={adv as string} value={adv as string}>{adv as string}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <select 
              aria-label="Client"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-colors"
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <select
              aria-label="Store"
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-colors"
            >
              <option value="">All Stores</option>
              {uniqueStores.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
        </div>

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
                <th className="px-6 py-4 font-bold">Store</th>
                <th className="px-6 py-4 font-bold text-center">Sesi 1</th>
                <th className="px-6 py-4 font-bold text-center">Sesi 2</th>
                <th className="px-6 py-4 font-bold text-center">Sesi 3</th>
                <th className="px-6 py-4 font-bold">Note</th>
                <th className="px-6 py-4 font-bold">Date/Time Stamp</th>
                <th className="px-6 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
              {filteredLogs.length === 0 && !isLoadingLogs ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-zinc-500">
                    No records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-bold text-white">
                      {new Date(log.report_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-[#d4af37] font-mono">{log.advertiser_name}</td>
                    <td className="px-6 py-4 font-bold">{log.client_name}</td>
                    <td className="px-6 py-4 text-zinc-300">{log.store_label || <span className="text-zinc-600">-</span>}</td>
                    
                    <td className="px-6 py-4 text-center">
                      {log.sessions[1] ? <button type="button" onClick={() => { setDetailSession(1); setDetailLog(log); }} title={log.drafts?.[1] ? 'Draft: Biaya Iklan / Penjualan still empty. Open it and press Edit to continue.' : 'Open the report of session 1'} className="mx-auto block rounded-full hover:brightness-150">{log.drafts?.[1] ? <CircleDashed className="w-5 h-5 text-amber-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}</button> : <Circle className="w-4 h-4 text-zinc-700 mx-auto" />}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {log.sessions[2] ? <button type="button" onClick={() => { setDetailSession(2); setDetailLog(log); }} title={log.drafts?.[2] ? 'Draft: Biaya Iklan / Penjualan still empty. Open it and press Edit to continue.' : 'Open the report of session 2'} className="mx-auto block rounded-full hover:brightness-150">{log.drafts?.[2] ? <CircleDashed className="w-5 h-5 text-amber-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}</button> : <Circle className="w-4 h-4 text-zinc-700 mx-auto" />}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {log.sessions[3] ? <button type="button" onClick={() => { setDetailSession(3); setDetailLog(log); }} title={log.drafts?.[3] ? 'Draft: Biaya Iklan / Penjualan still empty. Open it and press Edit to continue.' : 'Open the report of session 3'} className="mx-auto block rounded-full hover:brightness-150">{log.drafts?.[3] ? <CircleDashed className="w-5 h-5 text-amber-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}</button> : <Circle className="w-4 h-4 text-zinc-700 mx-auto" />}
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="max-w-[200px] truncate text-xs text-zinc-400">
                        {log.note || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                      <div>{new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div>{new Date(log.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClient(log.client_id);
                          { const sp = splitStore(log.store_label); setStoreCompany(sp.company || 'ProOne'); setStoreName(sp.store); }
                          setReportDate(log.report_date);
                          // Default to the first available session or just 1
                          setSession(log.sessions[1] ? 1 : log.sessions[2] ? 2 : 3);
                          setIsEditing(true);
                        }}
                        className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-white font-bold transition-colors"
                      >
                        EDIT
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
