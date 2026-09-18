'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle } from 'lucide-react';
import { compressImage } from '@/lib/utils/image';
import { getMonthlyAbsensi, submitCheckIn, submitCheckOut } from '@/app/actions/sales-ext';

export default function SalesAbsensiPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use ref for actionType to ensure it is immediately available across closures
  const actionTypeRef = useRef<'checkin' | 'checkout' | null>(null);
  const [uiActionType, setUiActionType] = useState<'checkin' | 'checkout' | null>(null);

  useEffect(() => {
    setLoading(true);
    getMonthlyAbsensi(month).then(data => {
      setLogs(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [month]);

  const today = new Date().toISOString().split('T')[0];
  const todayLog = logs.find(l => l.date === today);

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const action = actionTypeRef.current;
    if (!e.target.files || e.target.files.length === 0 || !action) {
      // User cancelled camera or action not set
      actionTypeRef.current = null;
      setUiActionType(null);
      return;
    }
    
    setSubmitting(true);
    
    try {
      const file = e.target.files[0];
      const base64 = await compressImage(file, 600);
      
      let res;
      if (action === 'checkin') {
        res = await submitCheckIn(base64);
      } else {
        res = await submitCheckOut(base64);
      }
      
      if (res && res.error) {
        alert("System Error: " + res.error + "\n\n(Did you run the SQL script in Supabase?)");
      } else {
        // Refresh logs immediately
        const newLogs = await getMonthlyAbsensi(month);
        setLogs(newLogs);
      }
    } catch (err: any) {
      alert("Application Error: " + err.message);
    } finally {
      setSubmitting(false);
      actionTypeRef.current = null;
      setUiActionType(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerCamera = (type: 'checkin' | 'checkout') => {
    actionTypeRef.current = type;
    setUiActionType(type);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="p-4 lg:p-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Absensi Sales</h1>
          <p className="text-sm text-zinc-400 mt-1">Live camera check-in and check-out tracking.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-zinc-400">Month:</label>
          <input 
            type="month" 
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-[#0e0f14] border border-[#d4af37]/30 text-zinc-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#d4af37] [color-scheme:dark]"
          />
        </div>
      </div>

      <input 
        type="file" 
        accept="image/*" 
        capture="user" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleCameraCapture}
      />

      <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-2xl p-6 mb-8 shadow-xl flex flex-col md:flex-row items-center justify-center gap-6">
        <button 
          onClick={() => triggerCamera('checkin')}
          disabled={submitting || !!todayLog?.check_in_time}
          className="flex-1 w-full flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all disabled:opacity-50 disabled:cursor-not-allowed
            border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400"
        >
          {todayLog?.check_in_time ? (
            <CheckCircle className="w-12 h-12 mb-3" />
          ) : (
            <Camera className="w-12 h-12 mb-3" />
          )}
          <span className="font-bold text-lg">{submitting && uiActionType === 'checkin' ? 'Saving...' : todayLog?.check_in_time ? 'Checked In' : 'Check In'}</span>
          <span className="text-xs mt-1 opacity-70">
            {todayLog?.check_in_time ? new Date(todayLog.check_in_time).toLocaleTimeString() : 'Requires Camera'}
          </span>
        </button>

        <button 
          onClick={() => triggerCamera('checkout')}
          disabled={submitting || !todayLog?.check_in_time || !!todayLog?.check_out_time}
          className="flex-1 w-full flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all disabled:opacity-50 disabled:cursor-not-allowed
            border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400"
        >
          {todayLog?.check_out_time ? (
            <CheckCircle className="w-12 h-12 mb-3" />
          ) : (
            <Camera className="w-12 h-12 mb-3" />
          )}
          <span className="font-bold text-lg">{submitting && uiActionType === 'checkout' ? 'Saving...' : todayLog?.check_out_time ? 'Checked Out' : 'Check Out'}</span>
          <span className="text-xs mt-1 opacity-70">
            {todayLog?.check_out_time ? new Date(todayLog.check_out_time).toLocaleTimeString() : 'Requires Camera'}
          </span>
        </button>
      </div>

      <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading attendance logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">No attendance logs found for this month.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-900/50 text-xs uppercase text-zinc-400 border-b border-[#d4af37]/10">
              <tr>
                <th className="px-6 py-4 font-bold tracking-wider">Date</th>
                <th className="px-6 py-4 font-bold tracking-wider text-center">Check In</th>
                <th className="px-6 py-4 font-bold tracking-wider text-center">Check Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {logs.map((log, idx) => (
                <tr key={idx} className="hover:bg-zinc-900/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-zinc-100">
                    {new Date(log.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center">
                      <div className="text-emerald-400 font-mono font-bold">
                        {log.check_in_time ? new Date(log.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </div>
                      {log.check_in_photo && (
                        <img src={log.check_in_photo} alt="Check in" className="w-10 h-10 object-cover rounded mt-2 border border-emerald-500/20" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center">
                      <div className="text-amber-400 font-mono font-bold">
                        {log.check_out_time ? new Date(log.check_out_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </div>
                      {log.check_out_photo && (
                        <img src={log.check_out_photo} alt="Check out" className="w-10 h-10 object-cover rounded mt-2 border border-amber-500/20" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
