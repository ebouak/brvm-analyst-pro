import type { CoutSGIResult } from '@/lib/sgi-frais/calculateur';
import type { SgiFrais, ConfianceNiveau } from '@/lib/sgi-frais/types';
import { CONFIANCE_LABEL, CONFIANCE_BADGE_CLASS } from '@/lib/sgi-frais/types';
import { PAYS, type Sgi } from '@/lib/sgi-frais/directory';

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR') + ' FCFA';
}

function formatDuree(ans: number): string {
  if (ans < 1) return `${Math.round(ans * 12)} mois`;
  return ans === 1 ? '1 an' : `${ans} ans`;
}

/**
 * Carte "moins chère" — contrairement au prototype MVP, porte TOUJOURS son
 * badge de confiance (jamais un chiffre présenté comme un fait acquis sans
 * son niveau de fiabilité).
 */
export function CarteRecommandee({
  resultat,
  sgi,
  directory,
  montant,
  dureeAns,
  seuilPct,
}: {
  resultat: CoutSGIResult;
  sgi: SgiFrais;
  directory: Sgi | null;
  montant: number;
  dureeAns: number;
  seuilPct: number | null;
}) {
  const confiance: ConfianceNiveau = sgi.confiance;
  const lien = directory?.ficheBRVM ?? directory?.siteWeb ?? null;
  const paysNom = directory ? PAYS[directory.pays].nom : null;

  return (
    <div className="rounded-2xl border border-up/25 bg-gradient-to-br from-up/10 to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="mb-1.5 inline-block rounded-full bg-up px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bg">
            Recommandée pour ce scénario
          </span>
          <p className="font-display text-xl font-semibold text-white">{resultat.sgiNom}</p>
          {(paysNom || directory) && (
            <p className="mt-0.5 text-xs text-muted">
              {paysNom}
              {paysNom && directory ? ' · ' : ''}
              {directory?.type}
            </p>
          )}
          <span className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CONFIANCE_BADGE_CLASS[confiance]}`}>
            {CONFIANCE_LABEL[confiance]}
          </span>
        </div>
        <div className="text-right">
          <p className="tabular font-display text-2xl font-bold text-up">{fmt(resultat.total)}</p>
          <p className="text-xs text-muted">
            {montant > 0 ? `${resultat.pctCapital.toFixed(2)}% de votre capital · ${formatDuree(dureeAns)}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
        {seuilPct != null ? (
          <p className="text-[11px] text-muted">
            Seuil de rentabilité (aller-retour) :{' '}
            <span className="tabular font-semibold text-white">+{seuilPct.toFixed(2)}%</span>
          </p>
        ) : (
          <span />
        )}
        {lien && (
          <a
            href={lien}
            target="_blank"
            rel="nofollow noopener"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-up/40 px-4 text-xs font-semibold text-up transition-colors hover:bg-up/10"
          >
            Voir la fiche <span aria-hidden>→</span>
          </a>
        )}
      </div>
    </div>
  );
}
