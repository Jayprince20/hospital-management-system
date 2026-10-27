import type { MetadataRoute } from 'next';

// Installable app (PWA): opens on the dashboard, works offline for the screens kept by the service worker
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BB Diagnostics — Gestion hospitalière',
    short_name: 'BB Diagnostics',
    description: 'Dossiers patients, soins, laboratoire, pharmacie et caisse — utilisable hors ligne pour les saisies au lit du patient.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#F4F6F2',
    theme_color: '#14532D',
    lang: 'fr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
