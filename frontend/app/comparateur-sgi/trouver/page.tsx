import type { Metadata } from 'next';
import { Target } from 'lucide-react';
import SgiMatchmaker from '@/components/comparateur-sgi/SgiMatchmaker';
import { CadreComparateur } from '@/components/comparateur-sgi/cadre/Cadre';
import { chargerSgi } from '@/lib/sgi-frais/chargement';

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: 'Trouver ma SGI — questionnaire BRVM',
  description:
    'Cinq questions pour classer les SGI de la BRVM selon votre profil : pays, capital, fréquence des ordres, autonomie et priorité. Chaque point du classement est expliqué.',
  alternates: { canonical: `${SITE_URL}/comparateur-sgi/trouver` },
};

export default async function TrouverPage() {
  const { directory, frais, stats } = await chargerSgi();
  return (
    <CadreComparateur
      nbSgi={stats.sgi}
      entete={{
        titre: 'Trouver ma SGI',
        sousTitre: 'Cinq questions pour classer les SGI selon votre profil d’investisseur. Chaque point du classement est expliqué.',
        icone: Target,
        filAriane: true,
      }}
    >
      <SgiMatchmaker directory={directory} frais={frais} />
    </CadreComparateur>
  );
}
