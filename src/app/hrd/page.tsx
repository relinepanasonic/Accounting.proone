import { redirect } from 'next/navigation';

// HRD opens on Team Payroll.
export default function HrdHome() {
  redirect('/payroll');
}
