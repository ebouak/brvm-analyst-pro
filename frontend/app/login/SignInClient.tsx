'use client';

// Branche le composant animé SignInPage sur l'auth Supabase :
// OTP e-mail (code 6 chiffres) qui gère connexion ET inscription
// (shouldCreateUser), plus OAuth Google. Aucune dépendance Supabase
// dans le composant UI : tout passe par ces handlers.
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SignInPage } from '@/components/ui/sign-in-flow-1';

export default function SignInClient({
  subscribeNewsletter = false,
  subtitle = 'Connexion ou inscription',
}: {
  /** Abonne l'e-mail à la newsletter après une première vérification réussie (flux signup). */
  subscribeNewsletter?: boolean;
  subtitle?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  return (
    <SignInPage
      showNavbar={false}
      // Doit correspondre au réglage Supabase « Email OTP Length ».
      codeLength={8}
      // Cyan DeFi pour coller au thème.
      dotColors={[
        [86, 215, 253],
        [86, 215, 253],
      ]}
      title="WESTBOURSE"
      subtitle={subtitle}
      showNewsletterOptIn={subscribeNewsletter}
      onGoogle={async () => {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          },
        });
      }}
      onRequestCode={async (email) => {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase().trim(),
          options: { shouldCreateUser: true },
        });
        if (error) return { error: error.message };
      }}
      onResend={async (email) => {
        await supabase.auth.signInWithOtp({
          email: email.toLowerCase().trim(),
          options: { shouldCreateUser: true },
        });
      }}
      onVerifyCode={async (token, email, opts) => {
        const normalized = email.toLowerCase().trim();
        const { error } = await supabase.auth.verifyOtp({
          email: normalized,
          token,
          type: 'email',
        });
        if (error) return { error: error.message };
        // Flux signup : abonnement newsletter si la case est cochée (best-effort).
        if (subscribeNewsletter && opts?.newsletter) {
          void fetch('/api/newsletter/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalized, source: 'signup' }),
          }).catch(() => null);
        }
      }}
      onSuccess={() => {
        router.push('/dashboard');
        router.refresh();
      }}
    />
  );
}
