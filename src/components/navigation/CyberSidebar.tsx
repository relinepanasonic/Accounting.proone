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
  FileText,
  Users,
  Box,
  BookOpen,
  Settings,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  allowedRoles: string[]; // which roles can see this item
  allowedWorkspaceIds?: string[]; // if provided, ONLY these workspaces can see it
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupName: 'Accounting',
    items: [
      {
        name: 'Dashboard',
        href: '/',
        icon: <LayoutDashboard className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin', 'accounting'],
      },
      {
        name: 'Income',
        href: '/invoices',
        icon: <ArrowDownLeft className="w-4 h-4" />,
        badge: 'Sales',
        allowedRoles: ['founder', 'superadmin', 'accounting', 'admin'],
      },
      {
        name: 'Tax / Pajak',
        href: '/invoices/tax',
        icon: <ShieldCheck className="w-4 h-4" />,
        badge: 'Doc',
        allowedRoles: ['founder', 'superadmin', 'accounting', 'admin'],
        allowedWorkspaceIds: ['11111111-1111-1111-1111-111111111111'],
      },
      {
        name: 'Expenses',
        href: '/expenses',
        icon: <ArrowUpRight className="w-4 h-4" />,
        badge: 'Bills',
        allowedRoles: ['founder', 'superadmin', 'accounting', 'admin'],
      },
      {
        name: 'Assets',
        href: '/assets',
        icon: <Box className="w-4 h-4" />,
        badge: 'Deprec.',
        allowedRoles: ['founder', 'superadmin', 'accounting'],
      },
      {
        name: 'Activity Ledger',
        href: '/ledger',
        icon: <BookOpen className="w-4 h-4" />,
        badge: 'Live',
        allowedRoles: ['founder', 'superadmin', 'accounting'],
      },
      {
        name: 'Bank Reconcile',
        href: '/reconcile',
        icon: <CheckSquare className="w-4 h-4" />,
        badge: 'Match',
        allowedRoles: ['founder', 'superadmin', 'accounting'],
      },
    ]
  },
  {
    groupName: 'Sales',
    items: [
      {
        name: 'Customers & Leads',
        href: '/sales',
        icon: <Users className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin', 'admin', 'sales'],
      },
      {
        name: 'CRM Pipeline',
        href: '/sales/pipeline',
        icon: <LayoutDashboard className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin', 'admin', 'sales'],
      },
    ]
  },
  {
    groupName: 'Productivity',
    items: [
      {
        name: 'Task Board',
        href: '/productivity',
        icon: <CheckSquare className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin', 'admin', 'employee'],
      },
      {
        name: 'Docs & Wiki',
        href: '/productivity/docs',
        icon: <FileText className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin', 'admin', 'employee'],
      },
    ]
  },
  {
    groupName: 'HRD',
    items: [
      {
        name: 'Team Payroll',
        href: '/payroll',
        icon: <Users className="w-4 h-4" />,
        badge: 'Salaries',
        allowedRoles: ['founder', 'superadmin', 'accounting', 'hr'],
      },
      {
        name: 'Employee Directory',
        href: '/hrd',
        icon: <BookOpen className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin', 'hr'],
      },
    ]
  },
  {
    groupName: 'System',
    items: [
      {
        name: 'Settings & Users',
        href: '/settings',
        icon: <Settings className="w-4 h-4" />,
        allowedRoles: ['founder', 'superadmin'],
      },
    ]
  }
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

        {/* Add Workspace Button in Sidebar */}
        {!isCollapsed && (
          <div className="px-3 pt-2">
            <Link
              href="/settings/general"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-extrabold tracking-wider text-[#111111] bg-gradient-to-r from-[#d4af37] to-[#f5d77f] hover:opacity-90 transition-opacity uppercase shadow-[0_0_15px_rgba(212,175,55,0.4)]"
            >
              + NEW ENTERPRISE TENANT
            </Link>
          </div>
        )}

        {/* Navigation Menu Links */}
        <nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)] scrollbar-hide">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(item => {
              if (!item.allowedRoles.includes(activeRole)) return false;
              if (item.allowedWorkspaceIds && !item.allowedWorkspaceIds.includes(activeId)) return false;
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.groupName} className="flex flex-col space-y-1">
                {!isCollapsed && (
                  <div className="px-3 py-1 mb-1 text-[10px] font-extrabold tracking-widest text-zinc-500 uppercase">
                    {group.groupName}
                  </div>
                )}
                {visibleItems.map((item) => {
                  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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
                        <span className={`transition-colors ${isActive ? 'text-[#f5d77f]' : 'text-zinc-500 group-hover:text-[#d4af37]'}`}>
                          {item.icon}
                        </span>
                        {!isCollapsed && (
                          <span className="font-sans tracking-wide">
                            {item.name}
                          </span>
                        )}
                      </div>
                      {!isCollapsed && item.badge && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider ${isActive ? 'bg-[#d4af37]/20 text-[#f5d77f]' : 'bg-zinc-800 text-zinc-400 group-hover:bg-[#d4af37]/10 group-hover:text-[#f5d77f]'}`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
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
