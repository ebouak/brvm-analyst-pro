import type { Metadata, Viewport } from 'next';
import './globals.css';
import ConditionalShell from '@/components/ConditionalShell';
import CommandPaletteProvider from '@/components/CommandPaletteProvider';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import OnboardingModal from '@/components/OnboardingModal';
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

  let onboardingDone = true;
  if (user) {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('onboarding_done')
      .eq('id', user.id)
      .maybeSingle();
    onboardingDone = profileRow?.onboarding_done ?? false;
  }

  return (
    <html lang="fr" className="dark">
      <body className="text-white antialiased font-sans">
        <ConditionalShell isPremium={isPremium}>{children}</ConditionalShell>
        <CommandPaletteProvider />
        <ServiceWorkerRegister />
        {user && !onboardingDone && <OnboardingModal />}
      </body>
    </html>
  );
}
