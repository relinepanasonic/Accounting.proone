'use client';

import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function MonthFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentMonth = searchParams.get('month') || 'all';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams);
    if (e.target.value === 'all') {
      params.delete('month');
    } else {
      params.set('month', e.target.value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase font-mono">
        Filter Month
      </span>
      <select
        value={currentMonth}
        onChange={handleChange}
        className="bg-[#0b0c10] border border-[#d4af37]/30 text-[#f5d77f] text-xs font-bold rounded-lg px-3 py-1.5 outline-none focus:border-[#d4af37] transition-all font-mono shadow-[0_0_10px_rgba(212,175,55,0.1)]"
      >
        <option value="all">All 2026</option>
        {months.map((m, i) => (
          <option key={i} value={i.toString()}>{m.toUpperCase()}</option>
        ))}
      </select>
    </div>
  );
}
