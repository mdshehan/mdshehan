import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gadgethub.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Global Gadget Price Hub — Compare Prices & Specs',
    template: '%s | Global Gadget Price Hub',
  },
  description:
    'Compare prices, specs and reviews for smartphones, laptops, tablets, TVs and more across stores worldwide.',
  openGraph: { type: 'website', siteName: 'Global Gadget Price Hub' },
  twitter: { card: 'summary_large_image' },
};

// Set theme before paint to avoid flash.
const themeScript = `
(function(){try{var t=localStorage.getItem('theme');var d=t? t==='dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
