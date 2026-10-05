import { redirect } from 'next/navigation';

// The Product Catalog lives under Optimizing now; old links land there.
export default function CatalogRedirect() {
  redirect('/optimizing/catalog');
}
