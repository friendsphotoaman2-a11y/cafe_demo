import type { MetadataRoute } from 'next';
import { withBasePath } from '@/lib/base-path';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Brew & Bites Smart Cafe',
    short_name: 'Brew & Bites',
    description: 'Smart Table Ordering, KDS & Counter Billing System',
    start_url: withBasePath('/'),
    scope: withBasePath('/'),
    display: 'standalone',
    background_color: '#1c1917',
    theme_color: '#d97706',
    orientation: 'portrait',
    icons: [
      {
        src: withBasePath('/icon-192.png'),
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: withBasePath('/icon-512.png'),
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
