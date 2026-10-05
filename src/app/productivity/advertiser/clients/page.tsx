import { DivisionClients } from '@/components/productivity/DivisionClients';

export const dynamic = 'force-dynamic';

export default function AdvertiserClientsPage() {
  return <DivisionClients base="/productivity/advertiser" job="advertising" title="Advertiser" />;
}
