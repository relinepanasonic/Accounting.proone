import React from 'react';
import {
  DynamicTotalInvoiceDataRing,
  DynamicCashFlowProfitCharts,
} from '@/components/dashboard/dynamic-visuals';
import { InvoicesDataTable } from '@/components/dashboard/center-column/InvoicesDataTable';
import { getDashboardTelemetry } from '@/lib/data/dashboard';

export async function CenterColumnHUD() {
  const telemetry = await getDashboardTelemetry();

  return (
    <div className="flex flex-col gap-6">
      <DynamicTotalInvoiceDataRing
        totalVolume={telemetry.invoicesSummary.totalVolume}
        overdueCount={telemetry.invoicesSummary.overdueCount}
        paidCount={telemetry.invoicesSummary.paidCount}
        avgAmount={telemetry.invoicesSummary.avgInvoiceAmount}
      />
      <InvoicesDataTable />
      <DynamicCashFlowProfitCharts />
    </div>
  );
}
