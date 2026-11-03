import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { MeloProvider } from '@/components/session';
import { ComposeModal, Nav } from '@/components/interactive';
import { SITE_URL } from '@/lib/supabase';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Melo', template: '%s · Melo' },
  description: 'Log, rate and argue about albums and podcast episodes with people who care as much as you do.',
  openGraph: { siteName: 'Melo', type: 'website' },
  twitter: { card: 'summary_large_image' },
};
export const viewport: Viewport = { themeColor: '#070910', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ ['--font-urbanist' as string]: "'Urbanist'" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>
        <MeloProvider>
          <Nav />
          <main>{children}</main>
          <ComposeModal />
          <footer className="site">
            <div className="wrap">
              <div className="cols">
                <div style={{ maxWidth: 320 }}><Link className="logo" href="/" style={{ color: '#fff' }}><span className="disc" aria-hidden="true" />melo</Link><p style={{ marginTop: 12 }}>Log, rate and argue about albums and podcast episodes. Works with Spotify and Apple Music.</p></div>
                <div><b style={{ color: '#fff' }}>Melo</b><Link href="/explore">Explore</Link><Link href="/forecasts">Forecasts</Link><Link href="/feed">Feed</Link></div>
                <div><b style={{ color: '#fff' }}>Help</b><Link href="/support">Support</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
              </div>
            </div>
          </footer>
        </MeloProvider>
      </body>
    </html>
  );
}
