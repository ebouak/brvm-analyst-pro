import type { Metadata, Viewport } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import CommandPaletteProvider from '@/components/CommandPaletteProvider';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  // UX fix: template de titre pour que chaque page affiche "Page | BRVM Analyst Pro".
  title: { default: 'BRVM Analyst Pro', template: '%s | BRVM Analyst Pro' },
  description: "Plateforme d'analyse et d'aide à la décision d'investissement sur la BRVM (UEMOA).",
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BRVM Analyst',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f1117',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isPremium = user?.email === 'ebouak@gmail.com';
  if (user && !isPremium) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', user.id)
      .single();
    isPremium = profile?.is_premium ?? false;
  }

  return (
    <html lang="fr" className="dark">
      <body className="bg-bg text-white antialiased">
        <div className="flex min-h-screen">
          <Sidebar isPremium={isPremium} />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
        <CommandPaletteProvider />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
