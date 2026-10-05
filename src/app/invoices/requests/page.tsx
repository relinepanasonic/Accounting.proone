import { redirect } from 'next/navigation';

// Requests are rows at the top of the Invoices table now; old links (and old notifications) land there.
export default function InvoiceRequestsRedirect() {
  redirect('/invoices');
}
