import { redirect } from 'next/navigation';

// To-Do lives in Productivity now; old links land there.
export default function TodoRedirect() {
  redirect('/productivity/tasks');
}
