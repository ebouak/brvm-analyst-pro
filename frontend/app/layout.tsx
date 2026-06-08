import type { Metadata, Viewport } from 'next';
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import ConditionalShell from '@/components/ConditionalShell';
import CommandPaletteProvider from '@/components/CommandPaletteProvider';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import { createClient } from '@/lib/supabase/server';

// ── Système typographique premium ────────────────────────────────────────────
// Display noble (serif à caractère) — titres et moments de marque.
const fontDisplay = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
// Body distinctif mais très lisible — texte courant et UI (remplace Inter).
const fontSans = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});
// Données chiffrées — tabulaire.
const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

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
  themeColor: '#07080a',
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
    <html lang="fr" className={`dark ${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}>
      <body className="bg-bg text-white antialiased font-sans">
        <ConditionalShell isPremium={isPremium}>{children}</ConditionalShell>
        <CommandPaletteProvider />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
