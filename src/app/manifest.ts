import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Professor Toko Accounting • Luxury Gold Executive Suite',
    short_name: 'PTO Finance',
    description:
      'Frictionless Advanced Action-Oriented Accounting & Invoice Generator SaaS in Brushed Luxury Gold.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0c10',
    theme_color: '#d4af37',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
