import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'NextRouter REborn',
  description: 'Unified AI model gateway',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Sidebar />
        <main className="min-h-screen px-4 py-4 pl-20 sm:px-6 lg:px-10">{children}</main>
      </body>
    </html>
  );
}