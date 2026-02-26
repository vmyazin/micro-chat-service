import type { Metadata } from 'next';
import { Bodoni_Moda, Geist, Geist_Mono, Jost } from 'next/font/google';
import { getLocale } from 'next-intl/server';
import './globals.css';
import { getDirection } from '@/i18n/config';
import { QueryProvider } from '@/providers/query-provider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const bodoniModa = Bodoni_Moda({
  variable: '--font-bodoni',
  subsets: ['latin'],
  style: ['normal', 'italic'],
});

const jost = Jost({
  variable: '--font-jost',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://microchat.smoxu.com'),
  title: {
    default: 'MicroChat — Private Group Messaging',
    template: '%s | MicroChat',
  },
  description:
    'End-to-end encrypted group messaging built on the MLS protocol (RFC 9420).',
  openGraph: {
    title: 'MicroChat — Private Group Messaging',
    description:
      'End-to-end encrypted group messaging built on the MLS protocol (RFC 9420).',
    url: 'https://microchat.smoxu.com',
    siteName: 'MicroChat',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MicroChat — Private Group Messaging',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MicroChat — Private Group Messaging',
    description:
      'End-to-end encrypted group messaging built on the MLS protocol (RFC 9420).',
    images: ['/images/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dir = getDirection(locale);

  return (
    <html lang={locale} dir={dir}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bodoniModa.variable} ${jost.variable} antialiased`}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
