'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import type { WorkspaceContextInfo } from '@/lib/auth/workspace-context';
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

interface CyberSidebarProps {
  workspaceContext?: WorkspaceContextInfo;
}

export function CyberSidebar({ workspaceContext }: CyberSidebarProps = {}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const activeId = workspaceContext?.activeWorkspaceId || '11111111-1111-1111-1111-111111111111';
  const activeName = workspaceContext?.activeWorkspaceName || 'Professor Toko Online HQ';
  const activeRole = workspaceContext?.role || 'superadmin';
  const availableWorkspaces = workspaceContext?.availableWorkspaces || [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Professor Toko Online HQ',
      role: 'superadmin',
    },
    {
      id: '11111111-1111-1111-1111-111111111112',
      name: 'Nüman Kitchenware Enterprise',
      role: 'accounting',
    },
    {
      id: '11111111-1111-1111-1111-111111111113',
      name: 'Bochtmon Studio Venture',
      role: 'superadmin',
    },
  ];

  return (
    <aside
      className={`relative z-40 hidden lg:flex flex-col justify-between bg-[#0e0f14]/95 backdrop-blur-2xl border-r border-[#d4af37]/20 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Brand Logo & Toggle */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#d4af37]/20">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo (8).png"
                alt="Professor Toko Logo"
                width={30}
                height={30}
                className="rounded-lg object-contain drop-shadow-[0_0_12px_rgba(212,175,55,0.45)]"
              />
              <div className="flex flex-col">
                <span className="text-sm font-extrabold tracking-wide text-white font-serif">
                  Accounting
                </span>
                <span className="text-[9px] font-mono text-[#d4af37] tracking-wider uppercase">
                  PROFESSOR TOKO
                </span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="mx-auto">
              <Image
                src="/logo (8).png"
                alt="Professor Toko Logo"
                width={28}
                height={28}
                className="rounded-lg object-contain drop-shadow-[0_0_12px_rgba(212,175,55,0.45)]"
              />
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

        {/* Company Switcher Dropdown */}
        <WorkspaceSwitcher
          activeWorkspaceId={activeId}
          activeWorkspaceName={activeName}
          activeRole={activeRole}
          availableWorkspaces={availableWorkspaces}
          isCollapsed={isCollapsed}
        />

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
