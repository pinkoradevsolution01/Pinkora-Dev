import type { Metadata } from 'next';
import './globals.css';
import { SiteAnalytics } from '@/components/site-analytics';
import { SiteShell } from '@/components/site-shell';
import { StructuredData } from '@/components/structured-data';

export const metadata: Metadata = {
  title: { default: 'JVerse', template: '%s | JVerse' },
  metadataBase: new URL('https://www.jverse.site'),
  description: 'JVerse is the portfolio of Jay-Be Gubot, a Philippines-based full-stack developer building scalable web applications and business systems for startups and SMEs.',
  keywords: ['Full-Stack Developer Philippines', 'App Developer Philippines', 'Web Developer Philippines', 'Next.js Freelancer', 'React Developer', 'Software Developer', 'Business Systems', 'JVerse', 'Jay-Be Gubot'],
  authors: [{ name: 'Jay-Be Gubot' }],
  creator: 'Jay-Be Gubot',
  openGraph: {
    title: 'JVerse | Full-Stack Developer & Innovator',
    description: 'Scalable web applications and business systems for startups and SMEs.',
    url: '/',
    siteName: 'JVerse',
    locale: 'en_PH',
    type: 'website',
    images: [{ url: '/darkmode-logo.png', width: 1024, height: 1024, alt: 'JVerse logo' }],
  },
  twitter: { card: 'summary_large_image', title: 'JVerse | Full-Stack Developer & Innovator', description: 'Scalable web applications and business systems for startups and SMEs.', images: ['/darkmode-logo.png'] },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <StructuredData />
        <SiteAnalytics />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
