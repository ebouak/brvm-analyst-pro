import { AlertTriangle, Database, Info } from 'lucide-react';
import { fmtDateCourte, fmtNumber } from '@/lib/format';
import type { CouvertureSource } from '@/lib/stress/lecture';

export function CouvertureDonneesBanner({
  couverture,
  sourceMode,
}: {
  couverture: CouvertureSource | null;
  sourceMode: 'table_precalculee' | 'calcul_live_brvm_indices';
}) {
  const estCourt =
    !couverture || !couverture.debut_date || couverture.debut_date >= '2026-01-01';

  return (
    <section
      id="methodologie"
      aria-labelledby="stress-methodo-titre"
      className="mt-10 space-y-4 rounded-card border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-accent-ink" strokeWidth={1.75} />
          <h2 id="stress-methodo-titre" className="text-sm font-semibold text-ivory">
            Méthodologie, couverture et traçabilité des données
          </h2>
        </div>
        <span className="rounded-full border border-border bg-elevated px-2.5 py-0.5 text-xs text-muted">
          {sourceMode === 'table_precalculee' ? 'Registre pré-calculé' : 'Calcul direct sur séries en base'}
        </span>
      </div>

      {couverture ? (
        <div className="grid gap-3 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-sunken p-3">
            <p className="text-faint">Plage historique couverte</p>
            <p className="tabular mt-1 font-semibold text-ivory">
              {couverture.debut_date ? fmtDateCourte(couverture.debut_date) : '—'} →{' '}
              {couverture.fin_date ? fmtDateCourte(couverture.fin_date) : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-sunken p-3">
            <p className="text-faint">Séances disponibles</p>
            <p className="tabular mt-1 font-semibold text-ivory">
              {fmtNumber(couverture.nb_seances_disponibles, 0)} séances
              {couverture.couverture_pct != null && ` (${fmtNumber(couverture.couverture_pct, 1)} %)`}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-sunken p-3">
            <p className="text-faint">Indices suivis</p>
            <p className="tabular mt-1 font-semibold text-ivory">
              {couverture.indices_disponibles.length} indices officiels
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-sunken p-3">
            <p className="text-faint">Source active</p>
            <p className="mt-1 truncate font-medium text-ivory" title={couverture.libelle}>
              {couverture.libelle}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">Aucun rapport de couverture disponible pour le moment.</p>
      )}

      {estCourt && (
        <div className="flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <p>
            La table d&apos;indices contient actuellement la série collectée depuis{' '}
            {couverture?.debut_date ? fmtDateCourte(couverture.debut_date) : 'mai 2026'}. Les crises antérieures à
            cette date apparaissent dès l&apos;exécution de l&apos;import historique consolidé (`stress:import-indices` +
            `stress:crises`). Aucune valeur n&apos;est reconstituée artificiellement avant la création officielle d&apos;un
            indice.
          </p>
        </div>
      )}

      <div className="grid gap-3 text-xs leading-relaxed text-muted md:grid-cols-2">
        <div className="space-y-1">
          <p className="font-medium text-ivory">Séparation Observé / Calculé</p>
          <p>
            <span className="text-ivory">Données observées :</span> clôtures quotidiennes officielles des indices BRVM,
            volatilité réalisée BRVM-V, taux directeurs BCEAO et séries Banque Mondiale.
          </p>
          <p>
            <span className="text-ivory">Données calculées :</span>{' '}
            <code className="text-ivory">DD(t) = (Indice(t) / Sommet(≤ t) − 1) × 100</code>, détection de fin
            d&apos;épisode après 5 séances consécutives de récupération confirmée, rendements post-creux calendaires, et
            score de similarité multi-critères (distance euclidienne, corrélation de Pearson, forme de drawdown,
            variables de marché avec renormalisation des poids disponibles).
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-sunken p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" strokeWidth={1.75} />
          <p>
            Les performances historiques et scores de similarité sont strictement descriptifs et ne préjugent pas des
            performances futures. Les analyses présentées constituent des outils d&apos;information et d&apos;aide à la
            décision et ne constituent pas un conseil en investissement.
          </p>
        </div>
      </div>
    </section>
  );
}
