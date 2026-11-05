'use client';

import React, { useState, useEffect } from 'react';
import { ScreenshotThumbs } from './ScreenshotThumbs';
import { GMV_KEY, MANDIRI_KEY, MAX_SHOTS, compressImage, groupKey, parseShots, serializeShots, shotLabel, type Shots } from '@/lib/advertiser/screenshots';
import { ClipboardPaste, Save, Trash2, AlertCircle, TrendingUp, Users, Target, Loader2, Plus, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { isFilled, rowUsed, missingNumbers, snapshotOf, tabState } from '@/lib/advertiser/log-rules';
import { fetchAdvertiserReport, saveAdvertiserReport } from '@/app/actions/advertiser';

interface Client {
  id: string;
  name: string;
}

interface AdvertiserDashboardProps {
  clients: Client[];
  initialClient: string;
  /** The store of this log ("Company - Store"): a client can have several. */
  initialStore?: string;
  initialDate: string;
  initialSession: number;
  onBack: () => void;
}

type TabType = 'inkubasi' | 'group' | 'mandiri';
type GroupCategory = 'Hero' | 'Reguler' | 'Low';

/** The check of a tab: green = saved with its numbers, amber = something on it is not saved yet. */
function TabMark({ state }: { state: 'saved' | 'edited' | 'none' }) {
  if (state === 'saved') return <span title="Saved" className="inline-flex"><CheckCircle2 className="h-4 w-4 text-emerald-400" /></span>;
  if (state === 'edited') return <span title="Not saved yet" className="inline-block h-2 w-2 rounded-full bg-amber-400" />;
  return null;
}

export function AdvertiserDashboard({ clients, initialClient, initialStore = '', initialDate, initialSession, onBack }: AdvertiserDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('inkubasi');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Note for the session
  const [sessionNote, setSessionNote] = useState('');
  const [sisaSaldo, setSisaSaldo] = useState('');
  /** The log this one started from (new sessions begin with the ads of the session before). */
  const [copiedFrom, setCopiedFrom] = useState<{ date: string; session: number } | null>(null);

  // Data state per tab
  const [inkubasiData, setInkubasiData] = useState<any[]>([]);
  const [groupData, setGroupData] = useState<any[]>([]); // Flat array of all group rows
  const [mandiriData, setMandiriData] = useState<any[]>([]);
  const [shots, setShots] = useState<Shots>({});
  // What is saved of each tab (to show the green check), and whether a save was tried with empty Biaya Iklan / Penjualan (the empty cells turn red).
  const [saved, setSaved] = useState({ inkubasi: '', group: '', mandiri: '' });
  const [showErrors, setShowErrors] = useState(false);

  // Group Filter State
  const [activeGroupCategory, setActiveGroupCategory] = useState<GroupCategory>('Hero');
  const [activeGroupName, setActiveGroupName] = useState<string>('Group Hero 1');

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
    biayaIklan: '',
    penjualan: '',
    roas: '',
    note: ''
  });

  /** A new session starts from the session before: Nama Iklan / Iklan Produk (SKU), Modal Harian and Target ROAS stay; what happened (Biaya Iklan, Penjualan, Konversi, Terjual, ROAS, note) is empty. */
  const carryOver = (rows: any[]) => (Array.isArray(rows) ? rows : []).map((r) => ({ ...r, biayaIklan: '', penjualan: '', konversi: '', produkTerjual: '', roas: '', note: '' }));

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const res = await fetchAdvertiserReport(initialClient, initialDate, initialSession, initialStore);
      
      setCopiedFrom(res.data && res.isHistorical ? res.from : null);
      if (res.data) {
        const fresh = Boolean(res.isHistorical); // no log for this session yet: the last one is only the starting point
        setInkubasiData(fresh ? carryOver(res.data.data_inkubasi) : res.data.data_inkubasi || []);
        
        let rawGroup = res.data.data_group || [];
        if (!Array.isArray(rawGroup)) {
          // Migrate old nested format to flat format if necessary
          const flat: any[] = [];
          if (rawGroup.hero) rawGroup.hero.forEach((r: any) => flat.push({ ...r, groupCategory: 'Hero', groupName: 'Group Hero 1' }));
          if (rawGroup.reguler) rawGroup.reguler.forEach((r: any) => flat.push({ ...r, groupCategory: 'Reguler', groupName: 'Group Reguler 1' }));
          if (rawGroup.low) rawGroup.low.forEach((r: any) => flat.push({ ...r, groupCategory: 'Low', groupName: 'Group Low 1' }));
          rawGroup = flat;
        }
        setGroupData(fresh ? carryOver(rawGroup) : rawGroup);
        
        setMandiriData(fresh ? carryOver(res.data.data_mandiri) : res.data.data_mandiri || []);
        setSaved(fresh ? { inkubasi: '', group: '', mandiri: '' } : { inkubasi: snapshotOf(res.data.data_inkubasi || []), group: snapshotOf(rawGroup), mandiri: snapshotOf(res.data.data_mandiri || []) });
        // A historical fallback record (no exact report for this session yet) must not copy yesterday's pictures.
        setShots(res.isHistorical ? {} : parseShots(res.data.screenshot_url));
        setSessionNote(res.data.note || '');
        // A historical fallback record (no exact report for this session yet) must not copy yesterday's balance.
        setSisaSaldo(res.isHistorical ? '' : res.data.sisa_saldo_iklan || '');
      } else {
        setInkubasiData(Array(5).fill(null).map(() => getEmptyRowInkubasiGroup()));
        setGroupData(Array(5).fill(null).map(() => getEmptyRowInkubasiGroup('Hero', 'Group Hero 1')));
        setMandiriData(Array(5).fill(null).map(() => getEmptyRowMandiri()));
        setSaved({ inkubasi: '', group: '', mandiri: '' });
        setShots({});
        setSessionNote('');
        setSisaSaldo('');
      }
      setShowErrors(false);
      setIsLoading(false);
    }
    loadData();
  }, [initialClient, initialStore, initialDate, initialSession]);

  const handleSave = async () => {
    // Biaya Iklan and Penjualan must be filled on every row that is in use (a 0 is fine, an empty box is not).
    const missing = missingNumbers(inkubasiData, groupData, mandiriData);
    if (missing.length) {
      setShowErrors(true);
      const first = missing[0];
      setActiveTab(first.tab);
      if (first.tab === 'group' && first.groupCategory && first.groupName) { setActiveGroupCategory(first.groupCategory as GroupCategory); setActiveGroupName(first.groupName); }
      alert('Fill Biaya Iklan and Penjualan first (type 0 if there was none):\n\n' + missing.map((m) => `${m.label}\n` + m.where.slice(0, 8).map((w) => `   - ${w}`).join('\n') + (m.where.length > 8 ? `\n   - and ${m.where.length - 8} more` : '')).join('\n\n'));
      return;
    }
    setShowErrors(false);
    setIsSaving(true);
    const result = await saveAdvertiserReport(
      initialClient,
      initialDate,
      initialSession,
      inkubasiData,
      groupData,
      mandiriData,
      serializeShots(shots),
      sessionNote,
      sisaSaldo.trim() || null,
      initialStore
    );
    setIsSaving(false);
    if (!result.success) {
      alert('Could not save: ' + (result.error || 'unknown error'));
    } else if ('warning' in result && result.warning) {
      setSaved({ inkubasi: snapshotOf(inkubasiData), group: snapshotOf(groupData), mandiri: snapshotOf(mandiriData) });
      alert(result.warning);
    } else {
      setSaved({ inkubasi: snapshotOf(inkubasiData), group: snapshotOf(groupData), mandiri: snapshotOf(mandiriData) });
      alert('Adjustments saved successfully!');
    }
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

  // Which section a pasted picture belongs to: GMV Max Auto, the group being edited, or Iklan Mandiri.
  const shotKey = () => (activeTab === 'inkubasi' ? GMV_KEY : activeTab === 'group' ? groupKey(activeGroupCategory, activeGroupName) : MANDIRI_KEY);
  const removeShot = (key: string, index: number) =>
    setShots((prev) => {
      const next = (prev[key] || []).filter((_, i) => i !== index);
      const copy = { ...prev };
      if (next.length) copy[key] = next;
      else delete copy[key];
      return copy;
    });

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
        const key = shotKey();
        if ((shots[key]?.length || 0) >= MAX_SHOTS) {
          alert(`Up to ${MAX_SHOTS} screenshots per section. Remove one first.`);
          return;
        }
        compressImage(blob)
          .then((url) =>
            setShots((prev) => {
              const cur = prev[key] || [];
              return cur.length >= MAX_SHOTS ? prev : { ...prev, [key]: [...cur, url] };
            })
          )
          .catch(() => alert('Could not read that image.'));
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
      const kept = [...groupData].filter(r => rowUsed(r) || r.iklanProduk !== '' || r.note !== '');
      setGroupData([...kept, ...formatted]);
    } else if (activeTab === 'mandiri') {
      const formatted = parsedData.map((raw) => {
        // Info Iklan | Modal Harian | Target ROAS | Biaya Iklan | Penjualan | ROAS | Note.
        // An older sheet has a text column (Diagnosis) after the Target ROAS: it is dropped, so the numbers still land in the right boxes.
        const looksNumeric = (v?: string) => /^\s*(rp\.?)?[\d.,\s]+$/i.test(v || '');
        const cols = raw.length >= 8 || (raw[3] && !looksNumeric(raw[3])) ? [raw[0], raw[1], raw[2], ...raw.slice(4)] : raw;
        const modal = cols[1] || '';
        const biaya = cols[3] || '';
        const penj = cols[4] || '';
        return {
          infoIklan: cols[0] || '',
          modalHarian: formatCurrency(modal),
          targetRoas: cols[2] || '',
          biayaIklan: formatCurrency(biaya),
          penjualan: formatCurrency(penj),
          roas: calculateRoas(penj, biaya) || cols[5] || '',
          note: cols[6] || '',
        };
      });
      const currentData = [...mandiriData].filter(r => r.infoIklan !== '' || r.note !== '');
      setMandiriData([...currentData, ...formatted]);
    }
  };

  /** After a save was tried: an empty Biaya Iklan / Penjualan of a row in use gets a red bottom line. */
  const emptyCls = (row: any, field: string) => (showErrors && rowUsed(row) && !isFilled(row[field]) ? '!border-b-red-500 bg-red-500/10' : '');

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
      const absoluteIndex = index < groupData.length ? index : -1;
      
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
    else if (activeTab === 'group') setGroupData([]);
    else if (activeTab === 'mandiri') setMandiriData([]);
    setShots((prev) => {
      const copy = { ...prev };
      delete copy[shotKey()];
      return copy;
    });
  };

  const getActiveData = () => {
    if (activeTab === 'inkubasi') return inkubasiData;
    if (activeTab === 'group') return groupData;
    return mandiriData;
  };

  const activeData = getActiveData();
  
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
          {initialStore && <div className="text-[#d4af37] text-xs font-mono mb-0.5">{initialStore}</div>}
          <div className="text-zinc-500 text-sm flex gap-2">
            <span>{new Date(initialDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <span>&bull;</span>
            <span>Sesi {initialSession}</span>
          </div>
        </div>
      </div>

      {copiedFrom && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-200">
          Started from Sesi {copiedFrom.session} of {new Date(copiedFrom.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}: the ad names, SKU, Modal Harian and Target ROAS are copied in all three tabs. Biaya Iklan and Penjualan are empty for you to fill.
        </div>
      )}

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
        <div className="w-full md:w-72">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Sisa Saldo Iklan</label>
          <input
            type="text"
            inputMode="numeric"
            value={sisaSaldo}
            onChange={(e) => setSisaSaldo(formatCurrency(e.target.value))}
            placeholder="Rp 0"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-[#f5d77f] font-mono focus:outline-none focus:border-[#d4af37] transition-colors"
          />
        </div>
      </div>

      {/* Tabs: a green check when the tab is saved, an amber dot when something on it is not saved yet */}
      <div className="flex flex-wrap lg:flex-nowrap gap-1 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
        <button
          onClick={() => setActiveTab('inkubasi')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'inkubasi' ? 'bg-[#0e0f14] text-[#d4af37] shadow-md border border-[#d4af37]/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> GMV Max Auto<TabMark state={tabState(inkubasiData, saved.inkubasi)} />
        </button>
        <button
          onClick={() => setActiveTab('group')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'group' ? 'bg-[#0e0f14] text-[#d4af37] shadow-md border border-[#d4af37]/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Users className="w-4 h-4" /> Iklan Group<TabMark state={tabState(groupData, saved.group)} />
        </button>
        <button
          onClick={() => setActiveTab('mandiri')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'mandiri' ? 'bg-[#0e0f14] text-[#d4af37] shadow-md border border-[#d4af37]/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Target className="w-4 h-4" /> Mandiri<TabMark state={tabState(mandiriData, saved.mandiri)} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl overflow-hidden shadow-xl">
        
        {/* Sub-Filters for Group */}

        {/* Paste Area Instructions */}
        <div className="p-6 bg-zinc-900/30 border-b border-zinc-800/80 focus-within:bg-zinc-900/60 transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl shrink-0">
              <ClipboardPaste className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-zinc-100 font-bold mb-1">Paste Screenshot (SS) or Spreadsheet Here</h3>
              <p className="text-zinc-400 text-xs mb-3">
                Click into the box below and press Ctrl+V to paste your image screenshot OR text data from Excel. Up to 4 screenshots per section (GMV Max Auto, each group, Iklan Mandiri).
              </p>
              <textarea 
                onPaste={handlePaste}
                placeholder="Click here and press Ctrl+V to paste your screenshot or table data..."
                className="w-full h-16 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 focus:outline-none focus:border-[#d4af37]/50 focus:ring-1 focus:ring-[#d4af37]/50 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Screenshots of the section being edited (small, click to enlarge) */}
        {((shots[shotKey()]?.length || 0) > 0 || (shots.all?.length || 0) > 0) && (
          <div className="p-4 border-b border-zinc-800 bg-black/40 space-y-3">
            {(shots[shotKey()]?.length || 0) > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-[#d4af37] uppercase tracking-wider mb-2">
                  Screenshots · {shotLabel(shotKey())} ({shots[shotKey()].length}/{MAX_SHOTS})
                </h3>
                <ScreenshotThumbs images={shots[shotKey()]} onRemove={(i) => removeShot(shotKey(), i)} />
              </div>
            )}
            {(shots.all?.length || 0) > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Earlier screenshot of this session</h3>
                <ScreenshotThumbs images={shots.all} onRemove={(i) => removeShot('all', i)} />
              </div>
            )}
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
                    <th className="w-[340px] min-w-[340px] px-2 py-3 font-medium">Info Iklan</th>
                    <th className="px-2 py-3 font-medium min-w-[120px]">Modal Harian</th>
                    <th className="px-2 py-3 font-medium min-w-[120px]">Target ROAS</th>
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
                  <td colSpan={activeTab === 'mandiri' ? 7 : 9} className="px-4 py-12 text-center">
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
                          <input type="text" value={row.biayaIklan || ''} onChange={(e) => handleUpdateRow(idx, 'biayaIklan', e.target.value)} className={`w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-red-400 p-1.5 focus:outline-none transition-colors font-mono ${emptyCls(row, 'biayaIklan')}`} />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.penjualan || ''} onChange={(e) => handleUpdateRow(idx, 'penjualan', e.target.value)} className={`w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-emerald-400 p-1.5 focus:outline-none transition-colors font-mono ${emptyCls(row, 'penjualan')}`} />
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
                          <input type="text" value={row.biayaIklan || ''} onChange={(e) => handleUpdateRow(idx, 'biayaIklan', e.target.value)} className={`w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-red-400 p-1.5 focus:outline-none transition-colors font-mono ${emptyCls(row, 'biayaIklan')}`} />
                        </td>
                        <td className="px-1 py-1">
                          <input type="text" value={row.penjualan || ''} onChange={(e) => handleUpdateRow(idx, 'penjualan', e.target.value)} className={`w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#d4af37] text-emerald-400 p-1.5 focus:outline-none transition-colors font-mono ${emptyCls(row, 'penjualan')}`} />
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
            <div className="p-4 border-t border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-zinc-900/20">
              <button 
                onClick={addEmptyRow}
                className="w-full md:w-auto px-4 py-3 md:py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm md:text-xs font-bold rounded-lg transition-colors border border-zinc-600 inline-flex justify-center items-center gap-2"
              >
                + Add Row
              </button>
              
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
                <button 
                  onClick={clearData}
                  className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm md:text-xs font-bold rounded-xl transition-colors border border-red-500/20"
                >
                  <Trash2 className="w-4 h-4" /> Clear Current
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 md:py-2 bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37]/20 text-sm md:text-xs font-bold rounded-xl transition-colors border border-[#d4af37]/40 shadow-[0_0_15px_rgba(212,175,55,0.15)] disabled:opacity-50"
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
