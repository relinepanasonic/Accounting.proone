'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowUpRight,
  CheckSquare,
  Users,
  Settings,
} from 'lucide-react';

const MOBILE_NAV_ITEMS = [
  { name: 'Accounting', href: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
  { name: 'Sales', href: '/sales', icon: <ArrowUpRight className="w-5 h-5" /> },
  { name: 'Productivity', href: '/productivity', icon: <CheckSquare className="w-5 h-5" /> },
  { name: 'HRD', href: '/payroll', icon: <Users className="w-5 h-5" /> },
  { name: 'System', href: '/settings', icon: <Settings className="w-5 h-5" /> },
];

export function BottomMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="print:hidden lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0e0f14]/95 backdrop-blur-2xl border-t border-[#d4af37]/25 px-2 py-1.5 flex items-center justify-around shadow-[0_-10px_30px_rgba(0,0,0,0.85)]">
      {MOBILE_NAV_ITEMS.map((item) => {
        let isActive = false;
        if (item.name === 'Accounting') {
          isActive = ['/', '/invoices', '/expenses', '/assets', '/ledger', '/reconcile'].some(p => pathname === p || pathname.startsWith(p + '/'));
        } else if (item.name === 'HRD') {
          isActive = pathname.startsWith('/payroll') || pathname.startsWith('/hrd');
        } else {
          isActive = pathname.startsWith(item.href);
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl min-h-[46px] transition-all duration-200 ${
              isActive
                ? 'text-[#f5d77f] bg-[#d4af37]/15 scale-105 border border-[#d4af37]/40 shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {item.icon}
            <span className="text-[10px] font-mono font-bold mt-1 tracking-tight">
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
