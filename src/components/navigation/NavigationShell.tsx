'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { ModuleSubNav } from './ModuleSubNav';
import { NotificationBell } from './NotificationBell';

interface NavigationShellProps {
  sidebar: React.ReactNode;
  bottomNav: React.ReactNode;
  children: React.ReactNode;
  limited?: boolean;
  role?: string;
}

export function NavigationShell({ sidebar, bottomNav, children, limited, role }: NavigationShellProps) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname.startsWith('/workspaces') || pathname.startsWith('/join/') || pathname.startsWith('/share/');

  return (
    <>
      {!isAuthPage && sidebar}
      {!isAuthPage && <NotificationBell />}
      <main className={`flex-1 overflow-x-hidden overflow-y-auto ${!isAuthPage ? 'pb-20 lg:pb-0' : ''} flex flex-col`}>
        {!isAuthPage && (!limited || role === 'sales') && <ModuleSubNav role={role} />}
        <div className="flex-1">
          {children}
        </div>
      </main>
      {!isAuthPage && bottomNav}
    </>
  );
}
