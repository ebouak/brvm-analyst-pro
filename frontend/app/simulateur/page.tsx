import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import PublicShell from '@/components/public/PublicShell';
import SimulatorClient from '@/components/public/SimulatorClient';
import EtMaintenant from '@/components/navigation/EtMaintenant';

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: 'Simulateur BRVM — Et si vous aviez investi ?',
  description:
    "Calculez ce qu'aurait rapporté un investissement dans une action BRVM (SONATEL, SGBCI, PALC…) : plus-value, dividendes perçus et rendement annualisé. Gratuit.",
  alternates: { canonical: `${SITE_URL}/simulateur` },
};

export default async function SimulatorPage() {
  const supabase = createPublicClient();
  const { data: instruments } = await supabase
    .from('brvm_instruments')
    .select('code, designation')
    .eq('type', 'action')
    .eq('actif', true)
    .order('designation');

  return (
    <PublicShell>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl md:text-3xl text-ivory mb-2">
            Et si vous aviez investi&nbsp;?
          </h1>
          <p className="text-muted text-sm leading-relaxed">
            Découvrez ce qu&apos;un investissement dans une société cotée à la BRVM aurait rapporté —
            dividendes inclus.
          </p>
        </div>
        <SimulatorClient companies={instruments ?? []} />
        <EtMaintenant suites={[
                { href: '/societes', titre: 'Les sociétés', detail: 'Les fiches des valeurs cotées.' },
                { href: '/methodologie', titre: 'Notre méthode', detail: 'Comment les chiffres sont calculés.' },
                { href: '/pricing', titre: 'Les offres', detail: 'Ce que comprend chaque formule.' },
              ]} />
      </div>
    </PublicShell>
  );
}
