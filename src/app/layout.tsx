import type { Metadata } from 'next';
import './globals.css';
import { CyberSidebar } from '@/components/navigation/CyberSidebar';

export const metadata: Metadata = {
  title: 'Accounting.proone | Cybernetic Action Accounting HUD',
  description:
    'Frictionless Advanced Action-Oriented Accounting & Invoice Generator SaaS for non-accountants.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080b11] text-slate-100 antialiased selection:bg-cyan-500 selection:text-black flex min-h-screen">
        {/* Persistent Cybernetic Collapsible Left Sidebar */}
        <CyberSidebar />

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
