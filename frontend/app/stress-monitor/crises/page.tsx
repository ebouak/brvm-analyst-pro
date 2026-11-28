import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { chargerDonneesCrises } from '@/lib/stress/lecture';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { EmptyStatePremium, MetricCard, PremiumPanel } from '@/components/ui/premium';
import { StressSubNav } from '@/components/stress/StressSubNav';
import { ComparateurCrisesChart } from '@/components/stress/ComparateurCrisesChart';
import { TableauCrises } from '@/components/stress/TableauCrises';
import { CouvertureDonneesBanner } from '@/components/stress/CouvertureDonneesBanner';
import { fmtNumber, fmtPctSigne } from '@/lib/format';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Crises historiques de la BRVM · BRVM Market Stress Monitor',
  description:
    'Reconstitution et comparaison algorithmique des corrections et crises de la BRVM depuis 1998 : amplitude, durée, reprise et similarité.',
  alternates: { canonical: '/stress-monitor/crises' },
};

export default async function StressCrisesPage() {
  const sb = createPublicClient();
  const data = await chargerDonneesCrises(sb);

  const episodesBrvmc10 = data.episodes.filter(
    (e) => e.indice_code === 'BRVMC' && Number(e.seuil_pct) === -10,
  );
  const episodesComparateur =
    episodesBrvmc10.length > 0
      ? episodesBrvmc10
      : data.episodes.filter((e) => Number(e.seuil_pct) === -10);

  const pireEpisode =
    [...episodesComparateur].sort((a, b) => a.perte_max_pct - b.perte_max_pct)[0] ?? null;

  const delaisRecup = episodesComparateur
    .map((e) => e.duree_totale_recuperation_jours)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const recupMoy =
    delaisRecup.length > 0
      ? Math.round(delaisRecup.reduce((a, b) => a + b, 0) / delaisRecup.length)
      : null;

  const rebonds12m = episodesComparateur
    .map((e) => e.rebond_12m_pct)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const rebond12mMoy =
    rebonds12m.length > 0
      ? rebonds12m.reduce((a, b) => a + b, 0) / rebonds12m.length
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <EnTeteCote
        titre="Crises historiques de la BRVM"
        description="Détection algorithmique des épisodes de drawdown, trajectoires comparées base 100 et scores de similarité."
        seance={data.derniere_seance}
        compte={{ n: data.episodes.length, libelle: 'épisodes détectés (tous seuils)' }}
        source="Source BRVM & WESTBOURSE"
      />

      <StressSubNav actif="crises" />

      {data.episodes.length === 0 ? (
        <div className="mt-8">
          <EmptyStatePremium
            title="Aucun épisode détecté"
            hint="Exécutez l'import historique et le moteur de détection pour alimenter le registre des crises."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* KPIs historiques */}
          <section aria-labelledby="crises-kpis" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <h2 id="crises-kpis" className="sr-only">Indicateurs clés des crises historiques</h2>
            <MetricCard
              label="Corrections ≥ 10 % (BRVM Composite)"
              value={fmtNumber(episodesComparateur.length, 0)}
              unit="épisodes"
              accent="gold"
            />
            <MetricCard
              label="Pire drawdown observé"
              value={pireEpisode ? fmtPctSigne(pireEpisode.perte_max_pct, 2) : '—'}
              delta={pireEpisode ? pireEpisode.libelle : undefined}
              deltaDir={pireEpisode ? 'down' : 'flat'}
            />
            <MetricCard
              label="Délai moyen de récupération"
              value={recupMoy != null ? `${fmtNumber(recupMoy, 0)} j` : '—'}
              delta={
                delaisRecup.length > 0
                  ? `Sur ${delaisRecup.length} épisode(s) clôturé(s)`
                  : 'Aucune crise terminée sur la plage'
              }
              deltaDir="flat"
            />
            <MetricCard
              label="Rebond moyen 12M post-creux"
              value={rebond12mMoy != null ? fmtPctSigne(rebond12mMoy, 1) : '—'}
              delta={
                rebonds12m.length > 0
                  ? `Sur ${rebonds12m.length} observation(s) valides`
                  : 'Historique insuffisant'
              }
              deltaDir={rebond12mMoy != null && rebond12mMoy >= 0 ? 'up' : 'flat'}
            />
          </section>

          {/* Comparateur graphique */}
          <PremiumPanel className="p-5">
            <ComparateurCrisesChart episodes={episodesComparateur} />
          </PremiumPanel>

          {/* Registre complet et fiches détaillées */}
          <section aria-labelledby="registre-crises-titre" className="space-y-3">
            <h2 id="registre-crises-titre" className="text-base font-semibold text-ivory">
              Registre des épisodes & fiches détaillées
            </h2>
            <p className="text-xs text-muted">
              Cliquez sur une ligne pour consulter la chronologie, le contexte de marché, le contexte macroéconomique UEMOA et la décomposition du score de similarité.
            </p>
            <TableauCrises episodes={data.episodes} />
          </section>
        </div>
      )}

      <CouvertureDonneesBanner couverture={data.couverture} sourceMode={data.source_mode} />
    </div>
  );
}
