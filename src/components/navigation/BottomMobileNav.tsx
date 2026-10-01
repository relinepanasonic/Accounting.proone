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
  Bot,
  TrendingUp,
  Share2,
} from 'lucide-react';
import {
  isAccountingPath,
  isHrdPath,
  isPabrikPath,
  isProductivityPath,
  isOptimizingPath,
} from '@/components/navigation/nav-config';

const MOBILE_NAV_ITEMS = [
  { name: 'AI Office', href: '/ai-office', icon: <Bot className="w-5 h-5" />, isActive: (p: string) => p.startsWith('/ai-office') },
  { name: 'Accounting', href: '/', icon: <LayoutDashboard className="w-5 h-5" />, isActive: isAccountingPath },
  // Optimizing = Admin + Sales + Advertiser; the other two are one tap away in the bar under the page title.
  { name: 'Optimizing', href: '/sales', icon: <TrendingUp className="w-5 h-5" />, isActive: isOptimizingPath },
  { name: 'Pabrik', href: '/productivity/pabrik-sosmed', icon: <Share2 className="w-5 h-5" />, isActive: isPabrikPath },
  { name: 'Productivity', href: '/productivity', icon: <CheckSquare className="w-5 h-5" />, isActive: isProductivityPath },
  { name: 'HRD', href: '/payroll', icon: <Users className="w-5 h-5" />, isActive: isHrdPath },
  { name: 'System', href: '/settings', icon: <Settings className="w-5 h-5" />, isActive: (p: string) => p.startsWith('/settings') },
];

export function BottomMobileNav({ limited = false, role }: { limited?: boolean; role?: string }) {
  const pathname = usePathname();
  const navItems = limited
    ? role === 'advertiser'
      ? [{ name: 'Advertiser', href: '/productivity/advertiser', icon: <TrendingUp className="w-5 h-5" />, isActive: isOptimizingPath }]
      : [{ name: 'Pabrik Sosmed', href: '/productivity/pabrik-sosmed', icon: <Share2 className="w-5 h-5" />, isActive: isPabrikPath }]
    : MOBILE_NAV_ITEMS;

  return (
    <nav className="print:hidden lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0e0f14]/95 backdrop-blur-2xl border-t border-[#d4af37]/25 px-2 py-1.5 flex items-center justify-around shadow-[0_-10px_30px_rgba(0,0,0,0.85)]">
      {navItems.map((item) => {
        const isActive = item.isActive(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1.5 px-1.5 rounded-xl min-h-[46px] min-w-0 transition-all duration-200 ${
              isActive
                ? 'text-[#f5d77f] bg-[#d4af37]/15 scale-105 border border-[#d4af37]/40 shadow-[0_0_15px_rgba(212,175,55,0.25)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {item.icon}
            <span className="text-[9px] font-mono font-bold mt-1 tracking-tight">
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
