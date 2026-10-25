import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'DevScroll — Une idée à la fois',
  description:
    'Ton fil privé de découvertes techniques. Sauvegarde une idée, retrouve-la et révise à ton rythme.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'DevScroll' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#111513' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
