import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

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
    default: 'NextRouter REborn',
    template: '%s | NextRouter REborn',
  },
  description:
    'One API key. Every model. A unified AI gateway for text and image models with automatic failover.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen antialiased">
        <div className="bg-aurora" aria-hidden />
        <div className="bg-grid" aria-hidden />
        <Sidebar />
        <main className="min-h-screen px-4 py-4 pl-20 sm:px-6 lg:px-10">{children}</main>
      </body>
    </html>
  );
}
