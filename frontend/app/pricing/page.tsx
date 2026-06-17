import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { PricingClient, type PricingPlan } from '@/components/pricing/PricingClient';
import { AnimatedLogo } from '@/components/brand/AnimatedLogo';

export const metadata: Metadata = {
  title: 'Tarifs',
  description: 'Plans Gratuit, Premium et Platinium — analyse BRVM/UEMOA premium.',
};
export const revalidate = 300;

export default async function PricingPage() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('subscription_plans')
    .select('code, name, price_monthly, price_yearly, is_recommended')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const plans: PricingPlan[] = (data ?? []).map((p) => ({
    code: p.code as string,
    name: p.name as string,
    price_monthly: Number(p.price_monthly ?? 0),
    price_yearly: p.price_yearly == null ? null : Number(p.price_yearly),
    is_recommended: Boolean(p.is_recommended),
  }));

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link href="/" className="flex items-center gap-2" aria-label="WESTBOURSE">
          <AnimatedLogo size={32} variant="mark" animate={false} />
          <span className="font-display font-semibold text-ivory">WESTBOURSE</span>
        </Link>
        <Link href="/login" className="text-sm text-muted transition-colors hover:text-ivory">
          Connexion
        </Link>
      </header>

      {plans.length > 0 ? (
        <PricingClient plans={plans} />
      ) : (
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <p className="text-sm text-muted">Les formules seront bientôt disponibles.</p>
        </div>
      )}
    </div>
  );
}
