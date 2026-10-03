'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CalendarDays, ClipboardList, Sun, Users } from 'lucide-react';

/** The pill bar across the Productivity pages: Today, Calendar, Stats (and Team + Assignments for owners). */
export function ProductivityTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { name: 'Today', href: '/productivity/me', icon: Sun, match: (p: string) => p === '/productivity/me' },
    { name: 'Calendar', href: '/productivity/calendar', icon: CalendarDays, match: (p: string) => p.startsWith('/productivity/calendar') },
    { name: 'Stats', href: '/productivity/stats', icon: BarChart3, match: (p: string) => p.startsWith('/productivity/stats') },
    ...(isOwner
      ? [
          { name: 'Team', href: '/productivity', icon: Users, match: (p: string) => p === '/productivity' || p.startsWith('/productivity/person') },
          { name: 'Assignments', href: '/productivity/assignments', icon: ClipboardList, match: (p: string) => p.startsWith('/productivity/assignments') },
        ]
      : []),
  ];
  return (
    <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-zinc-800 bg-[#0e0f14]/95 p-1 shadow-lg" aria-label="Productivity">
      {tabs.map(({ name, href, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              active ? 'border border-[#d4af37]/40 bg-[#d4af37]/15 text-[#f5d77f] shadow-[0_0_14px_rgba(212,175,55,0.2)]' : 'border border-transparent text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Icon className="h-4 w-4" /> {name}
          </Link>
        );
      })}
    </nav>
  );
}
