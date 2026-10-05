import { DivisionClients } from '@/components/productivity/DivisionClients';

export const dynamic = 'force-dynamic';

export default function AdminClientsPage() {
  return <DivisionClients base="/productivity/admin" job="admin" title="Admin" />;
}
