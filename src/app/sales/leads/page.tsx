import { redirect } from 'next/navigation';

// The Leads Database is merged into the pipeline: "Lead" is its first column.
export default function SalesLeadsPage() {
  redirect('/sales/pipeline');
}
