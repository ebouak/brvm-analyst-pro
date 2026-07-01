import type { CoutSGIResult } from '@/lib/sgi-frais/calculateur';
import type { SgiFrais, ConfianceNiveau } from '@/lib/sgi-frais/types';
import { CONFIANCE_LABEL, CONFIANCE_BADGE_CLASS } from '@/lib/sgi-frais/types';

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR') + ' FCFA';
}

/**
 * Carte "moins chère" — contrairement au prototype MVP, porte TOUJOURS son
 * badge de confiance (jamais un chiffre présenté comme un fait acquis sans
 * son niveau de fiabilité).
 */
export function CarteRecommandee({
  resultats,
  sgiParNom,
  montant,
}: {
  resultats: CoutSGIResult[];
  sgiParNom: Map<string, SgiFrais>;
  montant: number;
}) {
  if (resultats.length === 0) return null;
  const best = [...resultats].sort((a, b) => a.total - b.total)[0]!;
  const sgi = sgiParNom.get(best.sgiNom);
  const confiance: ConfianceNiveau = sgi?.confiance ?? 'saisie_utilisateur';

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-up/25 bg-gradient-to-br from-up/10 to-transparent p-5">
      <div>
        <span className="mb-1.5 inline-block rounded-full bg-up px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bg">
          Moins chère pour ce scénario
        </span>
        <p className="font-display text-xl font-semibold text-white">{best.sgiNom}</p>
        <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CONFIANCE_BADGE_CLASS[confiance]}`}>
          {CONFIANCE_LABEL[confiance]}
        </span>
      </div>
      <div className="text-right">
        <p className="tabular font-display text-2xl font-bold text-up">{fmt(best.total)}</p>
        <p className="text-xs text-muted">
          {montant > 0 ? `${best.pctCapital.toFixed(2)}% de votre capital` : ''}
        </p>
      </div>
    </div>
  );
}
