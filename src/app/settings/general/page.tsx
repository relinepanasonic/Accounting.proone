import { redirect } from 'next/navigation';

// Company settings moved to one page.
export default function GeneralRedirect() {
  redirect('/settings/workspaces');
}
