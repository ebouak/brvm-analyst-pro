import type { Metadata } from 'next';
import { Scale } from 'lucide-react';
import { CadreComparateur } from '@/components/comparateur-sgi/cadre/Cadre';
import { ComparerSgi } from '@/components/comparateur-sgi/comparer/ComparerSgi';
import { chargerSgi } from '@/lib/sgi-frais/chargement';

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: 'Comparer les SGI de la BRVM côte à côte',
  description:
    "Comparez jusqu'à trois SGI de la BRVM sur votre scénario : coût total, courtage, droits de garde, tenue de compte et barème officiel.",
  alternates: { canonical: `${SITE_URL}/comparateur-sgi/comparer` },
};

export default async function ComparerPage() {
  const { directory, frais, stats } = await chargerSgi();
  return (
    <CadreComparateur
      nbSgi={stats.sgi}
      entete={{
        titre: 'Comparer les SGI',
        sousTitre: 'Jusqu’à trois SGI côte à côte, sur votre montant et votre rythme d’ordres, frais réglementaires compris.',
        icone: Scale,
        filAriane: true,
      }}
    >
      <ComparerSgi directory={directory} frais={frais} />
    </CadreComparateur>
  );
}
