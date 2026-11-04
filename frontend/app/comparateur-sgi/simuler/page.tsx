import type { Metadata } from 'next';
import { Calculator } from 'lucide-react';
import { CalculateurCout } from '@/components/comparateur-sgi/CalculateurCout';
import { CadreComparateur } from '@/components/comparateur-sgi/cadre/Cadre';
import { chargerSgi } from '@/lib/sgi-frais/chargement';

export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: 'Simuler mes frais de SGI — courtage, garde, BRVM',
  description:
    'Estimez le coût réel d’un investissement en actions BRVM chez chaque SGI : courtage, commissions BRVM et DC/BR, droits de garde, tenue de compte. Barèmes homologués AMF-UMOA.',
  alternates: { canonical: `${SITE_URL}/comparateur-sgi/simuler` },
};

export default async function SimulerPage() {
  const { directory, frais, stats } = await chargerSgi();
  return (
    <CadreComparateur
      nbSgi={stats.sgi}
      entete={{
        titre: 'Simuler mes frais',
        sousTitre: 'Le coût réel de votre investissement chez chaque SGI, poste par poste, d’après les barèmes publiés.',
        icone: Calculator,
        filAriane: true,
      }}
    >
      <CalculateurCout frais={frais} directory={directory} />
    </CadreComparateur>
  );
}
