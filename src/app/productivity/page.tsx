import React from 'react';
import Link from 'next/link';
import { Users, Shield, Megaphone, Smartphone } from 'lucide-react';

export default function ProductivityDashboardPage() {
  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-100 font-serif">Productivity & Staff Control</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage office divisions and track staff performance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/productivity/admin" className="group bg-[#0e0f14] border border-[#d4af37]/20 hover:border-[#d4af37]/60 p-6 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] flex flex-col items-center text-center">
          <div className="p-4 bg-[#d4af37]/10 rounded-full text-[#d4af37] mb-4 group-hover:scale-110 transition-transform">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100 mb-2">Admin Division</h2>
          <p className="text-xs text-zinc-400">Manage administrative staff, daily logs, and operational tasks.</p>
        </Link>

        <Link href="/productivity/advertiser" className="group bg-[#0e0f14] border border-[#d4af37]/20 hover:border-[#d4af37]/60 p-6 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] flex flex-col items-center text-center">
          <div className="p-4 bg-blue-500/10 rounded-full text-blue-400 mb-4 group-hover:scale-110 transition-transform">
            <Megaphone className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100 mb-2">Advertiser Division</h2>
          <p className="text-xs text-zinc-400">Track ad campaigns, media buying teams, and ROI metrics.</p>
        </Link>

        <Link href="/productivity/pabrik-sosmed" className="group bg-[#0e0f14] border border-[#d4af37]/20 hover:border-[#d4af37]/60 p-6 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)] flex flex-col items-center text-center">
          <div className="p-4 bg-emerald-500/10 rounded-full text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
            <Smartphone className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100 mb-2">Pabrik Sosmed</h2>
          <p className="text-xs text-zinc-400">Monitor content creators, social media engagement, and pipelines.</p>
        </Link>
      </div>
    </div>
  );
}
