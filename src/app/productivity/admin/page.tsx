import React from 'react';
import { Shield } from 'lucide-react';

export default function AdminDivisionPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] animate-in fade-in zoom-in-95 duration-300">
      <div className="p-6 bg-[#d4af37]/10 rounded-full text-[#d4af37] mb-6">
        <Shield className="w-12 h-12" />
      </div>
      <h1 className="text-3xl font-extrabold text-zinc-100 mb-3 font-serif">Admin Division</h1>
      <p className="text-sm text-zinc-400 max-w-md text-center">
        This sub-page is currently under construction. Future updates will include admin staff logs and operational tasks.
      </p>
    </div>
  );
}
