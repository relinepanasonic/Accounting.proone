'use client';

import React, { useState, useTransition } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Eye, Trash2, X, Loader2 } from 'lucide-react';
import { uploadTaxDocument, deleteTaxDocument } from '@/app/actions/invoices';

interface TaxInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string | null;
  clientName: string;
  amount: number;
  faktur_pajak_url: string | null;
  bukti_potong_url: string | null;
}

export function TaxDocumentManager({ invoices }: { invoices: TaxInvoice[] }) {
  const [uploadModal, setUploadModal] = useState<{ isOpen: boolean; invoiceId: string; docType: 'faktur_pajak' | 'bukti_potong' } | null>(null);
  const [viewModal, setViewModal] = useState<{ isOpen: boolean; url: string; title: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleUploadClick = (invoiceId: string, docType: 'faktur_pajak' | 'bukti_potong') => {
    setUploadModal({ isOpen: true, invoiceId, docType });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadModal) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;
      
      startTransition(async () => {
        const res = await uploadTaxDocument(uploadModal.invoiceId, uploadModal.docType, result);
        if (res.success) {
          setUploadModal(null);
        } else {
          alert('Upload failed: ' + res.error);
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = (invoiceId: string, docType: 'faktur_pajak' | 'bukti_potong') => {
    if (!confirm(`Are you sure you want to delete this ${docType === 'faktur_pajak' ? 'Faktur Pajak' : 'Bukti Potong'}?`)) return;
    startTransition(async () => {
      const res = await deleteTaxDocument(invoiceId, docType);
      if (!res.success) {
        alert('Delete failed: ' + res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0e0f14]/80 backdrop-blur-md rounded-2xl border border-zinc-800/60 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-900/30 text-[10px] uppercase tracking-widest text-zinc-500 font-mono">
                <th className="py-4 px-6 font-medium">Invoice Info</th>
                <th className="py-4 px-6 font-medium">Client & Amount</th>
                <th className="py-4 px-6 font-medium text-center">Faktur Pajak (PPN)</th>
                <th className="py-4 px-6 font-medium text-center">Bukti Potong (PPH)</th>
                <th className="py-4 px-6 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {invoices.map((inv) => {
                const hasFaktur = !!inv.faktur_pajak_url;
                const hasBukti = !!inv.bukti_potong_url;
                const hasAny = hasFaktur || hasBukti;

                return (
                  <tr key={inv.id} className="hover:bg-zinc-900/40 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="text-sm font-bold text-zinc-100">{inv.invoiceNumber}</div>
                      <div className="text-[11px] text-zinc-500 font-mono mt-1">
                        {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString('en-GB') : 'No date'}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-zinc-300 font-medium">{inv.clientName}</div>
                      <div className="text-xs text-[#d4af37] font-mono mt-1">
                        Rp {inv.amount.toLocaleString('id-ID')}
                      </div>
                    </td>
                    
                    {/* Faktur Pajak Column */}
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center">
                        {hasFaktur ? (
                          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Attached</span>
                            <div className="flex items-center gap-1 ml-2 border-l border-emerald-500/20 pl-2">
                              <button onClick={() => setViewModal({ isOpen: true, url: inv.faktur_pajak_url!, title: `Faktur Pajak - ${inv.invoiceNumber}` })} className="hover:text-white transition-colors" title="View">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(inv.id, 'faktur_pajak')} className="hover:text-red-400 transition-colors" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleUploadClick(inv.id, 'faktur_pajak')}
                            className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white px-4 py-1.5 rounded-lg border border-zinc-700/50 transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Upload
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Bukti Potong Column */}
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center">
                        {hasBukti ? (
                          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Attached</span>
                            <div className="flex items-center gap-1 ml-2 border-l border-emerald-500/20 pl-2">
                              <button onClick={() => setViewModal({ isOpen: true, url: inv.bukti_potong_url!, title: `Bukti Potong - ${inv.invoiceNumber}` })} className="hover:text-white transition-colors" title="View">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(inv.id, 'bukti_potong')} className="hover:text-red-400 transition-colors" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleUploadClick(inv.id, 'bukti_potong')}
                            className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white px-4 py-1.5 rounded-lg border border-zinc-700/50 transition-all text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Upload
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Overall Status */}
                    <td className="py-4 px-6 text-center">
                      {hasAny ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Compliant
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Missing Docs
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500 text-sm">
                    No invoices found for this workspace.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {uploadModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0e0f14] border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
            <button
              onClick={() => setUploadModal(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white mb-1">
              Upload {uploadModal.docType === 'faktur_pajak' ? 'Faktur Pajak' : 'Bukti Potong'}
            </h3>
            <p className="text-xs text-zinc-500 mb-6">Supported formats: JPG, PNG, PDF</p>
            
            <div className="relative border-2 border-dashed border-zinc-800 hover:border-[#d4af37]/50 rounded-xl p-8 text-center transition-colors group">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                disabled={isPending}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex flex-col items-center gap-3">
                {isPending ? (
                  <Loader2 className="w-8 h-8 text-[#d4af37] animate-spin" />
                ) : (
                  <FileText className="w-8 h-8 text-zinc-600 group-hover:text-[#d4af37] transition-colors" />
                )}
                <div className="text-sm font-medium text-zinc-400">
                  {isPending ? 'Uploading...' : 'Click or drag file here'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="bg-[#0e0f14] border border-zinc-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-black/20">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {viewModal.title}
              </h3>
              <button
                onClick={() => setViewModal(null)}
                className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 bg-zinc-950 p-4 overflow-auto flex items-center justify-center">
              {viewModal.url.startsWith('data:application/pdf') ? (
                <iframe src={viewModal.url} className="w-full h-full rounded-lg" />
              ) : (
                <img src={viewModal.url} alt="Document View" className="max-w-full max-h-full object-contain rounded-lg" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
