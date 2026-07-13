import React from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Sign In | Professor Toko Online Accounting Suite',
  description: 'Executive SaaS Accounting Suite & Action-Oriented Invoice Generator',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#0b0c10] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background radial atmosphere matching Luxury Gold & Obsidian Charcoal aesthetic */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-[#d4af37]/10 via-transparent to-[#18233c]/20 rounded-full blur-3xl pointer-events-none" />

      <LoginForm />
    </main>
  );
}
