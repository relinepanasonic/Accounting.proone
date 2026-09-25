'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardPaste, Save, Trash2, AlertCircle, TrendingUp, Users, Target, Loader2, Plus, ArrowLeft } from 'lucide-react';
import { fetchAdvertiserReport, saveAdvertiserReport } from '@/app/actions/advertiser';

interface Client {
  id: string;
  name: string;
}

interface AdvertiserDashboardProps {
  clients: Client[];
  initialClient: string;
  initialDate: string;
  initialSession: number;
  onBack: () => void;
}

type TabType = 'inkubasi' | 'group' | 'mandiri';
type GroupCategory = 'Hero' | 'Reguler' | 'Low';

export function AdvertiserDashboard({ clients, initialClient, initialDate, initialSession, onBack }: AdvertiserDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('inkubasi');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Note for the session
  const [sessionNote, setSessionNote] = useState('');

  // Data state per tab
  const [inkubasiData, setInkubasiData] = useState<any[]>([]);
  const [groupData, setGroupData] = useState<any[]>([]); // Flat array of all group rows
  const [mandiriData, setMandiriData] = useState<any[]>([]);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  // Group Filter State
  const [activeGroupCategory, setActiveGroupCategory] = useState<GroupCategory>('Hero');
  const [activeGroupName, setActiveGroupName] = useState<string>('Group Hero 1');
  const [newGroupName, setNewGroupName] = useState<string>('');

  const getEmptyRowInkubasiGroup = (category?: GroupCategory, name?: string) => ({
    groupCategory: category || null,
    groupName: name || null,
    iklanProduk: '',
    modalHarian: '',
    targetRoas: '',
    biayaIklan: '',
    penjualan: '',
    konversi: '',
    produkTerjual: '',
    roas: '',
    note: ''
  });

  const getEmptyRowMandiri = () => ({
    infoIklan: '',
    modalHarian: '',
    targetRoas: '',
    diagnosis: '',
    biayaIklan: '',
    penjualan: '',
    roas: '',
    note: ''
  });

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const res = await fetchAdvertiserReport(initialClient, initialDate, initialSession);
      
      if (res.data) {
        setInkubasiData(res.data.data_inkubasi || []);
        
        let rawGroup = res.data.data_group || [];
        if (!Array.isArray(rawGroup)) {
          // Migrate old nested format to flat format if necessary
          const flat = [];
          if (rawGroup.hero) rawGroup.hero.forEach((r: any) => flat.push({ ...r, groupCategory: 'Hero', groupName: 'Group Hero 1' }));
          if (rawGroup.reguler) rawGroup.reguler.forEach((r: any) => flat.push({ ...r, groupCategory: 'Reguler', groupName: 'Group Reguler 1' }));
          if (rawGroup.low) rawGroup.low.forEach((r: any) => flat.push({ ...r, groupCategory: 'Low', groupName: 'Group Low 1' }));
          rawGroup = flat;
        }
        setGroupData(rawGroup);
        
        setMandiriData(res.data.data_mandiri || []);
        setScreenshot(res.data.screenshot_url || null);
        setSessionNote(res.data.note || '');
      } else {
        setInkubasiData(Array(5).fill(null).map(() => getEmptyRowInkubasiGroup()));
        setGroupData(Array(5).fill(null).map(() => getEmptyRowInkubasiGroup('Hero', 'Group Hero 1')));
        setMandiriData(Array(5).fill(null).map(() => getEmptyRowMandiri()));
        setScreenshot(null);
        setSessionNote('');
      }
      setIsLoading(false);
    }
    loadData();
  }, [initialClient, initialDate, initialSession]);

  const handleSave = async () => {
    setIsSaving(true);
    await saveAdvertiserReport(
      initialClient, 
      initialDate, 
      initialSession, 
      inkubasiData, 
      groupData, 
      mandiriData, 
      screenshot,
      sessionNote
    );
    setIsSaving(false);
    alert('Adjustments saved successfully!');
  };

  const formatCurrency = (val: string) => {
    if (!val) return '';
    const numStr = val.toString().replace(/\D/g, '');
    if (!numStr) return '';
    return `Rp ${parseInt(numStr, 10).toLocaleString('en-US')}`;
  };

  const calculateRoas = (penjualan: string, biayaIklan: string) => {
    const p = parseFloat(penjualan?.replace(/\D/g, '') || '0');
    const b = parseFloat(biayaIklan?.replace(/\D/g, '') || '0');
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

    if (activeTab === 'inkubasi') {
      const formatted = parsedData.map(cols => {
        const modal = cols[1] || '';
        const biaya = cols[3] || '';
        const penj = cols[4] || '';
        return {
          iklanProduk: 'Iklan Produk Otomatis',
          modalHarian: formatCurrency(modal),
          targetRoas: 'Auto',
          biayaIklan: formatCurrency(biaya),
          penjualan: formatCurrency(penj),
          konversi: cols[5] || '',
          produkTerjual: cols[6] || '',
          roas: calculateRoas(penj, biaya) || cols[7] || '',
          note: cols[8] || '',
        };
      });
      const currentData = [...inkubasiData].filter(r => r.iklanProduk !== '' || r.note !== '');
      setInkubasiData([...currentData, ...formatted]);
    } else if (activeTab === 'group') {
      const formatted = parsedData.map(cols => {
        const modal = cols[1] || '';
        const biaya = cols[3] || '';
        const penj = cols[4] || '';
        return {
          groupCategory: activeGroupCategory,
          groupName: activeGroupName,
          iklanProduk: cols[0] || '',
          modalHarian: formatCurrency(modal),
          targetRoas: cols[2] || '',
          biayaIklan: formatCurrency(biaya),
          penjualan: formatCurrency(penj),
          konversi: cols[5] || '',
          produkTerjual: cols[6] || '',
          roas: calculateRoas(penj, biaya) || cols[7] || '',
          note: cols[8] || '',
        };
      });
      const otherGroupData = [...groupData].filter(r => r.groupCategory !== activeGroupCategory || r.groupName !== activeGroupName);
      const currentActiveGroupData = [...groupData].filter(r => r.groupCategory === activeGroupCategory && r.groupName === activeGroupName && (r.iklanProduk !== '' || r.note !== ''));
      setGroupData([...otherGroupData, ...currentActiveGroupData, ...formatted]);
    } else if (activeTab === 'mandiri') {
      const formatted = parsedData.map(cols => {
        const modal = cols[1] || '';
        const biaya = cols[4] || '';
        const penj = cols[5] || '';
        return {
          infoIklan: cols[0] || '',
          modalHarian: formatCurrency(modal),
          targetRoas: cols[2] || '',
          diagnosis: cols[3] || '',
          biayaIklan: formatCurrency(biaya),
          penjualan: formatCurrency(penj),
          roas: calculateRoas(penj, biaya) || cols[6] || '',
          note: cols[7] || '',
        };
      });
      const currentData = [...mandiriData].filter(r => r.infoIklan !== '' || r.note !== '');
      setMandiriData([...currentData, ...formatted]);
    }
  };

  const handleUpdateRow = (index: number, field: string, val: string) => {
    let formattedVal = val;
    if (field === 'modalHarian' || field === 'biayaIklan' || field === 'penjualan') {
      formattedVal = formatCurrency(val);
    }

    if (activeTab === 'inkubasi') {
      const newData = [...inkubasiData];
      newData[index] = { ...newData[index], [field]: formattedVal };
      if (field === 'penjualan' || field === 'biayaIklan') {
        newData[index].roas = calculateRoas(newData[index].penjualan, newData[index].biayaIklan);
      }
      setInkubasiData(newData);
    } else if (activeTab === 'group') {
      const activeGroupSubset = groupData.filter(r => r.groupCategory === activeGroupCategory && r.groupName === activeGroupName);
      const rowToUpdate = activeGroupSubset[index];
      const absoluteIndex = groupData.indexOf(rowToUpdate);
      
      if (absoluteIndex !== -1) {
        const newData = [...groupData];
        newData[absoluteIndex] = { ...newData[absoluteIndex], [field]: formattedVal };
        if (field === 'penjualan' || field === 'biayaIklan') {
          newData[absoluteIndex].roas = calculateRoas(newData[absoluteIndex].penjualan, newData[absoluteIndex].biayaIklan);
        }
        setGroupData(newData);
      }
    } else if (activeTab === 'mandiri') {
      const newData = [...mandiriData];
      newData[index] = { ...newData[index], [field]: formattedVal };
      if (field === 'penjualan' || field === 'biayaIklan') {
        newData[index].roas = calculateRoas(newData[index].penjualan, newData[index].biayaIklan);
      }
      setMandiriData(newData);
    }
  };

  const addEmptyRow = () => {
    if (activeTab === 'inkubasi') setInkubasiData(prev => [...prev, getEmptyRowInkubasiGroup()]);
    else if (activeTab === 'group') setGroupData(prev => [...prev, getEmptyRowInkubasiGroup(activeGroupCategory, activeGroupName)]);
    else if (activeTab === 'mandiri') setMandiriData(prev => [...prev, getEmptyRowMandiri()]);
  };

  const clearData = () => {
    if (activeTab === 'inkubasi') setInkubasiData([]);
    else if (activeTab === 'group') {
      // Only clear the active group
      setGroupData(prev => prev.filter(r => r.groupCategory !== activeGroupCategory || r.groupName !== activeGroupName));
    }
    else if (activeTab === 'mandiri') setMandiriData([]);
    setScreenshot(null);
  };

  const getActiveData = () => {
    if (activeTab === 'inkubasi') return inkubasiData;
    if (activeTab === 'group') return groupData.filter(r => r.groupCategory === activeGroupCategory && r.groupName === activeGroupName);
    return mandiriData;
  };

  const activeData = getActiveData();
  
  // Extract unique group names for the active category
  const existingGroupNames = Array.from(new Set(groupData.filter(r => r.groupCategory === activeGroupCategory).map(r => r.groupName)));
  if (!existingGroupNames.includes(activeGroupName)) {
    // If somehow active is not in list (e.g. they changed category), update it to the first available or default
    if (existingGroupNames.length > 0) {
      setTimeout(() => setActiveGroupName(existingGroupNames[0] as string), 0);
    }
  }

  const handleAddNewGroup = () => {
    if (newGroupName.trim() && !existingGroupNames.includes(newGroupName.trim())) {
      setActiveGroupName(newGroupName.trim());
      // Initialize with 3 empty rows
      setGroupData(prev => [...prev, getEmptyRowInkubasiGroup(activeGroupCategory, newGroupName.trim()), getEmptyRowInkubasiGroup(activeGroupCategory, newGroupName.trim()), getEmptyRowInkubasiGroup(activeGroupCategory, newGroupName.trim())]);
      setNewGroupName('');
    }
  };

  const handleDeleteGroup = () => {
    if (confirm(`Are you sure you want to delete ${activeGroupName}?`)) {
      setGroupData(prev => prev.filter(r => !(r.groupCategory === activeGroupCategory && r.groupName === activeGroupName)));
      const remainingNames = existingGroupNames.filter(name => name !== activeGroupName);
      if (remainingNames.length > 0) {
        setTimeout(() => setActiveGroupName(remainingNames[0] as string), 0);
      } else {
        setTimeout(() => setActiveGroupName(`Group ${activeGroupCategory} 1`), 0);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-zinc-900 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">
            {clients.find(c => c.id === initialClient)?.name}
          </h2>
          <div className="text-zinc-500 text-sm flex gap-2">
            <span>{new Date(initialDate).toLocaleDateString()}</span>
            <span>&bull;</span>
            <span>Sesi {initialSession}</span>
          </div>
        </div>
      </div>

      <div className="bg-[#0e0f14] p-4 rounded-xl border border-[#d4af37]/20 flex flex-col md:flex-row justify-between gap-4 items-center">
        <div className="flex-1 w-full relative">
          <input 
            type="text"
            value={sessionNote}
            onChange={(e) => setSessionNote(e.target.value)}
            placeholder="General session note (will appear in Advertiser Log)..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-[#d4af37] transition-colors"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap lg:flex-nowrap gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
        <button
          onClick={() => setActiveTab('inkubasi')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'inkubasi' ? 'bg-[#0e0f14] text-[#d4af37] shadow-md border border-[#d4af37]/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Inkubasi
        </button>
        <button
          onClick={() => setActiveTab('group')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'group' ? 'bg-[#0e0f14] text-[#d4af37] shadow-md border border-[#d4af37]/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Users className="w-4 h-4" /> Iklan Group
        </button>
        <button
          onClick={() => setActiveTab('mandiri')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'mandiri' ? 'bg-[#0e0f14] text-[#d4af37] shadow-md border border-[#d4af37]/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Target className="w-4 h-4" /> Mandiri
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl overflow-hidden shadow-xl">
        
        {/* Sub-Filters for Group */}
        {activeTab === 'group' && (
          <div className="p-4 bg-zinc-900/50 border-b border-zinc-800 flex flex-col md:flex-row gap-4 items-end">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Group Category</label>
              <select 
                value={activeGroupCategory}
                onChange={(e) => {
                  const newCat = e.target.value as GroupCategory;
                  setActiveGroupCategory(newCat);
                  const namesForNewCat = Array.from(new Set(groupData.filter(r => r.groupCategory === newCat).map(r => r.groupName)));
                  if (namesForNewCat.length > 0) setActiveGroupName(namesForNewCat[0] as string);
                  else setActiveGroupName(`Group ${newCat} 1`);
                }}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
              >
                <option value="Hero">Group Hero</option>
                <option value="Reguler">Group Reguler</option>
                <option value="Low">Group Low Konversi</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Group Name</label>
              <select 
                value={activeGroupName}
                onChange={(e) => setActiveGroupName(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37] min-w-[200px]"
              >
                {existingGroupNames.length === 0 && <option value={activeGroupName}>{activeGroupName}</option>}
                {existingGroupNames.map(name => (
                  <option key={name as string} value={name as string}>{name as string}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="New group name..." 
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
              />
              <button onClick={handleAddNewGroup} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2 rounded-lg transition-colors border border-zinc-700">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={handleDeleteGroup} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg transition-colors border border-red-500/20 ml-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

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
                    <th className="px-2 py-3 font-medium min-w-[200px]">Info Iklan</th>
                    <th className="px-2 py-3 font-medium min-w-[120px]">Modal Harian</th>
                    <th className="px-2 py-3 font-medium min-w-[120px]">Target ROAS</th>
                    <th className="px-2 py-3 font-medium min-w-[120px]">Diagnosis</th>
                    <th className="px-2 py-3 font-medium min-w-[120px]">Biaya Iklan</th>
                    <th className="px-2 py-3 font-medium min-w-[120px]">Penjualan</th>
                    <th className="px-2 py-3 font-medium min-w-[80px]">ROAS</th>
                  </>
                ) : (
                  <>
                    <th className="px-2 py-3 font-medium min-w-[200px]">Iklan Produk</th>
                    <th className="px-2 py-3 font-medium min-w-[120px]">Modal Harian</th>
                    <th className="px-2 py-3 font-medium min-w-[120px]">Target ROAS</th>
                    <th className="px-2 py-3 font-medium min-w-[120px]">Biaya Iklan</th>
                    <th className="px-2 py-3 font-medium min-w-[120px]">Penjualan</th>
                    <th className="px-2 py-3 font-medium min-w-[100px]">Konversi</th>
                    <th className="px-2 py-3 font-medium min-w-[100px]">Terjual</th>
                    <th className="px-2 py-3 font-medium min-w-[80px]">ROAS</th>
                  </>
                )}
                <th className="px-2 py-3 font-medium min-w-[250px] text-blue-300 bg-blue-500/5">Note (Manual)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {activeData.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'mandiri' ? 8 : 9} className="px-4 py-12 text-center">
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
                          {activeTab === 'inkubasi' ? (
                            <input type="text" value="Iklan Produk Otomatis" readOnly className="w-full bg-transparent border-b border-transparent text-zinc-500 p-1.5 focus:outline-none cursor-not-allowed" />
                          ) : (
                            <input type="text" value={row.iklanProduk || ''} onChange={(e) => handleUpdateRow(idx, 'iklanProduk', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-zinc-200 p-1.5 focus:outline-none transition-colors" />
                          )}
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.modalHarian || ''} onChange={(e) => handleUpdateRow(idx, 'modalHarian', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-zinc-400 p-1.5 focus:outline-none transition-colors" />
                        </td>
                        <td className="px-1 py-1">
                          {activeTab === 'inkubasi' ? (
                            <input type="text" value="Auto" readOnly className="w-full bg-transparent border-b border-transparent text-zinc-500 p-1.5 focus:outline-none cursor-not-allowed text-center font-mono" />
                          ) : (
                            <input type="text" value={row.targetRoas || ''} onChange={(e) => handleUpdateRow(idx, 'targetRoas', e.target.value)} className="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-zinc-400 p-1.5 focus:outline-none transition-colors" />
                          )}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {activeData.length > 0 && (
            <div className="p-4 border-t border-zinc-800 flex justify-between items-center bg-zinc-900/20">
              <button 
                onClick={addEmptyRow}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-lg transition-colors border border-zinc-600 inline-flex items-center gap-2"
              >
                + Add Row
              </button>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={clearData}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold rounded-xl transition-colors border border-red-500/20"
                >
                  <Trash2 className="w-4 h-4" /> Clear Current
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-2 px-6 py-2 bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37]/20 text-xs font-bold rounded-xl transition-colors border border-[#d4af37]/40 shadow-[0_0_15px_rgba(212,175,55,0.15)] disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                  SAVE RECORD
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
