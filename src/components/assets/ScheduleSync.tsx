'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { runMonthlyDepreciation } from '@/app/actions/fixed-assets';

/** No button: when the page opens, the payments that fell due are posted (and the schedule of new assets is made). The page reloads only when something changed. */
export function ScheduleSync() {
  const router = useRouter();
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    runMonthlyDepreciation().then((res) => {
      if (res.success && (((res as any).processedCount || 0) || ((res as any).created || 0))) router.refresh();
    }).catch(() => { /* the daily job tries again */ });
  }, [router]);

  return null;
}
