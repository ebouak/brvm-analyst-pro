import type { Metadata } from 'next';
import PublicShell from '@/components/public/PublicShell';
import SgiComparator from '@/components/landing/SgiComparator';
import SgiMatchmaker from '@/components/comparateur-sgi/SgiMatchmaker';
import { getSgiDirectory, getSgiFrais } from '@/lib/sgi-frais/queries';

// ISR : données SGI lues depuis Supabase (repli sur les fichiers TS si vide),
// revalidées chaque heure — l'annuaire change rarement.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: 'Comparateur des SGI BRVM — choisir son courtier UEMOA | WESTBOURSE',
  description:
    "Annuaire et comparateur des SGI agréées à la BRVM, classées par pays UEMOA : Côte d'Ivoire, Sénégal, Burkina Faso, Mali, Bénin, Togo, Niger. Type, groupe, dépôt minimum indicatif et critères pour choisir votre courtier.",
  keywords: [
    'SGI BRVM',
    'comparateur SGI',
    'liste SGI UEMOA',
    'courtier BRVM',
    'ouvrir compte titres BRVM',
    'dépôt minimum SGI',
    "SGI Côte d'Ivoire",
    'SGI Sénégal',
  ],
  alternates: { canonical: `${SITE_URL}/comparateur-sgi` },
  openGraph: {
    type: 'website',
    title: 'Comparateur des SGI BRVM — choisir son courtier UEMOA',
    description:
      'Toutes les SGI de la BRVM par pays. Comparez type, groupe et dépôt minimum indicatif pour choisir votre courtier UEMOA.',
    url: `${SITE_URL}/comparateur-sgi`,
  },
};

export default async function ComparateurSgiPage() {
  const [directory, frais] = await Promise.all([getSgiDirectory(), getSgiFrais()]);
  return (
    <PublicShell>
      <div className="mb-8">
        <SgiMatchmaker directory={directory} frais={frais} />
      </div>
      <SgiComparator className="scroll-mt-24" directory={directory} frais={frais} />
    </PublicShell>
  );
}
