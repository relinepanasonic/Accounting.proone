import { redirect } from 'next/navigation';

// Absensi is a sub page of HRD now; old links land there.
export default function AbsensiRedirect() {
  redirect('/hrd/absensi');
}
