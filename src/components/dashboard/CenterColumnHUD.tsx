import React from 'react';
import {
  DynamicTotalInvoiceDataRing,
  DynamicCashFlowProfitCharts,
} from '@/components/dashboard/dynamic-visuals';
import { InvoicesDataTable } from '@/components/dashboard/center-column/InvoicesDataTable';

export async function CenterColumnHUD() {
  return (
    <div className="flex flex-col gap-6">
      <DynamicTotalInvoiceDataRing />
      <InvoicesDataTable />
      <DynamicCashFlowProfitCharts />
    </div>
  );
}
