import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import SiteChrome from '@/components/SiteChrome';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'NextRouter',
    template: '%s | NextRouter',
  },
  description:
    'NextRouter — one OpenAI-compatible endpoint for every model. Keys via Discord bot. 50M tokens/day.',
  icons: { icon: ['/logo.png', '/logo.svg'] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
