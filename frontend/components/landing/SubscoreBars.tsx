import { subscoreBar, BORNES } from '@/lib/landing/subscoreBar';
import type { SignalDaily } from '@/lib/types';

/**
 * Les cinq sous-scores du signal, en barres bipolaires centrées sur zéro.
 *
 * Composant UNIQUE, partagé par le terminal du hero et par la section
 * « Chaque action. Une note. ». Les deux dessinaient auparavant la même
 * grandeur différemment, et la divergence est réapparue à chaque correction
 * partielle. Un seul rendu = plus de divergence possible.
 *
 * La géométrie vit dans `lib/landing/subscoreBar.ts` (testée) : une valeur
 * nulle ne dessine rien, une valeur négative part à gauche du zéro. La forme
 * ne peut plus contredire le chiffre affiché à côté.
 *
 * `couleurs` permet au hero d'imposer ses couleurs fixes : cette section reste
 * sombre quel que soit le thème, un token y deviendrait illisible en clair.
 */

export interface SubscoreCouleurs {
  label: string;
  piste: string;
  favorable: string;
  defavorable: string;
  repere: string;
}

/** Palette pilotée par les tokens du thème (usage courant). */
export const COULEURS_TOKEN: SubscoreCouleurs = {
  label: 'rgb(var(--color-muted))',
  piste: 'rgb(var(--color-border) / 0.55)',
  favorable: 'rgb(var(--color-accent))',
  defavorable: 'rgb(var(--color-down))',
  repere: 'rgb(var(--color-border-strong))',
};

const LIGNES = [
  { cle: 'score_variation', label: 'Variation', bornes: BORNES.variation },
  { cle: 'score_volume', label: 'Volume', bornes: BORNES.volume },
  { cle: 'score_rsi', label: 'RSI', bornes: BORNES.rsi },
  { cle: 'bonus_tendance', label: 'Tendance', bornes: BORNES.tendance },
  { cle: 'penalite_liquidite', label: 'Liquidité', bornes: BORNES.liquidite },
] as const;

export function SubscoreBars({
  signal,
  couleurs = COULEURS_TOKEN,
  compact = false,
}: {
  signal: SignalDaily;
  couleurs?: SubscoreCouleurs;
  compact?: boolean;
}) {
  const taille = compact ? 'text-[9.5px]' : 'text-[11px]';

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      {LIGNES.map(({ cle, label, bornes }) => {
        const valeur = (signal[cle] as number | null | undefined) ?? null;
        const geo = subscoreBar(valeur, bornes);
        const teinte = geo?.defavorable ? couleurs.defavorable : couleurs.favorable;

        return (
          <div key={cle} className="flex items-center gap-2">
            <span className={`${compact ? 'w-[62px]' : 'w-[84px]'} shrink-0 ${taille} leading-tight`} style={{ color: couleurs.label }}>
              {label}
            </span>

            <span
              className={`relative ${compact ? 'h-[5px]' : 'h-1.5'} flex-1 overflow-hidden rounded-full`}
              style={{ background: couleurs.piste }}
            >
              {/* Repère du zéro : sans lui, une barre partant du milieu est illisible. */}
              {geo && geo.zero > 1 && geo.zero < 99 && (
                <span
                  className="absolute inset-y-0 w-px"
                  style={{ left: `${geo.zero}%`, background: couleurs.repere }}
                  aria-hidden
                />
              )}
              {geo && geo.width > 0 && (
                <span
                  className="absolute inset-y-0 rounded-full"
                  style={{ left: `${geo.left}%`, width: `${geo.width}%`, background: teinte }}
                />
              )}
            </span>

            <span className={`tabular w-[34px] shrink-0 text-right ${taille}`} style={{ color: couleurs.label }}>
              {valeur == null ? '—' : valeur.toFixed(2)}
            </span>
          </div>
        );
      })}

      {/* L'échelle doit être déclarée : cinq barres d'apparence identique
          couvraient trois intervalles différents sans le dire. */}
      <p className={`pt-0.5 ${compact ? 'text-[8.5px]' : 'text-[10px]'} leading-snug`} style={{ color: couleurs.label }}>
        Barres centrées sur zéro · à droite = contribution favorable, à gauche = défavorable.
      </p>
    </div>
  );
}
