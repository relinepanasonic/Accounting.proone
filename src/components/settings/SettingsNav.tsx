'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Users, ShieldAlert } from 'lucide-react';

export function SettingsNav() {
  const pathname = usePathname();

  const tabs = [
    {
      label: 'WORKSPACES',
      href: '/settings/workspaces',
      icon: Building2,
      description: 'Enterprise tenants, identity & tax profiles',
    },
    {
      label: 'CLIENTS CRM',
      href: '/settings/clients',
      icon: Users,
      description: 'Payees, contacts & billing profiles',
    },
    {
      label: 'TEAM & RBAC CLEARANCE',
      href: '/settings/team',
      icon: ShieldAlert,
      description: 'Superadmin, Accounting & Admin role matrix',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2.5 pb-4 border-b border-[#d4af37]/20">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              isActive
                ? 'bg-[#d4af37]/20 border border-[#d4af37] text-[#f5d77f] shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                : 'gold-glass-panel text-zinc-400 hover:text-white border-transparent hover:border-[#d4af37]/40'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-[#f5d77f]' : 'text-[#d4af37]'}`} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
