import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'New Wave Agency | Frictionless Action Accounting',
  description: 'Action-oriented accounting and invoice generator for agencies, creators, and e-commerce operators. Hide the math, highlight the actions.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
