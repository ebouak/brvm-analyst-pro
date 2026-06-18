import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDcfData } from '@/lib/dcf/server';
import DcfClient from '@/components/premium/DcfClient';
import { SectionHeader, StatPill, EmptyStatePremium } from '@/components/ui/premium';

interface Props { params: { code: string } }

export const metadata = { title: 'Valorisation DCF — WESTBOURSE' };

export default async function DcfPage({ params }: Props) {
  const code = params.code.toUpperCase();
  const supa = createClient();

  // Gating premium : super-admin OU profiles.is_premium (cohérent avec le shell).
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect('/login');
  const isAdmin = user.email === 'ebouak@gmail.com';
  let isPremium = isAdmin;
  if (!isPremium) {
    const { data: profile } = await supa.from('profiles').select('is_premium').eq('id', user.id).single();
    isPremium = profile?.is_premium ?? false;
  }

  const data = await getDcfData(code);
  if (!data) notFound();

  const Breadcrumb = (
    <div className="flex items-center gap-2 text-sm">
      <Link href="/actions" className="text-muted hover:text-white transition-colors">Marché</Link>
      <span className="text-faint">/</span>
      <Link href={`/actions/${code}/financials`} className="text-muted hover:text-white transition-colors">{code}</Link>
      <span className="text-faint">/</span>
      <span className="text-white">Valorisation DCF</span>
    </div>
  );

  if (!isPremium) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {Breadcrumb}
        <EmptyStatePremium
          icon="✦"
          title="Valorisation DCF — réservé aux abonnés Premium"
          hint="Accédez à la juste-valeur par flux actualisés (WACC/MEDAF), aux hypothèses ajustables et à la table de sensibilité."
        />
        <div className="text-center">
          <Link href="/premium/upgrade" className="inline-block px-6 py-2.5 bg-info text-bg rounded-xl text-sm font-medium hover:bg-info/90 transition-colors">
            Passer Premium
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {Breadcrumb}
      <SectionHeader
        kicker={data.secteur ?? 'BRVM'}
        title={`${data.code}${data.designation ? ` — ${data.designation}` : ''}`}
        subtitle={`Valorisation par flux de trésorerie actualisés. WACC dérivé du MEDAF (rf ${data.meta.riskFreeSource === 'souverain' ? 'souverain réel' : 'de repli'}, prime de risque ${data.meta.riskPremiumCountry}${data.meta.moodyRating ? ` — ${data.meta.moodyRating}` : ''}). ${data.meta.fcfYears} exercice(s) de flux, ${data.meta.betaObs} observations pour le bêta.`}
        actions={<StatPill tone="gold">✦ Premium</StatPill>}
      />

      {data.meta.available ? (
        <DcfClient
          raw={data.raw}
          defaults={data.defaults}
          countries={data.countries}
          meta={data.meta}
          cours={data.raw.cours}
        />
      ) : (
        <EmptyStatePremium
          icon="◎"
          title="Données insuffisantes pour un DCF"
          hint="Il faut au moins un exercice de flux de trésorerie et le nombre d'actions. Aucune valeur n'est inventée : importez les états financiers manquants pour activer la valorisation."
        />
      )}
    </div>
  );
}
