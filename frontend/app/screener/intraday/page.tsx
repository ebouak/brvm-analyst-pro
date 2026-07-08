import { Suspense } from 'react';
import { SectionHeader, EmptyStatePremium } from '@/components/ui/premium';
import IntraDayPatternsTable from '@/components/screener/IntraDayPatternsTable';

export const metadata = {
  title: 'Screener Intraday — WESTBOURSE',
  description: 'Patterns intraday détectés en temps réel',
};

function PatternsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-12 bg-surface border border-border rounded animate-pulse" />
      <div className="h-96 bg-surface border border-border rounded animate-pulse" />
    </div>
  );
}

export default function IntraDayScreenerPage() {
  const todayDate = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader
          kicker="Outils"
          title="Screener Intraday"
          subtitle="Patterns détectés en temps réel via analyse ATR et consolidation"
        />
      </div>

      <Suspense fallback={<PatternsSkeleton />}>
        <IntraDayPatternsTable dateMarche={todayDate} />
      </Suspense>

      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-medium text-ivory mb-3">À propos des patterns détectés</h3>
          <div className="space-y-3 text-sm text-muted">
            <div>
              <p className="font-medium text-ivory mb-1">⚡ ATR Extrême</p>
              <p>
                Pics de volatilité intraday où le prix franchit un multiple de l'ATR (Average True Range).
                Indique une intensité haussière ou baissière soudaine. Seuil: 3× l'ATR sur 14 périodes.
              </p>
            </div>

            <div>
              <p className="font-medium text-ivory mb-1">📊 Consolidation Haussière</p>
              <p>
                Pattern de resserrement avec au moins 3 bougies consécutives à corps serrés (ratio
                hauteur_corps / hauteur_totale &lt; 30%). Signale une accumulation avant un breakout potentiel.
              </p>
            </div>

            <div>
              <p className="font-medium text-ivory mb-1">Δ Conseiller (Impact sur le score)</p>
              <p>
                Ajustement appliqué au score du Conseiller IA basé sur la force du pattern détecté.
                Échelle: -5 (très baissier) à +5 (très haussier). Impact pondéré par la confiance.
              </p>
            </div>

            <div>
              <p className="font-medium text-ivory mb-1">Niveaux de Confiance</p>
              <p>
                <strong>HIGH</strong>: Pattern clairement établi, qualité &gt; 80%, faibles faux positifs.
                <strong className="ml-2">MEDIUM</strong>: Pattern probable, qualité 50-80%, à confirmer.
                <strong className="ml-2">LOW</strong>: Pattern faible, qualité &lt; 50%, utiliser en contexte.
              </p>
            </div>

            <div>
              <p className="font-medium text-ivory mb-1">Mise à jour en temps réel</p>
              <p>
                La page se rafraîchit automatiquement toutes les 30 secondes durant les heures de marché
                (09:00-15:30 heure UEMOA). Vous pouvez désactiver le rafraîchissement avec le bouton
                en haut à gauche.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4 mt-4">
          <p className="text-xs text-faint">
            Les patterns sont calculés à partir des snapshots de cours publics de BRVM et reconstruits
            en bougies 15-min et 30-min. Chaque pattern est validé par un ensemble de règles
            de qualité avant d'être affiché.
          </p>
        </div>
      </div>
    </div>
  );
}
