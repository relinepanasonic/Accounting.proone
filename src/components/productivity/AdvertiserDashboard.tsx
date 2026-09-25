'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardPaste, Save, Trash2, AlertCircle, TrendingUp, Users, Target } from 'lucide-react';

interface Client {
  id: string;
  name: string;
}

interface AdvertiserDashboardProps {
  clients: Client[];
}

type TabType = 'inkubasi' | 'group' | 'mandiri';

export function AdvertiserDashboard({ clients }: AdvertiserDashboardProps) {
  const [selectedClient, setSelectedClient] = useState<string>(clients[0]?.id || '');
  const [activeTab, setActiveTab] = useState<TabType>('inkubasi');
  
  // Data state per tab
  const [inkubasiData, setInkubasiData] = useState<any[]>([]);
  const [groupData, setGroupData] = useState<any[]>([]);
  const [mandiriData, setMandiriData] = useState<any[]>([]);

  // Function to handle pasting data from Excel/Google Sheets
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('Text');
    if (!clipboardData) return;

    // Split by newline to get rows, then by tab to get cells
    const rows = clipboardData.split(/\r?\n/).filter(row => row.trim() !== '');
    const parsedData = rows.map(row => row.split('\t'));

    if (activeTab === 'inkubasi' || activeTab === 'group') {
      const formatted = parsedData.map(cols => ({
        iklanProduk: cols[0] || '',
        biayaIklan: cols[1] || '',
        penjualan: cols[2] || '',
        konversi: cols[3] || '',
        produkTerjual: cols[4] || '',
        roas: cols[5] || '',
        recommendation: '',
      }));
      if (activeTab === 'inkubasi') {
        setInkubasiData(prev => [...prev, ...formatted]);
      } else {
        setGroupData(prev => [...prev, ...formatted]);
      }
    } else if (activeTab === 'mandiri') {
      const formatted = parsedData.map(cols => ({
        infoIklan: cols[0] || '',
        modalHarian: cols[1] || '',
        targetRoas: cols[2] || '',
        diagnosis: cols[3] || '',
        biayaIklan: cols[4] || '',
        penjualan: cols[5] || '',
        roas: cols[6] || '',
        recommendation: '',
      }));
      setMandiriData(prev => [...prev, ...formatted]);
    }
  };

  const handleRecommendationChange = (index: number, val: string) => {
    if (activeTab === 'inkubasi') {
      const newData = [...inkubasiData];
      newData[index].recommendation = val;
      setInkubasiData(newData);
    } else if (activeTab === 'group') {
      const newData = [...groupData];
      newData[index].recommendation = val;
      setGroupData(newData);
    } else if (activeTab === 'mandiri') {
      const newData = [...mandiriData];
      newData[index].recommendation = val;
      setMandiriData(newData);
    }
  };

  const clearData = () => {
    if (activeTab === 'inkubasi') setInkubasiData([]);
    else if (activeTab === 'group') setGroupData([]);
    else if (activeTab === 'mandiri') setMandiriData([]);
  };

  const getActiveData = () => {
    if (activeTab === 'inkubasi') return inkubasiData;
    if (activeTab === 'group') return groupData;
    return mandiriData;
  };

  const activeData = getActiveData();

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0e0f14] p-4 rounded-xl border border-[#d4af37]/20">
        <div className="flex items-center gap-3">
          <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Client:</label>
          <select 
            value={selectedClient} 
            onChange={(e) => setSelectedClient(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm rounded-lg focus:ring-[#d4af37] focus:border-[#d4af37] block w-64 p-2.5"
          >
            {clients.length === 0 ? (
              <option value="">No clients available</option>
            ) : (
              clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))
            )}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={clearData}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-bold rounded-lg transition-colors border border-red-500/20"
          >
            <Trash2 className="w-4 h-4" /> Clear Table
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37]/20 text-sm font-bold rounded-lg transition-colors border border-[#d4af37]/40 shadow-[0_0_15px_rgba(212,175,55,0.15)]"
          >
            <Save className="w-4 h-4" /> Save Adjustments
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
        <button
          onClick={() => setActiveTab('inkubasi')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'inkubasi' ? 'bg-[#0e0f14] text-[#d4af37] shadow-md border border-[#d4af37]/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Iklan Inkubasi
        </button>
        <button
          onClick={() => setActiveTab('group')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'group' ? 'bg-[#0e0f14] text-[#d4af37] shadow-md border border-[#d4af37]/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Users className="w-4 h-4" /> Iklan Group
        </button>
        <button
          onClick={() => setActiveTab('mandiri')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === 'mandiri' ? 'bg-[#0e0f14] text-[#d4af37] shadow-md border border-[#d4af37]/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Target className="w-4 h-4" /> Iklan Mandiri
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl overflow-hidden shadow-xl">
        {/* Paste Area Instructions */}
        <div 
          className="p-6 bg-zinc-900/30 border-b border-zinc-800/80 focus-within:bg-zinc-900/60 transition-colors"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl shrink-0">
              <ClipboardPaste className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-zinc-100 font-bold mb-1">Paste Spreadsheet Data Here</h3>
              <p className="text-zinc-400 text-xs mb-3">
                Select the cells in Google Sheets or Excel (up to the ROAS column), copy them (Ctrl+C), click into the box below, and paste (Ctrl+V).
              </p>
              <textarea 
                onPaste={handlePaste}
                placeholder="Click here and press Ctrl+V to paste your table data..."
                className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 focus:outline-none focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/50 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-zinc-950/50 text-xs uppercase text-zinc-400 border-b border-zinc-800">
              <tr>
                {activeTab === 'mandiri' ? (
                  <>
                    <th className="px-4 py-3 font-medium">Info Iklan</th>
                    <th className="px-4 py-3 font-medium">Modal Harian</th>
                    <th className="px-4 py-3 font-medium">Target ROAS</th>
                    <th className="px-4 py-3 font-medium">Diagnosis</th>
                    <th className="px-4 py-3 font-medium">Biaya Iklan</th>
                    <th className="px-4 py-3 font-medium">Penjualan</th>
                    <th className="px-4 py-3 font-medium">ROAS</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 font-medium">Iklan Produk</th>
                    <th className="px-4 py-3 font-medium">Biaya Iklan</th>
                    <th className="px-4 py-3 font-medium">Penjualan</th>
                    <th className="px-4 py-3 font-medium">Konversi</th>
                    <th className="px-4 py-3 font-medium">Produk Terjual</th>
                    <th className="px-4 py-3 font-medium">ROAS</th>
                  </>
                )}
                <th className="px-4 py-3 font-medium text-[#d4af37] bg-[#d4af37]/5">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {activeData.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'mandiri' ? 8 : 7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-zinc-500">
                      <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                      <p>No data yet. Paste from spreadsheet to populate this table.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                activeData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/40 transition-colors">
                    {activeTab === 'mandiri' ? (
                      <>
                        <td className="px-4 py-3 text-zinc-200">
                          <div className="w-48 truncate" title={row.infoIklan}>{row.infoIklan}</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{row.modalHarian}</td>
                        <td className="px-4 py-3 text-zinc-400">{row.targetRoas}</td>
                        <td className="px-4 py-3 text-zinc-400">{row.diagnosis}</td>
                        <td className="px-4 py-3 text-red-400">{row.biayaIklan}</td>
                        <td className="px-4 py-3 text-emerald-400">{row.penjualan}</td>
                        <td className="px-4 py-3 text-zinc-300 font-bold">{row.roas}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-zinc-200">
                          <div className="w-48 truncate" title={row.iklanProduk}>{row.iklanProduk}</div>
                        </td>
                        <td className="px-4 py-3 text-red-400">{row.biayaIklan}</td>
                        <td className="px-4 py-3 text-emerald-400">{row.penjualan}</td>
                        <td className="px-4 py-3 text-zinc-400">{row.konversi}</td>
                        <td className="px-4 py-3 text-zinc-400">{row.produkTerjual}</td>
                        <td className="px-4 py-3 text-zinc-300 font-bold">{row.roas}</td>
                      </>
                    )}
                    <td className="px-4 py-2 bg-[#d4af37]/5 min-w-[250px]">
                      <input 
                        type="text" 
                        value={row.recommendation}
                        onChange={(e) => handleRecommendationChange(idx, e.target.value)}
                        placeholder="Type recommendation..."
                        className="w-full bg-zinc-950 border border-zinc-700/50 rounded p-1.5 text-sm text-zinc-200 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] focus:outline-none placeholder-zinc-600"
                      />
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
