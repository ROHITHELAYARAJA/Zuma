import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/dm-sans';
import '@fontsource/kalam/400.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Clinical workspace · Every record, one clear picture', template: '%s · Clinical workspace' },
  description: 'Explore a synthetic, consent-based clinical record workspace with source-linked summaries, text and voice, and FHIR document review.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
