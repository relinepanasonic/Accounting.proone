import React from 'react';
import {
  DynamicProjectedRevenueChart,
  DynamicUnpaidAmountGauge,
} from '@/components/dashboard/dynamic-visuals';
import { ClientReceivablesList } from '@/components/dashboard/left-column/ClientReceivablesList';
import { getDashboardTelemetry } from '@/lib/data/dashboard';

export async function LeftColumnHUD() {
  const telemetry = await getDashboardTelemetry();

  return (
    <div className="flex flex-col gap-6">
      <DynamicProjectedRevenueChart />
      <DynamicUnpaidAmountGauge
        amount={telemetry.invoicesSummary.unpaidRatio}
        overdueCount={telemetry.invoicesSummary.overdueCount}
      />
      <ClientReceivablesList clientReceivables={telemetry.clientReceivables} />
    </div>
  );
}
