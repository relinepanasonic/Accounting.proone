// Which sidebar header each route belongs to. Shared by the sidebar, the mobile bottom bar and the sub-nav,
// so a page can never be "active" under two headers.

export const isAccountingPath = (p: string) =>
  ['/', '/invoices', '/expenses', '/assets', '/ledger', '/reconcile'].some((x) => p === x || p.startsWith(x + '/'));

// "Optimizing" header = Admin + Sales + Advertiser.
export const isOptimizingAdminPath = (p: string) => p === '/productivity/admin' || p.startsWith('/productivity/admin/');
export const isOptimizingSalesPath = (p: string) => p === '/sales' || p.startsWith('/sales/');
export const isOptimizingAdvertiserPath = (p: string) => p === '/productivity/advertiser' || p.startsWith('/productivity/advertiser/');
export const isOptimizingPath = (p: string) => isOptimizingAdminPath(p) || isOptimizingSalesPath(p) || isOptimizingAdvertiserPath(p);

export const isPabrikPath = (p: string) => p === '/productivity/pabrik-sosmed' || p.startsWith('/productivity/pabrik-sosmed/');

// Productivity keeps only its own pages (dashboard + assignments).
export const isProductivityPath = (p: string) => p === '/productivity' || p === '/productivity/assignments' || p.startsWith('/productivity/assignments/');

export const isHrdPath = (p: string) => p.startsWith('/payroll') || p.startsWith('/hrd');

export const OPTIMIZING_CHILDREN = [
  { name: 'Admin', href: '/productivity/admin', isActive: isOptimizingAdminPath },
  { name: 'Sales', href: '/sales', isActive: isOptimizingSalesPath },
  { name: 'Advertiser', href: '/productivity/advertiser', isActive: isOptimizingAdvertiserPath },
] as const;
