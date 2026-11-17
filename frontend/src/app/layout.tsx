import type { Metadata } from 'next';
import './globals.css';
import localFont from 'next/font/local';
const geist = localFont({
  src: './fonts/Geist.woff2',
  variable: '--font-geist',
  weight: '100 900',
  display: 'swap',
});
export const metadata: Metadata = {
  title: 'Nexus — TechNova Business Operations',
  description:
    'Your business, in focus. A frontend demonstration of an AI business operations workspace for TechNova Distributors.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
