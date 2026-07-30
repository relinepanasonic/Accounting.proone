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
      <DynamicProjectedRevenueChart 
        projectedAmount={telemetry.chartData.projectedCurrentMonth}
        targetAmount={telemetry.chartData.projectedTarget}
        percentChange={telemetry.chartData.projectedPercentChange}
        historicalData={telemetry.chartData.revenue}
      />
      <DynamicUnpaidAmountGauge
        amount={telemetry.invoicesSummary.activeReceivables}
        totalVolume={telemetry.invoicesSummary.totalVolume}
        overdueCount={telemetry.invoicesSummary.overdueCount}
      />
      <ClientReceivablesList clientReceivables={telemetry.clientReceivables} />
    </div>
  );
}
