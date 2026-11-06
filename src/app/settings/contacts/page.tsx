import { redirect } from 'next/navigation';

// The client contacts live in Accounting > Client Contact (the same clients as Optimizing > Clients).
export default function ContactsRedirect() {
  redirect('/contacts');
}
