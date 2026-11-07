import type { Metadata } from 'next';
import Link from 'next/link';
import { createPublicClient } from '@/lib/supabase/public';
import { PricingClient, type PricingPlan } from '@/components/pricing/PricingClient';
import { SiteHeader } from '@/components/layout/SiteHeader';
import SignalOffre from '@/components/crm/SignalOffre';

export const metadata: Metadata = {
  title: 'Tarifs',
  description: 'Formules Gratuit, Premium et Platinium de WESTBOURSE : cours, signaux, rapports et alertes sur la BRVM.',
};
export const revalidate = 300;

export default async function PricingPage() {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('subscription_plans')
    .select('code, name, price_monthly, price_quarterly, price_yearly, is_recommended')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const plans: PricingPlan[] = (data ?? []).map((p) => ({
    code: p.code as string,
    name: p.name as string,
    price_monthly: Number(p.price_monthly ?? 0),
    price_quarterly: p.price_quarterly == null ? null : Number(p.price_quarterly),
    price_yearly: p.price_yearly == null ? null : Number(p.price_yearly),
    is_recommended: Boolean(p.is_recommended),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <SignalOffre page="/pricing" />
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-12 md:px-6 md:pt-16">
        {plans.length > 0 ? (
          <PricingClient plans={plans} />
        ) : (
          <div className="max-w-xl py-16">
            <h1 className="font-display text-3xl font-medium text-ivory">Formules et tarifs</h1>
            <p className="mt-4 text-sm text-muted">
              Les formules ne sont pas encore publiées. Le plan Gratuit reste accessible en créant un compte.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex min-h-[44px] items-center rounded-lg border border-border px-4 text-sm font-medium text-ivory transition-colors hover:border-accent/40"
            >
              Créer un compte
            </Link>
          </div>
        )}
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-faint md:flex-row md:items-center md:justify-between md:px-6">
          <p>Cours issus de la BRVM et des publications officielles. Aucun texte d’analyse n’est rédigé sans les chiffres qui le fondent.</p>
          <nav aria-label="Informations légales" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/cgu" className="underline-offset-2 transition-colors hover:text-muted hover:underline">Conditions générales</Link>
            <Link href="/mentions-legales" className="underline-offset-2 transition-colors hover:text-muted hover:underline">Mentions légales</Link>
            <Link href="/confidentialite" className="underline-offset-2 transition-colors hover:text-muted hover:underline">Confidentialité</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
