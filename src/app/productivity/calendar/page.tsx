import { redirect } from 'next/navigation';

// The calendar is a widget on the Today page now; old links land there.
export default async function CalendarRedirect({ searchParams }: { searchParams: Promise<{ month?: string; date?: string }> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp.month) q.set('month', sp.month);
  if (sp.date) q.set('date', sp.date);
  redirect(`/productivity/me${q.toString() ? '?' + q.toString() : ''}`);
}
