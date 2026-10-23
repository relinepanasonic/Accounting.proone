import Link from 'next/link';

/** Fixed Asset sub pages: the asset list and the Schedule Expense (the monthly payments of every asset). */
export function AssetTabs({ active }: { active: 'assets' | 'schedule' }) {
  const items = [
    { key: 'assets', name: 'Assets', href: '/assets' },
    { key: 'schedule', name: 'Schedule Expense', href: '/assets/schedule' },
  ] as const;
  return (
    <div className="flex w-fit gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${active === i.key ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#d4af37] shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          {i.name}
        </Link>
      ))}
    </div>
  );
}
