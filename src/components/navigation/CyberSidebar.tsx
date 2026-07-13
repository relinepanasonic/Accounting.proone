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
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: 'cyan' | 'amber';
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: <LayoutDashboard className="w-4 h-4" />,
  },
  {
    name: 'Income',
    href: '/invoices',
    icon: <ArrowDownLeft className="w-4 h-4 text-cyan-400" />,
    badge: 'Invoices',
    badgeColor: 'cyan',
  },
  {
    name: 'Expenses',
    href: '/expenses',
    icon: <ArrowUpRight className="w-4 h-4 text-amber-400" />,
    badge: 'A/P Bills',
    badgeColor: 'amber',
  },
  {
    name: 'Team Payroll',
    href: '/payroll',
    icon: <Users className="w-4 h-4 text-cyan-300" />,
    badge: 'Salaries',
    badgeColor: 'cyan',
  },
  {
    name: 'Assets',
    href: '/assets',
    icon: <Box className="w-4 h-4 text-amber-300" />,
    badge: 'Deprec.',
    badgeColor: 'amber',
  },
  {
    name: 'Activity Ledger',
    href: '/ledger',
    icon: <BookOpen className="w-4 h-4 text-cyan-400" />,
    badge: 'Live',
    badgeColor: 'cyan',
  },
  {
    name: 'Settings & Users',
    href: '/settings',
    icon: <Settings className="w-4 h-4 text-slate-400" />,
  },
];

export function CyberSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={`relative z-40 flex flex-col justify-between bg-[#0a0e16]/90 backdrop-blur-2xl border-r border-slate-800/80 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Brand Logo & Toggle */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-400 to-cyan-600 flex items-center justify-center font-black text-black text-xs shadow-[0_0_12px_rgba(34,211,238,0.5)]">
                AGY
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wider uppercase text-white">
                  NEW WAVE
                </span>
                <span className="text-[9px] font-mono text-cyan-400">
                  HUD TELEMETRY
                </span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="mx-auto w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-400 to-cyan-600 flex items-center justify-center font-black text-black text-xs shadow-[0_0_12px_rgba(34,211,238,0.5)]">
              AGY
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Workspace RBAC Tier Banner */}
        {!isCollapsed && (
          <div className="m-3 p-2.5 rounded-xl bg-slate-900/60 border border-cyan-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-mono uppercase text-slate-300">
                ROLE: SUPERADMIN
              </span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
          </div>
        )}

        {/* Navigation Menu Links */}
        <nav className="p-3 space-y-1.5 font-mono text-xs">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-transparent border-l-2 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="group-hover:scale-110 transition-transform">
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <span className="font-sans font-semibold tracking-wide">
                      {item.name}
                    </span>
                  )}
                </div>

                {!isCollapsed && item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-mono ${
                      item.badgeColor === 'cyan'
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
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

      {/* Footer System Node Indicator */}
      <div className="p-3 border-t border-slate-800/80">
        {!isCollapsed ? (
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>SYNC: SUPABASE EDGE</span>
            <span className="text-cyan-400">RLS ACTIVE</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
          </div>
        )}
      </div>
    </aside>
  );
}
