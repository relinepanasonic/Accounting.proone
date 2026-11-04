import { redirect } from 'next/navigation';

// The client contact book is gone: old links land on Optimizing > Clients.
export default function ContactsRedirect() {
  redirect('/optimizing/clients');
}
