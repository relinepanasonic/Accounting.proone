import OptimizingClientsPage from '../clients/page';

export const dynamic = 'force-dynamic';

/** Optimizing > Churn: the same table as Clients, with only the clients that left (Active again brings one back). */
export default function OptimizingChurnPage() {
  return OptimizingClientsPage({ searchParams: Promise.resolve({ tab: 'churn' }) });
}
