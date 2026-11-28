import type { Metadata } from 'next';
import { createPublicClient } from '@/lib/supabase/public';
import { chargerDonneesCrises } from '@/lib/stress/lecture';
import { EnTeteCote } from '@/components/marche/EnTeteCote';
import { StressSubNav } from '@/components/stress/StressSubNav';
import { CouvertureDonneesBanner } from '@/components/stress/CouvertureDonneesBanner';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Méthodologie & données · BRVM Market Stress Monitor',
  description:
    'Formules exactes, pondérations, sources de données, règles anti-biais et gouvernance statistique du BRVM Market Stress Monitor.',
  alternates: { canonical: '/stress-monitor/methodologie' },
};

export default async function StressMethodologiePage() {
  const sb = createPublicClient();
  const data = await chargerDonneesCrises(sb);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <EnTeteCote
        titre="Méthodologie, formules & gouvernance des données"
        description="Transparence intégrale sur les sources, les calculs, les limites de couverture et les garde-fous anti-biais du module."
        seance={data.derniere_seance}
        source="Documentation technique WESTBOURSE"
      />

      <StressSubNav actif="methodologie" />

      <div className="mt-8 space-y-6 text-xs leading-relaxed text-muted">
        <section className="rounded-panel border border-border bg-surface p-5 space-y-3">
          <h2 className="text-base font-semibold text-ivory">1. Indice quotidien de tension (0–100)</h2>
          <p>
            L&apos;indice de tension mesure de façon contemporaine l&apos;intensité de la pression baissière sur la
            BRVM entre <span className="tabular text-ivory">0</span> (marché calme au voisinage de ses sommets) et{' '}
            <span className="tabular text-ivory">100</span> (tension extrême généralisée). Il ne prédit pas la direction
            future des cours.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full text-left">
              <thead className="border-b border-border bg-sunken text-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Composante</th>
                  <th className="px-3 py-2 text-right font-medium">Poids nominal</th>
                  <th className="px-3 py-2 font-medium">Normalisation 0–100 (bornée)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 text-ivory">Drawdown du BRVM Composite</td>
                  <td className="tabular px-3 py-2 text-right">25 %</td>
                  <td className="px-3 py-2">Linéaire de 0 % (score 0) à −35 % de drawdown (score 100)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 text-ivory">Largeur baissière (5 séances)</td>
                  <td className="tabular px-3 py-2 text-right">20 %</td>
                  <td className="px-3 py-2">Part moyenne de titres en baisse : 25 % → 0 ; 80 % → 100</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 text-ivory">Volatilité réalisée BRVM-V</td>
                  <td className="tabular px-3 py-2 text-right">15 %</td>
                  <td className="px-3 py-2">Rang centile empirique 0–100 de BRVM-V (repli sur vol. 20j BRVMC)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 text-ivory">Diffusion sectorielle (20 séances)</td>
                  <td className="tabular px-3 py-2 text-right">15 %</td>
                  <td className="px-3 py-2">Part de la capitalisation totale appartenant à un secteur en recul sur 20j</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="px-3 py-2 text-ivory">Volumes sur titres en baisse (5 séances)</td>
                  <td className="tabular px-3 py-2 text-right">15 %</td>
                  <td className="px-3 py-2">Ratio volumes baissiers / volumes totaux : 20 % → 0 ; 85 % → 100</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-ivory">Momentum court terme (20 séances)</td>
                  <td className="tabular px-3 py-2 text-right">10 %</td>
                  <td className="px-3 py-2">Variation 20 séances du BRVMC : ≥ 0 % → 0 ; ≤ −12 % → 100</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Lorsqu&apos;une composante n&apos;est pas observable à une date ancienne, son poids est redistribué
            proportionnellement aux composantes actives et le <strong className="text-ivory">taux de couverture</strong>{' '}
            exact est affiché.
          </p>
        </section>

        <section className="rounded-panel border border-border bg-surface p-5 space-y-2">
          <h2 className="text-base font-semibold text-ivory">2. Détection des crises & sources historiques</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-ivory">Drawdown causal :</strong> à chaque séance <code>t</code>,{' '}
              <code>DD(t) = (Indice(t) / max(Indice[0..t]) - 1) × 100</code>. Aucune donnée postérieure à{' '}
              <code>t</code> n&apos;intervient.
            </li>
            <li>
              <strong className="text-ivory">Clôture d&apos;un épisode :</strong> un épisode n&apos;est déclaré terminé
              qu&apos;après retour au sommet précédent maintenu pendant 5 séances consécutives, évitant de fragmenter
              une même crise lors de rebonds techniques intermédiaires.
            </li>
            <li>
              <strong className="text-ivory">Isolation des sources :</strong> les clôtures officielles récentes (
              <code>brvm_indices_daily</code>) sont prioritaires ; l&apos;historique profond pré-mai 2026 (
              <code>stress_indices_history</code>, BRVMC depuis janvier 2007, BRVM-30 et Prestige depuis 2023) est stocké
              dans une table dédiée sans jamais écraser les relevés officiels ni reconstituer un indice avant sa date de
              création.
            </li>
            <li>
              <strong className="text-ivory">Séries BCEAO séparées :</strong> le{' '}
              <em>taux minimum de soumission aux appels d&apos;offres</em> (<code>bceao_taux_directeur</code>) et le{' '}
              <em>taux du guichet de prêt marginal</em> (<code>bceao_guichet_marginal</code>) sont stockés séparément
              afin de refléter fidèlement l&apos;élargissement du corridor monétaire du 16 décembre 2016 (+100 pb →
              +200 pb) sans créer de baisse fictive du taux directeur.
            </li>
          </ul>
        </section>

        <section className="rounded-panel border border-border bg-surface p-5 space-y-2">
          <h2 className="text-base font-semibold text-ivory">3. Règles anti-biais & gouvernance des signaux</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-ivory">Gouvernance stricte sur les signaux :</strong> conformément à la charte
              quantitative WESTBOURSE, aucun indicateur n&apos;est présenté comme un signal d&apos;achat ou de « reprise
              confirmée » sans preuve statistique hors échantillon au banc d&apos;évaluation (intervalle bootstrap 95 %
              excluant zéro sur au moins 30 cas indépendants). Le test sur 2007–2026 ayant conclu{' '}
              <code>non_prouve</code>, seuls les faits observés bruts sont exposés.
            </li>
            <li>
              <strong className="text-ivory">Ajustement des fractionnements sans double comptage :</strong> avant
              d&apos;ajuster une série d&apos;action pour un split connu, le moteur vérifie empiriquement la présence du
              saut de cours autour de la date d&apos;effet afin de ne jamais ré-ajuster une série déjà corrigée en base.
            </li>
            <li>
              <strong className="text-ivory">Dé-chevauchement & petits échantillons :</strong> dans les statistiques de
              rebond à horizon <code>h</code>, le mode indépendant impose un espacement minimal de{' '}
              <code>max(90 jours, h)</code> entre deux entrées. En dessous de <code>N = 5</code> observations, aucun
              intervalle de confiance n&apos;est extrapolé.
            </li>
            <li>
              <strong className="text-ivory">Lag de publication des états financiers :</strong> en backtesting
              multi-actions, les comptes annuels de l&apos;exercice <code>Y</code> ne sont réputés connus qu&apos;à
              compter du <code>1er juillet Y+1</code> en l&apos;absence de date de publication horodatée.
            </li>
          </ul>
        </section>
      </div>

      <CouvertureDonneesBanner couverture={data.couverture} sourceMode={data.source_mode} />
    </div>
  );
}
