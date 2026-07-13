import type { Metadata } from 'next';
import './globals.css';
import { CyberSidebar } from '@/components/navigation/CyberSidebar';

export const metadata: Metadata = {
  title: 'Accounting.proone | Executive Luxury Gold Accounting Suite',
  description:
    'Frictionless Advanced Action-Oriented Accounting & Invoice Generator SaaS in Brushed Luxury Gold for non-accountants.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0c10] text-zinc-100 antialiased selection:bg-[#d4af37] selection:text-black flex min-h-screen">
        {/* Persistent Luxury Gold Left Sidebar */}
        <CyberSidebar />

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
