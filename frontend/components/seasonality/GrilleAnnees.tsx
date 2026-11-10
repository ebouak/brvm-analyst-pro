'use client';
/**
 * F2 — La saison a-t-elle tenu ? Chaque rendement réel, année par année, au lieu
 * de la seule moyenne, et par mois le nombre d'années où le signe habituel des
 * années PRÉCÉDENTES s'est vérifié. Ne calcule que l'affichage.
 */
import { bilanHorsEchantillon } from '@/lib/seasonality/trajectoire';
import type { MonthlyReturn } from '@/lib/seasonality/compute';
import type { FaitLu } from '@/lib/seasonality/server';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const EXCLU: Record<string, string> = {
  sans_echange: 'aucun échange ce mois',
  reprise: 'reprise après un mois sans échange : rendement de plusieurs mois, écarté',
  saut: 'variation non expliquée (opération sur titre ou erreur), écartée',
};

/** Intensité selon l'ampleur du rendement réel (un fait, pas une habitude). */
function fond(r: number): string {
  const a = Math.abs(r);
  const niveau = a < 0.02 ? '10' : a < 0.05 ? '20' : '35';
  return r >= 0 ? `bg-up/${niveau}` : `bg-down/${niveau}`;
}
const court = (r: number) => `${r >= 0 ? '+' : '−'}${Math.abs(r * 100).toFixed(0)}`;

export default function GrilleAnnees({
  faits, rets, mode, anneesDifficiles, horsDifficulte, windowYears,
}: {
  faits: FaitLu[];
  /** Rendements retenus par la matrice (mode et filtre déjà appliqués). */
  rets: MonthlyReturn[];
  mode: 'total' | 'prix';
  anneesDifficiles: number[];
  horsDifficulte: boolean;
  windowYears: number;
}) {
  const complets = faits.filter((f) => f.complet);
  if (complets.length === 0) return null;
  const derniere = Math.max(...complets.map((f) => f.annee));
  const annees = Array.from({ length: windowYears }, (_, i) => derniere - i).filter((y) => complets.some((f) => f.annee === y));
  const parCle = new Map(complets.map((f) => [`${f.annee}-${f.mois}`, f]));
  const bilan = bilanHorsEchantillon(rets, 10);

  return (
    <section aria-labelledby="grille-annees-h" className="space-y-2">
      <h3 id="grille-annees-h" className="text-sm font-medium text-ivory">La saison a-t-elle tenu ?</h3>
      <p className="text-xs text-faint">
        Rendement de chaque mois, en %, {mode === 'total' ? 'dividende réinvesti' : 'cours seul'}. Dernière ligne : nombre d’années
        où le signe habituel des dix années précédentes s’est vérifié, sur le nombre d’années testables.
      </p>
      <div tabIndex={0} role="region" aria-label="Grille des années, défilement horizontal"
        className="overflow-x-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <table className="w-full min-w-[640px] text-[12px]">
          <thead className="bg-surface text-muted">
            <tr>
              <th scope="col" className="px-2 py-1.5 text-left font-medium">Année</th>
              {MONTHS.map((m) => <th key={m} scope="col" className="px-1 py-1.5 text-center font-medium">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {annees.map((y) => {
              const difficile = anneesDifficiles.includes(y);
              const ecartee = difficile && horsDifficulte;
              return (
                <tr key={y} className={`border-t border-border/50 ${ecartee ? 'opacity-40' : ''}`}>
                  <th scope="row" className="whitespace-nowrap px-2 py-1 text-left font-normal text-ivory">
                    <span className="tabular">{y}</span>
                    {difficile && (
                      <span className="ml-1 text-[11px] text-warn" title="Perte nette ou dividende supprimé cette année">
                        difficulté{ecartee ? ', écartée' : ''}
                      </span>
                    )}
                  </th>
                  {MONTHS.map((_, i) => {
                    const f = parCle.get(`${y}-${i + 1}`);
                    const r = f ? (mode === 'total' ? f.rdtTotal : f.rdtPrix) : null;
                    if (!f) return <td key={i} className="px-1 py-1 text-center text-faint">·</td>;
                    if (f.exclu || r == null) {
                      return (
                        <td key={i} className="px-1 py-1 text-center text-faint" title={f.exclu ? EXCLU[f.exclu] : 'rendement total inconnu (dividende sans date)'}>
                          —
                        </td>
                      );
                    }
                    return (
                      <td key={i} className={`px-1 py-1 text-center tabular text-ivory ${fond(r)}`}
                        title={`${MONTHS[i]} ${y} : ${(r * 100).toFixed(1).replace('.', ',')} %${f.detachements.length ? ', mois de détachement' : ''}`}>
                        {court(r)}{f.detachements.length ? <span aria-label="détachement" className="text-accent-ink">•</span> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-border bg-surface text-muted">
            <tr>
              <th scope="row" className="px-2 py-1.5 text-left font-medium">Signe tenu</th>
              {bilan.map((b) => (
                <td key={b.month} className="px-1 py-1.5 text-center tabular">
                  {b.tests ? `${b.verifies}/${b.tests}` : '—'}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-faint">
        • mois de détachement d’un dividende. — mois écarté (sans échange, reprise ou variation non expliquée), au survol la raison.
        Un signe tenu une fois sur deux est ce que donnerait le hasard.
      </p>
    </section>
  );
}
