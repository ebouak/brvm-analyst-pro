import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import PublicShell from '@/components/public/PublicShell';
import SimulatorClient from '@/components/public/SimulatorClient';
import EtMaintenant from '@/components/navigation/EtMaintenant';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ montant?: string; annees?: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const code = decodeURIComponent(params.code).toUpperCase();
  const supabase = createPublicClient();
  const { data: instr } = await supabase
    .from('brvm_instruments')
    .select('designation')
    .eq('code', code)
    .maybeSingle();
  if (!instr) return { title: 'Simulateur' };

  const title = `Et si vous aviez investi dans ${instr.designation} (${code}) ?`;
  const description = `Simulez un investissement dans l'action ${instr.designation} cotée à la BRVM : plus-value, dividendes perçus, rendement annualisé.`;

  // OG image dynamique avec le résultat si les paramètres de partage sont présents
  const og = new URLSearchParams({ code });
  if (searchParams.montant) og.set('montant', searchParams.montant);
  if (searchParams.annees) og.set('annees', searchParams.annees);

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/simulateur/${code}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/simulateur/${code}`,
      images: [{ url: `${SITE_URL}/api/og/simulateur?${og.toString()}`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function SimulatorCodePage(props: PageProps) {
  const params = await props.params;
  const code = decodeURIComponent(params.code).toUpperCase();
  const supabase = createPublicClient();
  const [{ data: instr }, { data: instruments }] = await Promise.all([
    supabase.from('brvm_instruments').select('code, designation').eq('code', code).maybeSingle(),
    supabase
      .from('brvm_instruments')
      .select('code, designation')
      .eq('type', 'action')
      .eq('actif', true)
      .order('designation'),
  ]);
  if (!instr) notFound();

  return (
    <PublicShell>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl md:text-3xl text-ivory mb-2">
            Et si vous aviez investi dans {instr.designation}&nbsp;?
          </h1>
        </div>
        <SimulatorClient companies={instruments ?? []} initialCode={code} />
        <EtMaintenant suites={[
                { href: `/societes/${code}`, titre: 'La fiche de la société', detail: 'Cours, dividendes et fondamentaux.' },
                { href: '/simulateur', titre: 'Une autre société', detail: 'Refaire la simulation sur un autre titre.' },
                { href: '/societes', titre: 'Toutes les sociétés', detail: 'Les valeurs cotées à la BRVM.' },
              ]} />
      </div>
    </PublicShell>
  );
}
