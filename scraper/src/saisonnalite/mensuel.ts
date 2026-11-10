/**
 * Faits mensuels de la saisonnalité — fonctions PURES, testées.
 * Spec : docs/superpowers/specs/2026-11-10-saisonnalite-v2.md (lot 2).
 * Plan : docs/superpowers/plans/2026-11-10-saisonnalite-v2-lot2.md.
 *
 * Réutilise la chaîne du Conseiller (série nettoyée, ruptures, ex-dates
 * reconstituées, rendement total) : rien n'est recopié ici.
 * Le verdict de fiabilité n'est PAS calculé ici : il l'est à la lecture
 * (frontend/lib/seasonality/compute.ts), sur la fenêtre choisie.
 */
import { rendementTotal } from '../conseiller/dividendes.js';
import type { ComptesAnnuels, Dividende, Serie } from '../conseiller/types.js';
import type { Evenement } from './evenements.js';

export type Exclusion = 'sans_echange' | 'reprise' | 'saut';
export type { Evenement };

/** Une ligne de `saisonnalite_mensuelle` (colonnes de la migration 0206). */
export interface FaitMensuel {
  code: string;
  annee: number;
  mois: number;
  rdt_prix: number | null;
  rdt_total: number | null;
  rdt_marche: number | null;
  dividende: number | null;
  seances_cotees: number;
  seances_marche: number;
  valeur_echangee: number;
  exclu: Exclusion | null;
  evenements: Evenement[];
  difficulte: boolean;
  complet: boolean;
}

const cleMois = (d: string) => d.slice(0, 7);

/** Mois suivant au format AAAA-MM. */
function moisSuivant(m: string): string {
  const a = Number(m.slice(0, 4));
  const n = Number(m.slice(5, 7));
  return n === 12 ? `${a + 1}-01` : `${a}-${String(n + 1).padStart(2, '0')}`;
}

export interface EntreeMensuelle {
  code: string;
  /** Série nettoyée des allers-retours (chargerHistorique du Conseiller). */
  serie: Serie;
  /** Toutes les séances du marché (pour compter les séances du mois). */
  calendrier: string[];
  /** Dividendes de la valeur, ex-dates réelles ou reconstituées. */
  dividendes: Dividende[];
  /** Ruptures non expliquées de la valeur. */
  ruptures: Set<string>;
  /** Années calendaires de difficulté (voir anneesDifficiles). */
  anneesDifficiles: Set<number>;
  /** Date du calcul (AAAA-MM-JJ) ; son mois est marqué incomplet. */
  asOf: string;
  /** Autres événements datés (comptes, convocations, suspensions…), lot 3. */
  autres?: Evenement[];
}

/**
 * Une ligne par mois, du deuxième mois coté jusqu'au mois de `asOf`.
 *
 * Rendement d'un mois = dernier cours du mois / dernier cours du mois précédent − 1.
 * - `sans_echange` : aucune séance avec volume dans le mois (le cours est recopié) ;
 * - `reprise` : le mois précédent était sans échange ou absent de la série, le
 *   rendement cumulerait plusieurs mois ;
 * - `saut` : rupture non expliquée dans le mois.
 * Ces trois cas n'ont pas de rendement : jamais d'imputation.
 * `rdt_total` est null aussi quand un dividende sans ex-date rend le total inconnu.
 */
export function faitsMensuels(e: EntreeMensuelle): FaitMensuel[] {
  const s = e.serie;
  if (s.dates.length === 0) return [];
  const moisAsOf = cleMois(e.asOf);

  // Séances du marché par mois.
  const seancesMarche = new Map<string, number>();
  for (const d of e.calendrier) seancesMarche.set(cleMois(d), (seancesMarche.get(cleMois(d)) ?? 0) + 1);

  // Indices de la série par mois.
  const parMois = new Map<string, number[]>();
  for (let i = 0; i < s.dates.length; i++) {
    const m = cleMois(s.dates[i]!);
    if (m > moisAsOf) break;
    if (!parMois.has(m)) parMois.set(m, []);
    parMois.get(m)!.push(i);
  }

  const echange = (idx: number[] | undefined) => (idx ?? []).filter((i) => s.volumes[i]! > 0).length;
  const out: FaitMensuel[] = [];
  const premier = cleMois(s.dates[0]!);

  for (let m = moisSuivant(premier), prec = premier; m <= moisAsOf; prec = m, m = moisSuivant(m)) {
    const idx = parMois.get(m);
    if (!idx || idx.length === 0) continue; // aucune ligne de cours : pas de fait à écrire
    const annee = Number(m.slice(0, 4));
    const mois = Number(m.slice(5, 7));
    const seancesCotees = echange(idx);
    const b = idx[idx.length - 1]!;
    const a = idx[0]! - 1; // dernière séance avant le mois
    const detaches = e.dividendes.filter((d) => d.exDate != null && cleMois(d.exDate) === m && d.montant > 0);

    let exclu: Exclusion | null = null;
    if (seancesCotees === 0) exclu = 'sans_echange';
    else if (echange(parMois.get(prec)) === 0) exclu = 'reprise';
    else if ([...e.ruptures].some((r) => r > s.dates[a]! && r <= s.dates[b]!)) exclu = 'saut';

    const rdtPrix = exclu ? null : s.cours[b]! / s.cours[a]! - 1;
    const rdtTotal = exclu ? null : rendementTotal(s, e.code, e.dividendes, a, b, e.ruptures);

    out.push({
      code: e.code,
      annee,
      mois,
      rdt_prix: rdtPrix,
      rdt_total: rdtTotal,
      rdt_marche: null,
      dividende: detaches.length ? detaches.reduce((t, d) => t + d.montant, 0) : null,
      seances_cotees: seancesCotees,
      seances_marche: seancesMarche.get(m) ?? 0,
      valeur_echangee: idx.reduce((t, i) => t + (s.valeurs[i] ?? 0), 0),
      exclu,
      evenements: [
        ...detaches.map((d) => ({ type: 'detachement' as const, date: d.exDate! })),
        ...(e.autres ?? []).filter((x) => cleMois(x.date) === m),
      ].sort((x, y) => x.date.localeCompare(y.date)),
      difficulte: e.anneesDifficiles.has(annee),
      complet: m < moisAsOf,
    });
  }
  return out;
}

/**
 * Années calendaires de difficulté d'une valeur (les quatre critères de la spec) :
 * - résultat net négatif de l'exercice E → année E ;
 * - suspension de cotation ou avertissement sur résultat → année de l'événement ;
 * - dividende supprimé : payé pour E − 1, rien pour E, alors que la table couvre
 *   E (un exercice postérieur y figure) → année E + 1, celle du détachement manqué.
 *   Sans exercice postérieur, l'absence peut n'être qu'un trou de la table.
 */
export function anneesDifficiles(comptes: ComptesAnnuels[], dividendes: Dividende[], evenements: Evenement[] = []): Set<number> {
  const out = new Set<number>();
  for (const ev of evenements) if (ev.type === 'suspension' || ev.type === 'avertissement') out.add(Number(ev.date.slice(0, 4)));
  for (const c of comptes) if (c.resultatNet != null && c.resultatNet < 0) out.add(c.exercice);
  const payes = new Set(dividendes.filter((d) => d.montant > 0).map((d) => d.exercice));
  if (payes.size > 0) {
    const dernier = Math.max(...payes);
    for (const e of payes) {
      const suivant = e + 1;
      if (!payes.has(suivant) && suivant < dernier) out.add(suivant + 1);
    }
  }
  return out;
}

/**
 * Rendement du marché par mois (clé AAAA-MM) : moyenne équipondérée des
 * `rdt_total` non exclus, chacun écrêté à ±30 %. Même règle que
 * `marketMonthlyReturns` du frontend (lib/seasonality/compute.ts).
 */
export function rdtMarche(faits: FaitMensuel[], ecretage = 0.3): Map<string, number> {
  const acc = new Map<string, { somme: number; n: number }>();
  for (const f of faits) {
    if (f.exclu || f.rdt_total == null || !Number.isFinite(f.rdt_total)) continue;
    const k = `${f.annee}-${String(f.mois).padStart(2, '0')}`;
    const a = acc.get(k) ?? { somme: 0, n: 0 };
    a.somme += Math.max(-ecretage, Math.min(ecretage, f.rdt_total));
    a.n++;
    acc.set(k, a);
  }
  return new Map([...acc].map(([k, a]) => [k, a.somme / a.n]));
}
