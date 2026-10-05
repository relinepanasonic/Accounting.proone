import { redirect } from 'next/navigation';

// Accounts Receivable is a section of the Client tab now; old links land there.
export default function ArRedirect() {
  redirect('/sales/clients#ar');
}
