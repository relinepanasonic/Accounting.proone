import { redirect } from 'next/navigation';

// One company page now: Company Settings.
export default function WorkspaceDetailRedirect() {
  redirect('/settings/workspaces');
}
