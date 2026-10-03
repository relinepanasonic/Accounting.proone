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
export const isProductivityPath = (p: string) =>
  p === '/productivity' ||
  p === '/productivity/assignments' ||
  p.startsWith('/productivity/assignments/') ||
  p === '/productivity/me' ||
  p.startsWith('/productivity/calendar') ||
  p.startsWith('/productivity/tasks') ||
  p.startsWith('/productivity/meetings') ||
  p.startsWith('/productivity/stats') ||
  p.startsWith('/productivity/person/');

export const isHrdPath = (p: string) => p.startsWith('/payroll') || p.startsWith('/hrd');

export const OPTIMIZING_CHILDREN = [
  { name: 'Admin', href: '/productivity/admin', isActive: isOptimizingAdminPath },
  { name: 'Sales', href: '/sales', isActive: isOptimizingSalesPath },
  { name: 'Advertiser', href: '/productivity/advertiser', isActive: isOptimizingAdvertiserPath },
] as const;

export const ACCOUNTING_CHILDREN = [
  { name: 'Dashboard', href: '/', isActive: (p: string) => p === '/' },
  { name: 'Income', href: '/invoices', isActive: (p: string) => p === '/invoices' || p.startsWith('/invoices/') && !p.startsWith('/invoices/tax') },
  { name: 'Tax / Pajak', href: '/invoices/tax', isActive: (p: string) => p.startsWith('/invoices/tax') },
  { name: 'Expenses', href: '/expenses', isActive: (p: string) => p === '/expenses' || p.startsWith('/expenses/') },
  { name: 'Assets', href: '/assets', isActive: (p: string) => p === '/assets' || p.startsWith('/assets/') },
  { name: 'Activity Ledger', href: '/ledger', isActive: (p: string) => p === '/ledger' || p.startsWith('/ledger/') },
  { name: 'Bank Reconcile', href: '/reconcile', isActive: (p: string) => p === '/reconcile' || p.startsWith('/reconcile/') },
  { name: 'COA Mapping', href: '/coa', isActive: (p: string) => p === '/coa' || p.startsWith('/coa/') },
] as const;
