import type { LiquidityScore, LiquidityScoreV2 } from '@/lib/liquidity';
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
  liquidity: LiquidityScore | LiquidityScoreV2 | null;
  /** Fourchette de courtage réelle observée sur les barèmes SGI en base (%). */
  courtageMin: number | null;
  courtageMax: number | null;
}) {
  if (!liquidity) return null;

  // Détail v2 (moteur liquidity_daily) : absent tant que la table n'est pas peuplée.
  const v2 = 'v2' in liquidity ? liquidity.v2 : null;
  const achat = v2?.volume_achat ?? 0;
  const vente = v2?.volume_vente ?? 0;
  const fluxOk = v2?.flux_net_pct != null && achat + vente > 0;
  const pctAchat = fluxOk ? Math.round((achat / (achat + vente)) * 100) : 0;

  // Aller-retour = (courtage + 0,3 % BRVM/DC-BR) × 2 ordres.
  const arMin = courtageMin != null ? (courtageMin + 0.3) * 2 : null;
  const arMax = courtageMax != null ? (courtageMax + 0.3) * 2 : null;

  // Sur la BRVM, presque tous les titres traitent chaque séance : la difficulté
  // n'est pas d'y passer un ordre, c'est d'y passer un ordre de TAILLE sans
  // déplacer le cours. Les phrases décrivent donc la profondeur et le coût.
  const phrase =
    liquidity.classe === 'A'
      ? 'Parmi les rares valeurs réellement négociables de la cote : vous pouvez entrer et sortir d’une position de taille normale sans peser sur le cours.'
      : liquidity.classe === 'B'
        ? 'Négociable, mais la profondeur est limitée : fractionnez les ordres importants et utilisez des ordres à cours limité pour ne pas subir le prix.'
        : liquidity.classe === 'C'
          ? 'Le titre traite régulièrement, mais pour de petits montants : un ordre de taille déplacera le cours contre vous. Comptez plusieurs séances pour construire ou solder une position.'
          : 'Très illiquide : les échanges sont trop rares ou trop minces pour garantir une contrepartie. Le risque principal est de rester bloqué avec vos titres.';

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

      {/* ── Détail mesuré (moteur v2) : flux de la séance, spread et impact prix ── */}
      {v2 && (
        <div className="mt-4 space-y-3 border-t border-border pt-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-muted">Flux de la séance (achat / vente)</span>
              <span className="tabular text-faint">
                {fluxOk ? `net ${v2.flux_net_pct! > 0 ? '+' : ''}${v2.flux_net_pct} %` : '—'}
              </span>
            </div>
            {fluxOk ? (
              <div className="flex h-2 overflow-hidden rounded-full bg-border" role="img"
                aria-label={`Pression acheteuse ${pctAchat} %, vendeuse ${100 - pctAchat} %`}>
                <div className="bg-up" style={{ width: `${pctAchat}%` }} />
                <div className="bg-down" style={{ width: `${100 - pctAchat}%` }} />
              </div>
            ) : (
              <p className="text-[11px] text-faint">Pas de données intraday pour cette séance.</p>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted">Écart de prix estimé (spread marché)</span>
            <span className="tabular text-ivory">
              {v2.spread_roll_pct != null
                ? `≈ ${v2.spread_roll_pct.toFixed(2)} % (${fmtFcfa(500_000 * (v2.spread_roll_pct / 100))} sur 500 000 FCFA)`
                : 'non estimable'}
            </span>
          </div>

          {v2.amihud != null && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted">Impact prix (Amihud, %/M FCFA)</span>
              <span className="tabular text-ivory">{v2.amihud.toFixed(3)}</span>
            </div>
          )}

          <p className="text-[10px] leading-relaxed text-faint">
            La BRVM ne publie pas son carnet d&apos;ordres : le spread et l&apos;impact prix sont
            estimés à partir des échanges des 30 dernières séances, jamais inventés.
          </p>
        </div>
      )}
    </PremiumPanel>
  );
}
