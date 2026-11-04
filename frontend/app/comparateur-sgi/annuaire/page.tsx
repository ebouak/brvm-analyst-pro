import type { Metadata } from 'next';
import { BookOpen } from 'lucide-react';
import { AnnuaireSgi } from '@/components/comparateur-sgi/annuaire/AnnuaireSgi';
import { CadreComparateur } from '@/components/comparateur-sgi/cadre/Cadre';
import { chargerSgi } from '@/lib/sgi-frais/chargement';

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: 'Annuaire des SGI de la BRVM — coordonnées et barèmes',
  description:
    'Toutes les SGI agréées de la BRVM par pays : coordonnées officielles, courtage homologué, dépôt minimum indicatif et liens vers leurs barèmes.',
  alternates: { canonical: `${SITE_URL}/comparateur-sgi/annuaire` },
};

export default async function AnnuairePage() {
  const { directory, frais, stats } = await chargerSgi();
  return (
    <CadreComparateur
      nbSgi={stats.sgi}
      entete={{
        titre: 'Annuaire des SGI',
        sousTitre: `Les ${stats.sgi} SGI référencées, leurs coordonnées officielles et leurs conditions tarifaires.`,
        icone: BookOpen,
        filAriane: true,
      }}
    >
      <AnnuaireSgi directory={directory} frais={frais} />
    </CadreComparateur>
  );
}
