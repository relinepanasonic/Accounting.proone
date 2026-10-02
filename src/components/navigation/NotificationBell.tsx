'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X } from 'lucide-react';
import { dismissNotification, getNotifications, type NotificationItem } from '@/app/actions/sales-flow';

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};

/** Task-style notifications: invoice requests (Accounting), new projects (superadmin), invoice ready / paid (salesman). */
export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setItems(await getNotifications());
    } catch {
      /* signed out or offline: keep the last list */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = async (n: NotificationItem) => {
    setOpen(false);
    if (n.kind === 'invoice_ready' || n.kind === 'deal_paid') await dismissNotification(n.id);
    if (n.link) router.push(n.link);
    load();
  };

  return (
    <div ref={box} className="fixed right-3 top-3 z-40 print:hidden">
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        aria-label={`Notifications${items.length ? `, ${items.length} waiting` : ''}`}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#d4af37]/30 bg-[#0e0f14]/95 text-[#f5d77f] shadow-lg backdrop-blur hover:border-[#d4af37]"
      >
        <Bell className="h-4 w-4" />
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{items.length > 9 ? '9+' : items.length}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-[#d4af37]/25 bg-[#0e0f14] shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">To do</span>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[60vh] divide-y divide-zinc-900 overflow-y-auto">
            {items.length === 0 && <p className="p-6 text-center text-xs text-zinc-500">Nothing waiting for you.</p>}
            {items.map((n) => (
              <button key={n.id} onClick={() => go(n)} className="block w-full px-4 py-3 text-left hover:bg-zinc-900/60">
                <div className="text-sm font-semibold text-zinc-100">{n.title}</div>
                {n.body && <div className="mt-0.5 text-xs text-zinc-400">{n.body}</div>}
                <div className="mt-1 text-[10px] text-zinc-600">{ago(n.created_at)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
