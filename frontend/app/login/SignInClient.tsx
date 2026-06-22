'use client';

// Branche le composant animé SignInPage sur l'auth Supabase :
// OTP e-mail (code 6 chiffres) qui gère connexion ET inscription
// (shouldCreateUser), plus OAuth Google. Aucune dépendance Supabase
// dans le composant UI : tout passe par ces handlers.
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { createClient } from '@/lib/supabase/client';
import { SignInPage } from '@/components/ui/sign-in-flow-1';

// Clé de site Turnstile (publique — non secrète). Surchargée par l'env si présente.
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '0x4AAAAAADpSU7m2sA8VJr-l';

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
  const captchaRef = useRef<TurnstileInstance | null>(null);
  const tokenRef = useRef<string>('');

  // Jeton CAPTCHA frais (les jetons Turnstile sont à usage unique).
  const freshToken = async (): Promise<string> => {
    if (tokenRef.current) return tokenRef.current;
    // Force une exécution et attend le token (max ~5 s).
    captchaRef.current?.execute();
    for (let i = 0; i < 50 && !tokenRef.current; i++) await new Promise((r) => setTimeout(r, 100));
    return tokenRef.current;
  };

  return (
    <>
      <div className="fixed bottom-3 left-1/2 z-50 -translate-x-1/2">
        <Turnstile
          ref={captchaRef}
          siteKey={TURNSTILE_SITE_KEY}
          options={{ theme: 'dark', size: 'flexible' }}
          onSuccess={(t) => { tokenRef.current = t; }}
          onExpire={() => { tokenRef.current = ''; captchaRef.current?.reset(); }}
          onError={() => { tokenRef.current = ''; }}
        />
      </div>
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
        const captchaToken = await freshToken();
        if (!captchaToken) return { error: 'Vérification anti-robot en cours, réessayez dans un instant.' };
        const { error } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase().trim(),
          options: { shouldCreateUser: true, captchaToken },
        });
        tokenRef.current = ''; captchaRef.current?.reset(); // jeton à usage unique
        if (error) return { error: error.message };
      }}
      onResend={async (email) => {
        const captchaToken = await freshToken();
        await supabase.auth.signInWithOtp({
          email: email.toLowerCase().trim(),
          options: { shouldCreateUser: true, captchaToken },
        });
        tokenRef.current = ''; captchaRef.current?.reset();
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
    </>
  );
}
