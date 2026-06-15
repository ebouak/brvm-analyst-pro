'use client';

// Branche le composant animé SignInPage sur l'auth Supabase :
// OTP e-mail (code 6 chiffres) qui gère connexion ET inscription
// (shouldCreateUser), plus OAuth Google. Aucune dépendance Supabase
// dans le composant UI : tout passe par ces handlers.
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SignInPage } from '@/components/ui/sign-in-flow-1';

export default function SignInClient() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <SignInPage
      showNavbar={false}
      // Cyan DeFi pour coller au thème.
      dotColors={[
        [86, 215, 253],
        [86, 215, 253],
      ]}
      title="BRVM Analyst Pro"
      subtitle="Connexion ou inscription"
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
      onVerifyCode={async (token, email) => {
        const { error } = await supabase.auth.verifyOtp({
          email: email.toLowerCase().trim(),
          token,
          type: 'email',
        });
        if (error) return { error: error.message };
      }}
      onSuccess={() => {
        router.push('/dashboard');
        router.refresh();
      }}
    />
  );
}
