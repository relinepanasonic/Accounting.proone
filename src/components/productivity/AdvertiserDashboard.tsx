'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardPaste, Save, Trash2, AlertCircle, TrendingUp, Users, Target, Calendar, Clock, Loader2, Sparkles } from 'lucide-react';
import { ClientSelect } from '@/components/ui/ClientSelect';
import { fetchAdvertiserReport, saveAdvertiserReport } from '@/app/actions/advertiser';

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
  
  // Date and Session state
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [session, setSession] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistorical, setIsHistorical] = useState(false);

  // Data state per tab
  const [inkubasiData, setInkubasiData] = useState<any[]>([]);
  const [groupData, setGroupData] = useState<any[]>([]);
  const [mandiriData, setMandiriData] = useState<any[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  const getEmptyRowInkubasi = () => ({ iklanProduk: '', biayaIklan: '', penjualan: '', konversi: '', produkTerjual: '', roas: '', note: '', recommendation: '' });
  const getEmptyRowMandiri = () => ({ infoIklan: '', modalHarian: '', targetRoas: '', diagnosis: '', biayaIklan: '', penjualan: '', roas: '', note: '', recommendation: '' });

  // Fetch data when client, date, or session changes
  useEffect(() => {
    if (!selectedClient) return;
    
    async function loadData() {
      setIsLoading(true);
      const res = await fetchAdvertiserReport(selectedClient, reportDate, session);
      
      if (res.data) {
        setInkubasiData(res.data.data_inkubasi || []);
        setGroupData(res.data.data_group || []);
        setMandiriData(res.data.data_mandiri || []);
        setScreenshot(res.data.screenshot_url || null);
        setIsHistorical(res.isHistorical);
      } else {
        // First time ever for this client: initialize with 5 empty rows
        setInkubasiData(Array(5).fill(null).map(getEmptyRowInkubasi));
        setGroupData(Array(5).fill(null).map(getEmptyRowInkubasi));
        setMandiriData(Array(5).fill(null).map(getEmptyRowMandiri));
        setScreenshot(null);
        setIsHistorical(false);
      }
      setIsLoading(false);
    }
    loadData();
  }, [selectedClient, reportDate, session]);

  const handleSave = async () => {
    if (!selectedClient) return;
    setIsSaving(true);
    await saveAdvertiserReport(
      selectedClient, 
      reportDate, 
      session, 
      inkubasiData, 
      groupData, 
      mandiriData, 
      screenshot
    );
    setIsSaving(false);
    setIsHistorical(false);
    alert('Adjustments saved successfully!');
  };

  const calculateRoas = (penjualan: string, biayaIklan: string) => {
    const p = parseFloat(penjualan?.replace(/,/g, '') || '0');
    const b = parseFloat(biayaIklan?.replace(/,/g, '') || '0');
    if (b > 0) {
      return (p / b).toFixed(2);
    }
    return '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();

    const items = e.clipboardData.items;
    let imageItem = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageItem = items[i];
        break;
      }
    }

    if (imageItem) {
      const blob = imageItem.getAsFile();
      if (blob) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setScreenshot(event.target?.result as string);
        };
        reader.readAsDataURL(blob);
      }
      return;
    }

    const clipboardData = e.clipboardData.getData('Text');
    if (!clipboardData) return;

    const rows = clipboardData.split(/\r?\n/).filter(row => row.trim() !== '');
    const parsedData = rows.map(row => row.split('\t'));

    if (activeTab === 'inkubasi' || activeTab === 'group') {
      const formatted = parsedData.map(cols => {
        const biaya = cols[1] || '';
        const penj = cols[2] || '';
        return {
          iklanProduk: cols[0] || '',
          biayaIklan: biaya,
          penjualan: penj,
          konversi: cols[3] || '',
          produkTerjual: cols[4] || '',
          roas: calculateRoas(penj, biaya) || cols[5] || '',
          note: cols[6] || '',
          recommendation: '',
        };
      });
      if (activeTab === 'inkubasi') {
        const currentData = [...inkubasiData].filter(r => r.iklanProduk !== '' || r.note !== '');
        setInkubasiData([...currentData, ...formatted]);
      } else {
        const currentData = [...groupData].filter(r => r.iklanProduk !== '' || r.note !== '');
        setGroupData([...currentData, ...formatted]);
      }
    } else if (activeTab === 'mandiri') {
      const formatted = parsedData.map(cols => {
        const biaya = cols[4] || '';
        const penj = cols[5] || '';
        return {
          infoIklan: cols[0] || '',
          modalHarian: cols[1] || '',
          targetRoas: cols[2] || '',
          diagnosis: cols[3] || '',
          biayaIklan: biaya,
          penjualan: penj,
          roas: calculateRoas(penj, biaya) || cols[6] || '',
          note: cols[7] || '',
          recommendation: '',
        };
      });
      const currentData = [...mandiriData].filter(r => r.infoIklan !== '' || r.note !== '');
      setMandiriData([...currentData, ...formatted]);
    }
  };

  const handleUpdateRow = (index: number, field: string, val: string) => {
    let newData: any[];
    if (activeTab === 'inkubasi') newData = [...inkubasiData];
    else if (activeTab === 'group') newData = [...groupData];
    else newData = [...mandiriData];

    newData[index] = { ...newData[index], [field]: val };

    // Auto-calculate ROAS
    if (field === 'penjualan' || field === 'biayaIklan') {
      newData[index].roas = calculateRoas(newData[index].penjualan, newData[index].biayaIklan);
    }

    if (activeTab === 'inkubasi') setInkubasiData(newData);
    else if (activeTab === 'group') setGroupData(newData);
    else setMandiriData(newData);
  };

  const addEmptyRow = () => {
    if (activeTab === 'inkubasi') {
      setInkubasiData(prev => [...prev, getEmptyRowInkubasi()]);
    } else if (activeTab === 'group') {
      setGroupData(prev => [...prev, getEmptyRowInkubasi()]);
    } else if (activeTab === 'mandiri') {
      setMandiriData(prev => [...prev, getEmptyRowMandiri()]);
    }
  };

  const clearData = () => {
    if (activeTab === 'inkubasi') setInkubasiData([]);
    else if (activeTab === 'group') setGroupData([]);
    else if (activeTab === 'mandiri') setMandiriData([]);
    setScreenshot(null);
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
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[#0e0f14] p-4 rounded-xl border border-[#d4af37]/20">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
          <div className="w-full md:w-80">
            <ClientSelect
              value={selectedClient}
              onChange={setSelectedClient}
              options={clients.map(c => ({ id: c.id, name: c.name }))}
            />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-40">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-zinc-500" />
              </div>
              <input 
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-colors"
              />
            </div>

            <div className="relative flex-1 md:w-32">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Clock className="h-4 w-4 text-zinc-500" />
              </div>
              <select
                value={session}
                onChange={(e) => setSession(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-3 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-colors appearance-none"
              >
                <option value={1}>Sesi 1</option>
                <option value={2}>Sesi 2</option>
                <option value={3}>Sesi 3</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={clearData}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-bold rounded-xl transition-colors border border-red-500/20"
          >
            <Trash2 className="w-4 h-4" /> Clear All
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37]/20 text-sm font-bold rounded-xl transition-colors border border-[#d4af37]/40 shadow-[0_0_15px_rgba(212,175,55,0.15)] disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
            Save Adjustments
          </button>
        </div>
      </div>

      {isHistorical && (
        <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm rounded-xl">
          <AlertCircle className="w-4 h-4" />
          <span>Showing the most recent saved data for this client as a starting point. Save when you're done to record it for this session.</span>
        </div>
      )}

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
        <div className="p-6 bg-zinc-900/30 border-b border-zinc-800/80 focus-within:bg-zinc-900/60 transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl shrink-0">
              <ClipboardPaste className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-zinc-100 font-bold mb-1">Paste Screenshot (SS) or Spreadsheet Here</h3>
              <p className="text-zinc-400 text-xs mb-3">
                Click into the box below and press Ctrl+V to paste your image screenshot OR text data from Excel.
              </p>
              <textarea 
                onPaste={handlePaste}
                placeholder="Click here and press Ctrl+V to paste your screenshot or table data..."
                className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 focus:outline-none focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/50 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Display Screenshot if any */}
        {screenshot && (
          <div className="p-4 border-b border-zinc-800 bg-black/40 flex flex-col items-center">
            <div className="flex w-full justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-[#d4af37] uppercase tracking-wider">Pasted Screenshot (SS)</h3>
              <button onClick={() => setScreenshot(null)} className="text-xs text-red-400 hover:text-red-300">Remove Image</button>
            </div>
            <img src={screenshot} alt="Pasted screenshot" className="max-w-full h-auto rounded-lg border border-zinc-700 shadow-lg object-contain max-h-[400px]" />
          </div>
        )}

        {/* Data Table */}
        <div className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-[#d4af37]/30 scrollbar-track-transparent">
          {isLoading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
            </div>
          )}
          <table className="w-full text-xs text-left whitespace-nowrap table-fixed">
            <thead className="bg-zinc-950/50 uppercase text-zinc-400 border-b border-zinc-800">
              <tr>
                {activeTab === 'mandiri' ? (
                  <>
                    <th className="px-2 py-3 font-medium w-32">Info Iklan</th>
                    <th className="px-2 py-3 font-medium w-24">Modal</th>
                    <th className="px-2 py-3 font-medium w-20">Target ROAS</th>
                    <th className="px-2 py-3 font-medium w-24">Diagnosis</th>
                    <th className="px-2 py-3 font-medium w-24">Biaya Iklan</th>
                    <th className="px-2 py-3 font-medium w-24">Penjualan</th>
                    <th className="px-2 py-3 font-medium w-16">ROAS</th>
                  </>
                ) : (
                  <>
                    <th className="px-2 py-3 font-medium w-36">Iklan Produk</th>
                    <th className="px-2 py-3 font-medium w-24">Biaya Iklan</th>
                    <th className="px-2 py-3 font-medium w-24">Penjualan</th>
                    <th className="px-2 py-3 font-medium w-16">Konversi</th>
                    <th className="px-2 py-3 font-medium w-16">Terjual</th>
                    <th className="px-2 py-3 font-medium w-16">ROAS</th>
                  </>
                )}
                <th className="px-2 py-3 font-medium w-40 text-blue-300 bg-blue-500/5">Note (Manual)</th>
                <th className="px-2 py-3 font-medium w-48 text-[#d4af37] bg-[#d4af37]/5 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {activeData.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'mandiri' ? 9 : 8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-zinc-500 mb-4">
                      <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                      <p>No data yet. Paste from spreadsheet, paste a screenshot above, or add a row manually.</p>
                    </div>
                    <button 
                      onClick={addEmptyRow}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-lg transition-colors border border-zinc-600 inline-flex items-center gap-2"
                    >
                      + Add Manual Row
                    </button>
                  </td>
                </tr>
              ) : (
                activeData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/40 transition-colors">
                    {activeTab === 'mandiri' ? (
                      <>
                        <td className="px-1 py-1">
                          <input type="text" value={row.infoIklan || ''} onChange={(e) => handleUpdateRow(idx, 'infoIklan', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-zinc-200 p-1.5 focus:outline-none transition-colors" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.modalHarian || ''} onChange={(e) => handleUpdateRow(idx, 'modalHarian', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-zinc-400 p-1.5 focus:outline-none transition-colors" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.targetRoas || ''} onChange={(e) => handleUpdateRow(idx, 'targetRoas', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-zinc-400 p-1.5 focus:outline-none transition-colors" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.diagnosis || ''} onChange={(e) => handleUpdateRow(idx, 'diagnosis', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-zinc-400 p-1.5 focus:outline-none transition-colors" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.biayaIklan || ''} onChange={(e) => handleUpdateRow(idx, 'biayaIklan', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-red-400 p-1.5 focus:outline-none transition-colors font-mono" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.penjualan || ''} onChange={(e) => handleUpdateRow(idx, 'penjualan', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-emerald-400 p-1.5 focus:outline-none transition-colors font-mono" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.roas || ''} readOnly className="w-full bg-zinc-900/50 border-b border-transparent text-[#d4af37] font-bold p-1.5 focus:outline-none cursor-default text-center font-mono rounded" />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-1 py-1">
                          <input type="text" value={row.iklanProduk || ''} onChange={(e) => handleUpdateRow(idx, 'iklanProduk', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-zinc-200 p-1.5 focus:outline-none transition-colors" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.biayaIklan || ''} onChange={(e) => handleUpdateRow(idx, 'biayaIklan', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-red-400 p-1.5 focus:outline-none transition-colors font-mono" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.penjualan || ''} onChange={(e) => handleUpdateRow(idx, 'penjualan', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-emerald-400 p-1.5 focus:outline-none transition-colors font-mono" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.konversi || ''} onChange={(e) => handleUpdateRow(idx, 'konversi', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-zinc-400 p-1.5 focus:outline-none transition-colors font-mono text-center" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.produkTerjual || ''} onChange={(e) => handleUpdateRow(idx, 'produkTerjual', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-zinc-400 p-1.5 focus:outline-none transition-colors font-mono text-center" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.roas || ''} readOnly className="w-full bg-zinc-900/50 border-b border-transparent text-[#d4af37] font-bold p-1.5 focus:outline-none cursor-default text-center font-mono rounded" />
                        </td>
                      </>
                    )}
                    <td className="px-2 py-1 bg-blue-500/5">
                      <input 
                        type="text" 
                        value={row.note || ''}
                        onChange={(e) => handleUpdateRow(idx, 'note', e.target.value)}
                        placeholder="Write a note..."
                        className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded p-1.5 text-zinc-300 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:outline-none placeholder-zinc-700 transition-all"
                      />
                    </td>
                    <td className="px-2 py-1 bg-[#d4af37]/5">
                      <input 
                        type="text" 
                        value={row.recommendation || ''}
                        readOnly
                        placeholder="Auto-generated later..."
                        className="w-full bg-black/60 border border-zinc-800/50 rounded p-1.5 text-zinc-500 focus:outline-none placeholder-zinc-700/50 cursor-not-allowed italic"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {activeData.length > 0 && (
            <div className="p-3 border-t border-zinc-800">
              <button 
                onClick={addEmptyRow}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-lg transition-colors border border-zinc-600 inline-flex items-center gap-2"
              >
                + Add Row
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
