import type { Metadata } from 'next';
import SgiComparator from '@/components/landing/SgiComparator';
import SgiMatchmaker from '@/components/comparateur-sgi/SgiMatchmaker';
import { CadreComparateur } from '@/components/comparateur-sgi/cadre/Cadre';
import { chargerSgi } from '@/lib/sgi-frais/chargement';

// ISR : données SGI lues depuis Supabase (repli sur les fichiers TS si vide),
// revalidées chaque heure — l'annuaire change rarement.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: 'Comparateur des SGI BRVM — choisir son courtier UEMOA',
  description:
    "Annuaire et comparateur des SGI agréées à la BRVM, classées par pays UEMOA : Côte d'Ivoire, Sénégal, Burkina Faso, Mali, Bénin, Togo, Niger. Barèmes homologués, coût réel simulé et critères pour choisir votre courtier.",
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
      'Toutes les SGI de la BRVM par pays : barèmes homologués, coût réel simulé, coordonnées officielles.',
    url: `${SITE_URL}/comparateur-sgi`,
  },
};

export default async function ComparateurSgiPage() {
  const { directory, frais, stats } = await chargerSgi();
  return (
    <CadreComparateur
      nbSgi={stats.sgi}
      entete={{
        titre: 'Comparateur de SGI',
        sousTitre: 'Trouvez la SGI adaptée à votre profil, simulez vos frais et comparez les intermédiaires de la BRVM.',
        stats,
      }}
    >
      <div className="mb-10">
        <SgiMatchmaker directory={directory} frais={frais} />
      </div>
      <SgiComparator directory={directory} frais={frais} />
    </CadreComparateur>
  );
}
