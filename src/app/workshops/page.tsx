import { redirect } from 'next/navigation';

// Workshops live under Sales now (it is the sales jobdesk); old links land there.
export default function WorkshopsRedirect() {
  redirect('/sales/workshops');
}
