import type { Metadata } from 'next';
import SgiComparator from '@/components/landing/SgiComparator';
import { VueEnsemble } from '@/components/comparateur-sgi/vue/VueEnsemble';
import { RedirectionAncres } from '@/components/comparateur-sgi/vue/RedirectionAncres';
import { CadreComparateur } from '@/components/comparateur-sgi/cadre/Cadre';
import { chargerSgi } from '@/lib/sgi-frais/chargement';
import { syntheseVueEnsemble } from '@/lib/sgi-frais/vueEnsemble';
import { SCENARIO_DEFAUT } from '@/lib/sgi-frais/scenario';
import { fmtFcfa } from '@/lib/sgi-frais/comparaison';

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
        bande: {
          titre: `Coût estimé par SGI pour ${fmtFcfa(SCENARIO_DEFAUT.montant)} sur un an`,
          // Barèmes complets seulement, dans l'ordre du classement : un coût
          // sous-estimé n'a pas sa place dans une vitrine.
          elements: syntheseVueEnsemble(directory, frais, SCENARIO_DEFAUT)
            .classement.filter((l) => l.complet)
            .map((l) => ({
              libelle: l.sgi.nom,
              valeur: fmtFcfa(l.cout.total),
              detail: l.frais.confiance === 'homologue_crepmf' ? 'barème homologué' : 'à confirmer',
            })),
        },
      }}
    >
      <RedirectionAncres />
      <VueEnsemble directory={directory} frais={frais} />
      <div className="mt-12">
        <SgiComparator />
      </div>
    </CadreComparateur>
  );
}
