import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#d97706',
};

export const metadata: Metadata = {
  title: 'Brew & Bites | Smart Table Ordering & Billing',
  description: 'Smart table ordering, kitchen display, and counter billing system.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Brew & Bites',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col font-sans select-none sm:select-auto`}
      >
        {children}
      </body>
    </html>
  );
}
