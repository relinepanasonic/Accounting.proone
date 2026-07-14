import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CyberSidebar } from '@/components/navigation/CyberSidebar';
import { BottomMobileNav } from '@/components/navigation/BottomMobileNav';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';

export const viewport: Viewport = {
  themeColor: '#d4af37',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Professor Toko Accounting | Executive Luxury Gold Suite',
  description:
    'Frictionless Advanced Action-Oriented Accounting & Invoice Generator SaaS in Brushed Luxury Gold for non-accountants.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PTO Finance',
  },
  icons: {
    icon: '/logo (8).png',
    apple: '/logo (8).png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const wsContext = await getAuthenticatedWorkspaceContext();

  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0c10] text-zinc-100 antialiased selection:bg-[#d4af37] selection:text-black flex min-h-screen">
        {/* Persistent Luxury Gold Left Sidebar (Desktop: lg:flex, Mobile: hidden) */}
        <CyberSidebar workspaceContext={wsContext} />

        {/* Main Content Area (Bottom padding pb-16 on small screens for PWA bottom nav) */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>

        {/* PWA Mobile Bottom Tab Navigation Bar (Mobile: flex, Desktop: hidden) */}
        <BottomMobileNav />
      </body>
    </html>
  );
}
