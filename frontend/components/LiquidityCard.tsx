import type { LiquidityScore } from '@/lib/liquidity';
import { PremiumPanel } from '@/components/ui/premium';

const CLASS_STYLE: Record<string, string> = {
  A: 'border-up/30 bg-up/10 text-up',
  B: 'border-accent/30 bg-accent/10 text-accent',
  C: 'border-warn/30 bg-warn/10 text-warn',
  D: 'border-down/30 bg-down/10 text-down',
};

const fmtFcfa = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M FCFA`
    : `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

/**
 * Liquidité & coût de friction d'un titre : score mesuré (présence + valeur
 * échangée, ~30 séances) + coût d'aller-retour réel dérivé des barèmes SGI
 * homologués en base. Aucune profondeur de carnet inventée (non publiée BRVM).
 */
export function LiquidityCard({
  liquidity,
  courtageMin,
  courtageMax,
}: {
  liquidity: LiquidityScore | null;
  /** Fourchette de courtage réelle observée sur les barèmes SGI en base (%). */
  courtageMin: number | null;
  courtageMax: number | null;
}) {
  if (!liquidity) return null;

  // Aller-retour = (courtage + 0,3 % BRVM/DC-BR) × 2 ordres.
  const arMin = courtageMin != null ? (courtageMin + 0.3) * 2 : null;
  const arMax = courtageMax != null ? (courtageMax + 0.3) * 2 : null;

  const phrase =
    liquidity.classe === 'A'
      ? 'Titre parmi les plus traités de la cote : entrée et sortie généralement possibles sans délai notable.'
      : liquidity.classe === 'B'
        ? 'Liquidité correcte : les ordres de taille raisonnable passent, prévoyez un peu de patience sur les gros montants.'
        : liquidity.classe === 'C'
          ? 'Liquidité faible : le titre ne traite pas chaque séance — fractionnez vos ordres et utilisez des ordres à cours limité.'
          : 'Titre très illiquide : plusieurs séances peuvent passer sans aucune transaction. Le risque principal est de ne pas trouver de contrepartie à la revente.';

  return (
    <PremiumPanel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border font-display text-2xl font-bold ${CLASS_STYLE[liquidity.classe]}`}
            title={`Score de liquidité ${liquidity.score}/100`}
          >
            {liquidity.classe}
          </span>
          <div>
            <p className="font-display text-base text-ivory">{liquidity.label}</p>
            <p className="tabular text-xs text-muted">
              Score {liquidity.score}/100 · {liquidity.presencePct} % des {liquidity.nbSeances} dernières séances traitées
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-right">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-faint">Valeur échangée / séance</p>
            <p className="tabular text-sm font-bold text-ivory">{fmtFcfa(liquidity.valeurMoyenne)}</p>
          </div>
          {arMin != null && arMax != null && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-faint">Coût aller-retour</p>
              <p className="tabular text-sm font-bold text-warn">
                {arMin.toFixed(1)} – {arMax.toFixed(1)} %
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 border-t border-border pt-3 text-[13px] leading-relaxed text-muted">{phrase}</p>

      {arMin != null && arMax != null && (
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          Coût d&apos;un achat + une revente selon les barèmes SGI en base (courtage{' '}
          {courtageMin!.toFixed(2)}–{courtageMax!.toFixed(2)} % + 0,30 % BRVM/DC-BR par ordre) :
          votre position doit gagner au moins {arMax.toFixed(1)} % pour couvrir les frais au barème
          le plus élevé. <a href="/comparateur-sgi" className="text-accent hover:underline">Comparer les SGI →</a>
        </p>
      )}
    </PremiumPanel>
  );
}
