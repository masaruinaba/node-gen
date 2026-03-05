import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'node-gen',
  description: 'Nuance map text rewriting tool',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
