'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle, Clock, Plus, Receipt } from 'lucide-react';
import { compressImage } from '@/lib/utils/image';
import { getReimbursements, submitReimbursement } from '@/app/actions/sales-ext';
import { formatCurrency } from '@/lib/utils/currency';

export default function SalesReimbursementPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Base64 states for form
  const [receiptPhoto, setReceiptPhoto] = useState<string>('');
  const [clientPhoto, setClientPhoto] = useState<string>('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = () => {
    setLoading(true);
    getReimbursements().then(data => {
      setLogs(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const base64 = await compressImage(e.target.files[0], 800);
      setter(base64);
    } catch (err: any) {
      alert("Failed to process image: " + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!receiptPhoto || !clientPhoto) {
      alert("Please provide both Receipt Photo and Photo with Client.");
      return;
    }
    
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set('receipt_photo', receiptPhoto);
    formData.set('client_photo', clientPhoto);

    try {
      await submitReimbursement(formData);
      setIsModalOpen(false);
      setReceiptPhoto('');
      setClientPhoto('');
      fetchLogs();
    } catch (err: any) {
      alert("Failed to submit reimbursement: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Reimbursements</h1>
          <p className="text-sm text-zinc-400 mt-1">Submit claims for client visits and expenses.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-[#d4af37] to-[#f5d77f] text-black px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Reimburse
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full p-8 text-center text-zinc-500 bg-[#0e0f14] rounded-xl border border-zinc-800">
            Loading reimbursements...
          </div>
        ) : logs.length === 0 ? (
          <div className="col-span-full p-8 text-center text-zinc-500 bg-[#0e0f14] rounded-xl border border-zinc-800">
            No reimbursement records found.
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="bg-[#0e0f14] border border-[#d4af37]/20 p-5 rounded-2xl shadow-lg relative">
              <div className={`absolute top-0 right-0 text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider ${
                log.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' :
                log.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                'bg-amber-500/20 text-amber-400'
              }`}>
                {log.status || 'PENDING'}
              </div>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#d4af37]">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-100 text-sm">{log.resto_name || 'Expense'}</h3>
                  <p className="text-xs text-zinc-500">{new Date(log.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Client:</span>
                  <span className="font-medium text-zinc-300">{log.client_name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Brand:</span>
                  <span className="font-medium text-zinc-300">{log.brand || '-'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 flex justify-between items-end">
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded border border-zinc-700 overflow-hidden relative group">
                    <img src={log.receipt_photo} alt="Nota" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                  </div>
                  <div className="w-8 h-8 rounded border border-zinc-700 overflow-hidden relative group">
                    <img src={log.client_photo} alt="Client" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Total</div>
                  <div className="text-[#d4af37] font-semibold text-sm">
                    {formatCurrency(log.total_amount)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0e0f14] border border-[#d4af37]/20 rounded-xl w-full max-w-lg my-8 shadow-2xl relative">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10 flex justify-between items-center">
              <h2 className="text-lg font-bold text-zinc-100 font-serif">Submit Reimbursement</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Nama Client</label>
                  <input type="text" name="client_name" required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-[#d4af37]/50 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Brand</label>
                  <input type="text" name="brand" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-[#d4af37]/50 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Toko Shopee</label>
                  <input type="text" name="shopee_store" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-[#d4af37]/50 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">No Telp</label>
                  <input type="text" name="phone" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-[#d4af37]/50 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Nama Resto / Cafe</label>
                <input type="text" name="resto_name" required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-[#d4af37]/50 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Total Nota (Rp)</label>
                <input type="number" name="total_amount" required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-[#d4af37]/50 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Note</label>
                <textarea name="notes" rows={2} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:border-[#d4af37]/50 focus:outline-none"></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Foto Nota</label>
                  <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, setReceiptPhoto)} className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300 w-full" />
                  {receiptPhoto && <div className="mt-2 text-[10px] text-emerald-400 flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Attached</div>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Foto dengan Client</label>
                  <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, setClientPhoto)} className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300 w-full" />
                  {clientPhoto && <div className="mt-2 text-[10px] text-emerald-400 flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Attached</div>}
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" disabled={submitting} className="w-full bg-[#d4af37] text-black font-bold py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {submitting ? 'Submitting...' : 'Submit Reimbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
