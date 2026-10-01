import { redirect } from 'next/navigation';

// Accounts are created only from an invitation link (/join/...). There is no open sign-up page.
export default function RegisterPage() {
  redirect('/login');
}
