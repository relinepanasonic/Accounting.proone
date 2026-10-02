'use client';

import dynamic from 'next/dynamic';
import type { DashboardTelemetry } from '@/lib/data/dashboard';

const DashboardChartsRow3Inner = dynamic(
  () => import('./DashboardChartsRow3').then(m => ({ default: m.DashboardChartsRow3 })),
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

export function DashboardChartsRow3Lazy({ telemetry }: { telemetry: DashboardTelemetry }) {
  return <DashboardChartsRow3Inner telemetry={telemetry} />;
}
