import { redirect } from 'next/navigation';

// HRD opens on Employee Directory (the brain of HRD).
export default function HrdHome() {
  redirect('/hrd/employees');
}
