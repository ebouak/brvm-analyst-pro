import type { Metadata, Viewport } from 'next';
import './globals.css';
import ConditionalShell from '@/components/ConditionalShell';
import CommandPaletteProvider from '@/components/CommandPaletteProvider';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import OnboardingModal from '@/components/OnboardingModal';
import { BeginnerModeProvider } from '@/lib/beginner-mode';
import { ConsentProvider } from '@/components/consent/ConsentProvider';
import SplashScreen from '@/components/brand/SplashScreen';
import { CookieBanner } from '@/components/consent/CookieBanner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  // UX fix: template de titre pour que chaque page affiche "Page | WESTBOURSE".
  title: { default: 'WESTBOURSE', template: '%s | WESTBOURSE' },
  description: "Plateforme d'analyse et d'aide à la décision d'investissement sur la BRVM (UEMOA).",
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WESTBOURSE',
  },
};

export const viewport: Viewport = {
  themeColor: '#07080a',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = user?.email === 'ebouak@gmail.com';
  let isPremium = isAdmin;
  let onboardingDone = true;
  let initialBeginner = false;
  if (user && !isPremium) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium, onboarding_done, mode_debutant')
      .eq('id', user.id)
      .maybeSingle();
    isPremium = profile?.is_premium ?? false;
    onboardingDone = profile?.onboarding_done ?? false;
    initialBeginner = profile?.mode_debutant ?? false;
  } else if (user && isPremium) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_done, mode_debutant')
      .eq('id', user.id)
      .maybeSingle();
    onboardingDone = profile?.onboarding_done ?? true; // superadmin = skip onboarding
    initialBeginner = profile?.mode_debutant ?? false;
  }

  return (
    <html lang="fr" className="dark">
      <body className="text-white antialiased font-sans">
        <SplashScreen />
        <ConsentProvider>
          <BeginnerModeProvider initial={initialBeginner}>
            <ConditionalShell isPremium={isPremium} isAdmin={isAdmin}>{children}</ConditionalShell>
            <CommandPaletteProvider />
            <ServiceWorkerRegister />
            {user && !onboardingDone && <OnboardingModal />}
            <CookieBanner />
          </BeginnerModeProvider>
        </ConsentProvider>
      </body>
    </html>
  );
}
