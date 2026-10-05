'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import type { WorkspaceContextInfo } from '@/lib/auth/workspace-context';
import {
  LayoutDashboard,
  ArrowUpRight,
  CheckSquare,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Bot,
  TrendingUp,
  ChevronDown,
  Shield,
  Megaphone,
  Share2,
  Activity,
  FileText,
  Receipt,
  CreditCard,
  Briefcase,
  BookOpen,
  RefreshCw,
  Network,
  CircleDot
} from 'lucide-react';
import {
  isAccountingPath,
  isHrdPath,
  isPabrikPath,
  isProductivityPath,
  isOptimizingPath,
  OPTIMIZING_CHILDREN,
  ACCOUNTING_CHILDREN,
} from '@/components/navigation/nav-config';

type NavEntry =
  | { type: 'link'; name: string; href: string; icon: React.ReactNode; isActive: (p: string) => boolean }
  | { type: 'group'; name: string; icon: React.ReactNode; isActive: (p: string) => boolean; children: ReadonlyArray<{ name: string; href: string; isActive: (p: string) => boolean }> };

const OPTIMIZING_ICONS: Record<string, React.ReactNode> = {
  Admin: <Shield className="w-3.5 h-3.5" />,
  Sales: <ArrowUpRight className="w-3.5 h-3.5" />,
  Advertiser: <Megaphone className="w-3.5 h-3.5" />,
};

const ACCOUNTING_ICONS: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard className="w-3.5 h-3.5" />,
  Income: <FileText className="w-3.5 h-3.5" />,
  'Tax / Pajak': <Receipt className="w-3.5 h-3.5" />,
  Expenses: <CreditCard className="w-3.5 h-3.5" />,
  Assets: <Briefcase className="w-3.5 h-3.5" />,
  'Activity Ledger': <BookOpen className="w-3.5 h-3.5" />,
  'Bank Reconcile': <RefreshCw className="w-3.5 h-3.5" />,
  'COA Mapping': <Network className="w-3.5 h-3.5" />,
};

const GROUP_ICONS: Record<string, Record<string, React.ReactNode>> = {
  Optimizing: OPTIMIZING_ICONS,
  Accounting: ACCOUNTING_ICONS,
};

const MAIN_MODULES: NavEntry[] = [
  { type: 'link', name: 'AI Office', href: '/ai-office', icon: <Bot className="w-4 h-4" />, isActive: (p) => p.startsWith('/ai-office') },
  { type: 'link', name: 'Productivity', href: '/productivity', icon: <CheckSquare className="w-4 h-4" />, isActive: isProductivityPath },
  { type: 'group', name: 'Accounting', icon: <LayoutDashboard className="w-4 h-4" />, isActive: isAccountingPath, children: ACCOUNTING_CHILDREN },
  { type: 'group', name: 'Optimizing', icon: <TrendingUp className="w-4 h-4" />, isActive: isOptimizingPath, children: OPTIMIZING_CHILDREN },
  { type: 'link', name: 'Pabrik Sosmed', href: '/productivity/pabrik-sosmed', icon: <Share2 className="w-4 h-4" />, isActive: isPabrikPath },
  { type: 'link', name: 'HRD', href: '/payroll', icon: <Users className="w-4 h-4" />, isActive: isHrdPath },
  { type: 'link', name: 'System', href: '/settings', icon: <Settings className="w-4 h-4" />, isActive: (p) => p.startsWith('/settings') },
];

interface CyberSidebarProps {
  workspaceContext?: WorkspaceContextInfo;
}

export function CyberSidebar({ workspaceContext }: CyberSidebarProps = {}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Optimizing: true,
    Accounting: true,
  });
  
  const pathname = usePathname();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('sidebar-open-groups');
      if (saved) {
        setOpenGroups(JSON.parse(saved));
      }
    } catch {
      // storage unavailable
    }
  }, []);

  const toggleGroup = (groupName: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [groupName]: !prev[groupName] };
      try {
        window.localStorage.setItem('sidebar-open-groups', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Opening a page inside a group always reveals it.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      if (isOptimizingPath(pathname) && !next.Optimizing) { next.Optimizing = true; changed = true; }
      if (isAccountingPath(pathname) && !next.Accounting) { next.Accounting = true; changed = true; }
      if (changed) {
        try { window.localStorage.setItem('sidebar-open-groups', JSON.stringify(next)); } catch {}
        return next;
      }
      return prev;
    });
  }, [pathname]);

  const activeId = workspaceContext?.activeWorkspaceId || '11111111-1111-1111-1111-111111111111';
  const activeName = workspaceContext?.activeWorkspaceName || 'Professor Toko Online HQ';
  const activeRole = workspaceContext?.role || 'none';
  
  // advertiser / client see Pabrik Sosmed only, never the finance navigation.
  const limited = activeRole === 'advertiser' || activeRole === 'sales' || activeRole === 'client';

  const modules: NavEntry[] =
    activeRole === 'advertiser'
      ? [
          { type: 'group', name: 'Optimizing', icon: <TrendingUp className="w-4 h-4" />, isActive: isOptimizingPath, children: OPTIMIZING_CHILDREN.filter((c) => c.name === 'Advertiser') },
          { type: 'link', name: 'Productivity', href: '/productivity/me', icon: <Activity className="w-4 h-4" />, isActive: (p) => p.startsWith('/productivity/me') },
        ]
      : activeRole === 'sales'
        ? [
            { type: 'link', name: 'Sales', href: '/sales', icon: <TrendingUp className="w-4 h-4" />, isActive: (p) => p === '/sales' || p.startsWith('/sales/') },
            { type: 'link', name: 'Productivity', href: '/productivity/me', icon: <Activity className="w-4 h-4" />, isActive: (p) => p.startsWith('/productivity/me') },
            { type: 'link', name: 'Absensi', href: '/hrd/absensi', icon: <Users className="w-4 h-4" />, isActive: isHrdPath },
          ]
      : limited
        ? [{ type: 'link', name: 'Pabrik Sosmed', href: '/productivity/pabrik-sosmed', icon: <Share2 className="w-4 h-4" />, isActive: isPabrikPath }]
        : MAIN_MODULES;
        
  const availableWorkspaces = workspaceContext?.availableWorkspaces || [];

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
                  Commerce Center
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
        {!isCollapsed && !limited && (
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
        <nav className="p-3 space-y-2 mt-2 h-[calc(100vh-220px)] overflow-y-auto scrollbar-hide">
          {modules.map((item) => {
            if (item.type === 'group') {
              const groupActive = item.isActive(pathname);
              const isOpen = openGroups[item.name] ?? false;
              
              const headerClass = `group w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                groupActive && !isOpen
                  ? 'bg-gradient-to-r from-[#d4af37]/20 to-[#d4af37]/5 text-[#f5d77f] border border-[#d4af37]/40'
                  : groupActive
                    ? 'text-[#f5d77f]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60'
              }`;

              // Collapsed sidebar: just the icon, which opens the first page of the group.
              if (isCollapsed) {
                return (
                  <Link key={item.name} href={(item.children[0]).href} title={item.name} className={headerClass}>
                    <span className={groupActive ? 'text-[#f5d77f]' : 'text-zinc-500 group-hover:text-[#d4af37]'}>{item.icon}</span>
                  </Link>
                );
              }

              return (
                <div key={item.name}>
                  <button type="button" onClick={() => toggleGroup(item.name)} aria-expanded={isOpen} className={headerClass}>
                    <span className="flex items-center gap-3">
                      <span className={groupActive ? 'text-[#f5d77f]' : 'text-zinc-500 group-hover:text-[#d4af37]'}>{item.icon}</span>
                      <span className="font-sans tracking-wide">{item.name}</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="mt-1 ml-5 pl-3 border-l border-[#d4af37]/20 space-y-1">
                      {item.children.map((child) => {
                        const active = child.isActive(pathname);
                        const childIcon = (GROUP_ICONS[item.name] && GROUP_ICONS[item.name][child.name]) || <CircleDot className="w-3.5 h-3.5" />;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
                              active
                                ? 'bg-gradient-to-r from-[#d4af37]/20 to-[#d4af37]/5 text-[#f5d77f] border border-[#d4af37]/40'
                                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60'
                            }`}
                          >
                            <span className={active ? 'text-[#f5d77f]' : 'text-zinc-500'}>{childIcon}</span>
                            <span className="font-sans tracking-wide">{child.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
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
