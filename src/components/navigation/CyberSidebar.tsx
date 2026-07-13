'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Box,
  BookOpen,
  Settings,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: <LayoutDashboard className="w-4 h-4" />,
  },
  {
    name: 'Invoices',
    href: '/invoices',
    icon: <ArrowDownLeft className="w-4 h-4" />,
    badge: 'Income',
  },
  {
    name: 'Expenses',
    href: '/expenses',
    icon: <ArrowUpRight className="w-4 h-4" />,
    badge: 'Bills',
  },
  {
    name: 'Team Payroll',
    href: '/payroll',
    icon: <Users className="w-4 h-4" />,
    badge: 'Salaries',
  },
  {
    name: 'Assets',
    href: '/assets',
    icon: <Box className="w-4 h-4" />,
    badge: 'Deprec.',
  },
  {
    name: 'Activity Ledger',
    href: '/ledger',
    icon: <BookOpen className="w-4 h-4" />,
    badge: 'Live',
  },
  {
    name: 'Bank Reconcile',
    href: '/reconcile',
    icon: <CheckSquare className="w-4 h-4" />,
    badge: 'Match',
  },
  {
    name: 'Settings & Users',
    href: '/settings',
    icon: <Settings className="w-4 h-4" />,
  },
];

export function CyberSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={`relative z-40 flex flex-col justify-between bg-[#0e0f14]/95 backdrop-blur-2xl border-r border-[#d4af37]/20 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Brand Logo & Toggle */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#d4af37]/20">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#f5d77f] via-[#d4af37] to-[#997319] flex items-center justify-center font-black text-black text-xs shadow-[0_0_15px_rgba(212,175,55,0.4)]">
                PRO
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider uppercase text-white">
                  ACCT.PROONE
                </span>
                <span className="text-[9px] font-mono text-[#d4af37]">
                  LUXURY GOLD SUITE
                </span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="mx-auto w-7 h-7 rounded-lg bg-gradient-to-tr from-[#f5d77f] via-[#d4af37] to-[#997319] flex items-center justify-center font-black text-black text-xs shadow-[0_0_15px_rgba(212,175,55,0.4)]">
              PRO
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg text-zinc-400 hover:text-[#f5d77f] hover:bg-[#d4af37]/10 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Menu Links */}
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#d4af37]/20 to-[#d4af37]/5 text-[#f5d77f] border border-[#d4af37]/40 shadow-[0_0_20px_rgba(212,175,55,0.12)]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`transition-colors ${
                      isActive
                        ? 'text-[#f5d77f]'
                        : 'text-zinc-500 group-hover:text-[#d4af37]'
                    }`}
                  >
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <span className="font-sans tracking-wide">
                      {item.name}
                    </span>
                  )}
                </div>

                {!isCollapsed && item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase ${
                      isActive
                        ? 'bg-[#d4af37]/25 text-[#f5d77f] border border-[#d4af37]/50'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Security Telemetry Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-[#d4af37]/20 bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37]">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-zinc-300">
                RLS SECURITY VAULT
              </span>
              <span className="text-[9px] font-mono text-[#d4af37]">
                ZERO JARGON ENFORCED
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
