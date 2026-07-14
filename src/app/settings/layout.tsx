import React from 'react';
import Link from 'next/link';
import { Settings, ArrowLeft } from 'lucide-react';
import { SettingsNav } from '@/components/settings/SettingsNav';

export const dynamic = 'force-dynamic';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#d4af37]/20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-[#d4af37]/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2.5">
              <Settings className="w-5 h-5 text-[#d4af37]" />
              <span>SYSTEM SETTINGS MODULE • EXECUTIVE CONFIGURATION COMMAND</span>
            </h1>
            <p className="text-xs text-[#d4af37] font-mono">
              WORKSPACE IDENTITY • PRODUCT CATALOG • CLIENT CRM • TEAM RBAC CLEARANCE
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Tab Navigation */}
      <SettingsNav />

      {/* Sub-page content */}
      <div className="pt-2">{children}</div>
    </div>
  );
}
