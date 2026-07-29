'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

interface NavigationShellProps {
  sidebar: React.ReactNode;
  bottomNav: React.ReactNode;
  children: React.ReactNode;
}

export function NavigationShell({ sidebar, bottomNav, children }: NavigationShellProps) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register';

  return (
    <>
      {!isAuthPage && sidebar}
      <main className={`flex-1 overflow-x-hidden overflow-y-auto ${!isAuthPage ? 'pb-20 lg:pb-0' : ''}`}>
        {children}
      </main>
      {!isAuthPage && bottomNav}
    </>
  );
}
