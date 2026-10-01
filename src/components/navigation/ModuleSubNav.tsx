'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isOptimizingPath, isPabrikPath, OPTIMIZING_CHILDREN } from '@/components/navigation/nav-config';

const MODULES = {
  accounting: {
    match: ['/', '/invoices', '/expenses', '/assets', '/ledger', '/reconcile'],
    items: [
      { name: 'Dashboard', href: '/' },
      { name: 'Income', href: '/invoices' },
      { name: 'Tax / Pajak', href: '/invoices/tax' },
      { name: 'Expenses', href: '/expenses' },
      { name: 'Assets', href: '/assets' },
      { name: 'Activity Ledger', href: '/ledger' },
      { name: 'Bank Reconcile', href: '/reconcile' },
    ]
  },
  sales: {
    match: ['/sales'],
    items: [
      { name: 'Dashboard', href: '/sales' },
      { name: 'Absensi', href: '/sales/absensi' },
      { name: 'To-Do', href: '/sales/todo' },
      { name: 'Leads Database', href: '/sales/leads' },
      { name: 'Pipeline', href: '/sales/pipeline' },
      { name: 'Client', href: '/sales/clients' },
      { name: 'A/R', href: '/sales/ar' },
      { name: 'Reimbursement', href: '/sales/reimbursement' },
    ]
  },
  productivity: {
    match: ['/productivity'],
    items: [
      { name: 'Dashboard', href: '/productivity' },
      { name: 'Assignments', href: '/productivity/assignments' },
    ]
  },
  hrd: {
    match: ['/payroll', '/hrd'],
    items: [
      { name: 'Team Payroll', href: '/payroll' },
      { name: 'Employee Directory', href: '/hrd/employees' },
    ]
  },
  system: {
    match: ['/settings'],
    items: [
      { name: 'Settings Hub', href: '/settings' },
      { name: 'Team & Roles', href: '/settings/team' },
      { name: 'Workspaces', href: '/settings/workspaces' },
      { name: 'COA Mapping', href: '/settings/coa' },
      { name: 'Product Catalog', href: '/settings/catalog' },
      { name: 'Contacts DB', href: '/settings/contacts' },
    ]
  }
};

export function ModuleSubNav() {
  const pathname = usePathname();
  
  // Pabrik Sosmed has its own Dashboard / Upload tabs inside the page.
  if (isPabrikPath(pathname)) return null;

  // Admin and Advertiser have no tab bar of their own. On desktop the sidebar group is enough;
  // on phones this row lets you hop between the three Optimizing pages.
  const optimizingSwitcher = isOptimizingPath(pathname) ? (
    <div className="lg:hidden w-full bg-[#0e0f14]/90 border-b border-[#d4af37]/20 px-4 py-2 flex items-center gap-2 overflow-x-auto">
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 shrink-0">Optimizing</span>
      {OPTIMIZING_CHILDREN.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full border ${
            c.isActive(pathname) ? 'bg-[#d4af37]/20 text-[#f5d77f] border-[#d4af37]/40' : 'text-zinc-400 border-zinc-800'
          }`}
        >
          {c.name}
        </Link>
      ))}
    </div>
  ) : null;

  if (pathname.startsWith('/productivity/admin') || pathname.startsWith('/productivity/advertiser')) return optimizingSwitcher;

  let activeModuleKey = 'accounting'; // default fallback
  
  if (pathname.startsWith('/sales')) activeModuleKey = 'sales';
  else if (pathname.startsWith('/productivity')) activeModuleKey = 'productivity';
  else if (pathname.startsWith('/payroll') || pathname.startsWith('/hrd')) activeModuleKey = 'hrd';
  else if (pathname.startsWith('/settings')) activeModuleKey = 'system';
  
  const activeModule = MODULES[activeModuleKey as keyof typeof MODULES];

  return (
    <>
    {optimizingSwitcher}
    <div className="w-full bg-[#0e0f14]/90 backdrop-blur-md border-b border-[#d4af37]/20 px-6 py-3 flex items-center gap-6 overflow-x-auto scrollbar-hide sticky top-0 z-30">
      {activeModule.items.map(item => {
        let isActive = false;
        if (item.href === '/' || item.href === '/sales') {
          isActive = pathname === item.href;
        } else {
          isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        }
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap text-xs font-semibold tracking-wide px-3 py-1.5 rounded-md transition-all ${
              isActive 
                ? 'bg-[#d4af37]/20 text-[#f5d77f] border border-[#d4af37]/30 shadow-[0_0_10px_rgba(212,175,55,0.1)]'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
            }`}
          >
            {item.name}
          </Link>
        );
      })}
    </div>
    </>
  );
}
