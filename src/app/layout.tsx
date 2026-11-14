import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Nexus — TechNova Business Operations',
  description:
    'Your business, in focus. A frontend demonstration of an AI business operations workspace for TechNova Distributors.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
