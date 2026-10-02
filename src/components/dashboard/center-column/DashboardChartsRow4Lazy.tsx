'use client';

import dynamic from 'next/dynamic';
import type { DashboardTelemetry } from '@/lib/data/dashboard';

const DashboardChartsRow4Inner = dynamic(
  () => import('./DashboardChartsRow4').then(m => ({ default: m.DashboardChartsRow4 })),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="gold-glass-panel rounded-2xl h-80 animate-pulse" />
        <div className="gold-glass-panel rounded-2xl h-80 animate-pulse" />
      </div>
    ),
  }
);

export function DashboardChartsRow4Lazy({ telemetry }: { telemetry: DashboardTelemetry }) {
  return <DashboardChartsRow4Inner telemetry={telemetry} />;
}
