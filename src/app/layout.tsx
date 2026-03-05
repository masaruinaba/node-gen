import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'mood wards',
  description: 'Nuance map text rewriting tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
