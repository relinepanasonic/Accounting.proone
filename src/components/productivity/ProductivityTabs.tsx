'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, CalendarClock, ClipboardList, Sun } from 'lucide-react';

/** The pill bar across the Productivity pages: Today | Task List & Assignment | Meeting Schedule | Stat KPI. */
export function ProductivityTabs({ isOwner: _isOwner }: { isOwner?: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { name: 'Today', href: '/productivity/me', icon: Sun, match: (p: string) => p === '/productivity/me' },
    { name: 'Task List & Assignment', href: '/productivity/tasks', icon: ClipboardList, match: (p: string) => p.startsWith('/productivity/tasks') || p.startsWith('/productivity/assignments') },
    { name: 'Meeting Schedule', href: '/productivity/meetings', icon: CalendarClock, match: (p: string) => p.startsWith('/productivity/meetings') },
    { name: 'Stat KPI', href: '/productivity/stats', icon: BarChart3, match: (p: string) => p === '/productivity' || p.startsWith('/productivity/stats') || p.startsWith('/productivity/person') },
  ];
  return (
    <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-zinc-800 bg-[#0e0f14]/95 p-1 shadow-lg" aria-label="Productivity">
      {tabs.map(({ name, href, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors ${
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
