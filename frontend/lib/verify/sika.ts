/**
 * Contrôle des comptes de résultat contre Sika Finance — logique PURE.
 *
 * Sika sert de RÉFÉRENCE DE CONTRÔLE, jamais de source : on compare nos chiffres
 * aux siens et on signale les écarts, sans stocker ni republier ses valeurs.
 * C'est le contrôle qui aurait détecté seul le cas CFAC, où l'extraction lisait
 * les comptes sociaux au lieu des consolidés (RN 2,4 Md contre 8,4 Md publiés).
 *
 * Le tableau Sika est rendu en JavaScript : le pilote Playwright
 * (scripts/verify-sika.ts) fournit ici les cellules déjà extraites du DOM.
 */

/** Une année du tableau Sika. Montants en FCFA bruts (Sika publie en millions). */
export interface SikaYear {
  annee: string;
  chiffreAffaires: number | null;
  resultatNet: number | null;
  bnpa: number | null;
  dividende: number | null;
}

/**
 * Nombre à la française tel que Sika l'affiche : « 197 630 », « 1 236,34 »,
 * « -11,37% ». Espaces fines/insécables comme séparateurs de milliers, virgule
 * décimale. Renvoie null pour une cellule vide ou non numérique.
 */
export function parseNombreSika(brut: string): number | null {
  const nettoye = brut
    .replace(/[\s   ]/g, '')
    .replace(/%/g, '')
    .replace(',', '.')
    .trim();
  if (nettoye === '' || nettoye === '-' || nettoye === 'ND') return null;
  const n = Number(nettoye);
  return Number.isFinite(n) ? n : null;
}

const MILLION = 1_000_000;

/** Normalise un libellé de ligne pour un appariement robuste aux accents/casse. */
function normaliseLibelle(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Convertit le tableau brut (première ligne = années, puis une ligne par
 * rubrique) en série annuelle. CA et résultat net sont ramenés en FCFA bruts ;
 * BNPA et dividende sont déjà par action, donc laissés tels quels.
 */
export function parseSikaTable(lignes: string[][]): SikaYear[] {
  if (lignes.length === 0) return [];
  const entete = lignes[0] ?? [];
  const annees = entete.slice(1).map((c) => c.trim());

  const parRubrique = new Map<string, string[]>();
  for (const l of lignes.slice(1)) {
    const libelle = normaliseLibelle(l[0] ?? '');
    if (libelle) parParDefaut(parRubrique, libelle, l.slice(1));
  }

  const valeur = (rubrique: string, i: number): number | null => {
    const cells = parRubrique.get(rubrique);
    return cells ? parseNombreSika(cells[i] ?? '') : null;
  };
  const enFcfa = (x: number | null) => (x == null ? null : Math.round(x * MILLION));

  return annees
    .filter((a) => /^\d{4}$/.test(a))
    .map((annee, i) => ({
      annee,
      chiffreAffaires: enFcfa(valeur("chiffre d'affaires", i)),
      resultatNet: enFcfa(valeur('resultat net', i)),
      bnpa: valeur('bnpa', i),
      dividende: valeur('dividende', i),
    }));
}

function parParDefaut(m: Map<string, string[]>, k: string, v: string[]): void {
  if (!m.has(k)) m.set(k, v);
}

export interface EcartSika {
  code: string;
  annee: string;
  champ: 'revenu_total' | 'resultat_net';
  notre: number;
  sika: number;
  ecartPct: number;
}

/**
 * Compare nos exercices à ceux de Sika. Tolérance par défaut 1 % : Sika arrondit
 * au million, ce qui suffit à créer un écart de quelques dixièmes de pour-cent
 * sur les petites sociétés.
 *
 * Une année absente d'un côté ou de l'autre n'est pas un écart : elle est ignorée.
 */
export function comparerASika(
  code: string,
  notres: { periode: string; revenu_total: number | null; resultat_net: number | null }[],
  sika: SikaYear[],
  tolerance = 0.01,
): EcartSika[] {
  const parAnnee = new Map(sika.map((s) => [s.annee, s]));
  const ecarts: EcartSika[] = [];

  for (const n of notres) {
    const s = parAnnee.get(n.periode);
    if (!s) continue;

    const paires: { champ: EcartSika['champ']; notre: number | null; leur: number | null }[] = [
      { champ: 'revenu_total', notre: n.revenu_total, leur: s.chiffreAffaires },
      { champ: 'resultat_net', notre: n.resultat_net, leur: s.resultatNet },
    ];

    for (const { champ, notre, leur } of paires) {
      if (notre == null || leur == null || leur === 0) continue;
      // Sika arrondit au million : un résultat net de 7,3 M s'affiche « 7 », soit
      // 4,5 % d'écart apparent alors que les deux chiffres concordent. On admet
      // donc un demi-million en absolu EN PLUS de la tolérance relative, sans
      // quoi toutes les petites sociétés remontent en faux positifs.
      const ecartAbsolu = Math.abs(notre - leur);
      if (ecartAbsolu <= MILLION / 2) continue;
      const ecart = ecartAbsolu / Math.abs(leur);
      if (ecart > tolerance) {
        ecarts.push({ code, annee: n.periode, champ, notre, sika: leur, ecartPct: ecart * 100 });
      }
    }
  }
  return ecarts;
}

/**
 * Suffixes pays candidats de l'URL Sika, déduits de la dernière lettre du code
 * BRVM (ETIT -> tg, PALC -> ci, BOABF -> bf). L'ordre place le plus probable en
 * premier ; le pilote essaie les suivants si la page ne rend aucun tableau.
 */
export function suffixesSika(code: string): string[] {
  const tous = ['ci', 'sn', 'bf', 'tg', 'bj', 'ml', 'ne'];
  const c = code.toUpperCase();
  const probable = c.endsWith('BF') ? 'bf'
    : c.endsWith('T') ? 'tg'
    : c.endsWith('B') ? 'bj'
    : c.endsWith('S') ? 'sn'
    : c.endsWith('N') ? 'ne'
    : c.endsWith('M') ? 'ml'
    : 'ci';
  return [probable, ...tous.filter((s) => s !== probable)];
}
