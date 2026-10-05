import { redirect } from 'next/navigation';

// Client contacts are a tab of Optimizing > Clients now; old links land there.
export default function ContactsRedirect() {
  redirect('/optimizing/clients?tab=contacts');
}
