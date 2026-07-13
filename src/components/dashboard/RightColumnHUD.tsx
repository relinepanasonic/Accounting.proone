import React from 'react';
import {
  DynamicCollectionHealthCompass,
  DynamicExpenseCategoryChart,
} from '@/components/dashboard/dynamic-visuals';
import { UpcomingBillsList } from '@/components/dashboard/right-column/UpcomingBillsList';

export async function RightColumnHUD() {
  return (
    <div className="flex flex-col gap-6">
      <UpcomingBillsList />
      <DynamicCollectionHealthCompass />
      <DynamicExpenseCategoryChart />
    </div>
  );
}
