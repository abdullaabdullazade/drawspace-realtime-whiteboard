import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://drawspace.app'),
  title: {
    default: 'Drawspace — Real-time Collaborative Whiteboard',
    template: '%s · Drawspace',
  },
  description:
    'Drawspace is a real-time collaborative whiteboard — draw together live, share a link, and let anyone join and edit without signing in. Infinite canvas, live cursors, images and text. Built with NestJS, WebSockets, PostgreSQL and Next.js.',
  applicationName: 'Drawspace',
  authors: [{ name: 'Abdulla Abdullazade' }],
  creator: 'Abdulla Abdullazade',
  category: 'productivity',
  keywords: [
    'collaborative whiteboard',
    'real-time whiteboard',
    'online whiteboard',
    'digital whiteboard',
    'infinite canvas',
    'drawing app',
    'team collaboration',
    'live collaboration',
    'brainstorming tool',
    'sketch tool',
    'websocket',
    'nestjs',
    'nextjs',
    'excalidraw alternative',
    'miro alternative',
    'figma alternative',
  ],
  openGraph: {
    type: 'website',
    url: 'https://drawspace.app',
    siteName: 'Drawspace',
    title: 'Drawspace — Real-time Collaborative Whiteboard',
    description:
      'Draw together live and share a link — no login needed. Infinite canvas with real-time sync.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Drawspace collaborative whiteboard' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Drawspace — Real-time Collaborative Whiteboard',
    description: 'Draw together live and share a link — no login needed.',
    images: ['/og.png'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased relative">
        {/* Subtle Noise Texture Overlay */}
        <div 
          className="fixed inset-0 z-[9999] pointer-events-none opacity-[0.015] mix-blend-overlay dark:opacity-[0.03]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
        ></div>
        
        {children}
      </body>
    </html>
  );
}
