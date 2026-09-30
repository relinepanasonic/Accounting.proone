'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, UploadCloud } from 'lucide-react';

export function PabrikSosmedTabs() {
  const pathname = usePathname();
  const isDashboard = pathname.includes('/dashboard');
  const isUpload = pathname.includes('/upload');

  return (
    <div className="flex gap-2 border-b border-zinc-800 pb-px overflow-x-auto scrollbar-none">
      <Link 
        href="/productivity/pabrik-sosmed/dashboard"
        className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${isDashboard ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'}`}
      >
        <LayoutDashboard className="w-4 h-4" />
        Dashboard
      </Link>
      <Link 
        href="/productivity/pabrik-sosmed/upload"
        className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${isUpload ? 'border-[#d4af37] text-[#d4af37]' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'}`}
      >
        <UploadCloud className="w-4 h-4" />
        Upload
      </Link>
    </div>
  );
}
