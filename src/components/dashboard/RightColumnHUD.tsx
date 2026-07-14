import React from 'react';
import {
  DynamicCollectionHealthCompass,
  DynamicExpenseCategoryChart,
} from '@/components/dashboard/dynamic-visuals';
import { UpcomingBillsList } from '@/components/dashboard/right-column/UpcomingBillsList';
import { getDashboardTelemetry } from '@/lib/data/dashboard';

export async function RightColumnHUD() {
  const telemetry = await getDashboardTelemetry();

  return (
    <div className="flex flex-col gap-6">
      <UpcomingBillsList upcomingBills={telemetry.upcomingBills} />
      <DynamicCollectionHealthCompass />
      <DynamicExpenseCategoryChart />
    </div>
  );
}
