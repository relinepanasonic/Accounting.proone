import React from 'react';
import {
  DynamicProjectedRevenueChart,
  DynamicUnpaidAmountGauge,
} from '@/components/dashboard/dynamic-visuals';
import { ClientReceivablesList } from '@/components/dashboard/left-column/ClientReceivablesList';

export async function LeftColumnHUD() {
  return (
    <div className="flex flex-col gap-6">
      <DynamicProjectedRevenueChart />
      <DynamicUnpaidAmountGauge />
      <ClientReceivablesList />
    </div>
  );
}
