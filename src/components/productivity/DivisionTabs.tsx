import Link from 'next/link';

type Active = 'dashboard' | 'client' | 'performance' | 'log' | 'fake';

/** Tabs of the Advertiser and Admin pages. Admin: Performance | Log Detail | Friends Order | Client. Advertiser: Dashboard | Client. */
export function DivisionTabs({ base, active }: { base: '/productivity/advertiser' | '/productivity/admin'; active: Active }) {
  const items: Array<{ key: Active; name: string; href: string }> = base === '/productivity/admin'
    ? [
        { key: 'performance', name: 'Performance', href: base },
        { key: 'log', name: 'Log Detail', href: `${base}/log` },
        { key: 'fake', name: 'Friends Order', href: `${base}/fake-order` },
        { key: 'client', name: 'Client', href: `${base}/clients` },
      ]
    : [
        { key: 'dashboard', name: 'Dashboard', href: base },
        { key: 'client', name: 'Client', href: `${base}/clients` },
      ];
  return (
    <div className="flex w-fit flex-wrap gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
            active === i.key ? 'border border-[#d4af37]/30 bg-[#0e0f14] text-[#d4af37] shadow-md' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {i.name}
        </Link>
      ))}
    </div>
  );
}
