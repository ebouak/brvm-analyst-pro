/**
 * Exemples RÉELS des leçons Academy — fonctions PURES et testées
 * (donneesReelles.test.ts). Le chargement depuis Supabase vit dans
 * donneesServer.ts ; ici, seulement le calcul sur les lignes déjà lues.
 *
 * Honnêteté : rien n'est complété ni deviné. Une valeur sans dividende positif
 * ou sans cours est NOMMÉE dans `manquants` ; un exercice absent reste `null`.
 * `montant` de la table `dividends` est le net personne physique quand
 * `base_fiscale = 'net'` ; les autres lignes sont signalées (`baseNette: false`).
 */

export interface LigneDividende {
  code: string;
  exercice: number | null;
  montant: number | null;
  base_fiscale: string | null;
  payment_date: string | null;
  source: string | null;
}

export interface Cotation {
  code: string;
  cours: number;
  /** Date de la séance, AAAA-MM-JJ. */
  date: string;
}

export interface ExempleRendement {
  code: string;
  nom: string;
  exercice: number;
  dividende: number;
  baseNette: boolean;
  paiement: string | null;
  source: string | null;
  cours: number;
  dateCours: string;
  rendementPct: number;
  /** Revenu pour `actions` titres (null si aucun nombre d'actions n'est donné). */
  revenu: number | null;
}

const dernierDistribue = (code: string, dividendes: LigneDividende[]): LigneDividende | null =>
  dividendes
    .filter((d) => d.code === code && d.exercice != null && d.montant != null && d.montant > 0)
    .sort((a, b) => (b.exercice as number) - (a.exercice as number))[0] ?? null;

export function exemplesRendement(
  codes: string[],
  noms: Record<string, string>,
  dividendes: LigneDividende[],
  cotations: Cotation[],
  actions?: number,
): { dateCours: string | null; lignes: ExempleRendement[]; manquants: string[] } {
  const lignes: ExempleRendement[] = [];
  const manquants: string[] = [];
  for (const code of codes) {
    const d = dernierDistribue(code, dividendes);
    const c = cotations.find((x) => x.code === code && x.cours > 0);
    if (!d || !c) {
      manquants.push(code);
      continue;
    }
    const dividende = d.montant as number;
    lignes.push({
      code,
      nom: noms[code] ?? code,
      exercice: d.exercice as number,
      dividende,
      baseNette: d.base_fiscale === 'net',
      paiement: d.payment_date,
      source: d.source,
      cours: c.cours,
      dateCours: c.date,
      rendementPct: (dividende / c.cours) * 100,
      revenu: actions ? Math.round(actions * dividende) : null,
    });
  }
  const dateCours = lignes.map((l) => l.dateCours).sort().at(-1) ?? null;
  return { dateCours, lignes, manquants };
}

export interface HistoriqueValeur {
  code: string;
  nom: string;
  montants: { exercice: number; montant: number | null; baseNette: boolean }[];
  /** Exercices avec un dividende positif. */
  versements: number;
  /** Baisses d'un exercice versé au suivant. */
  baisses: number;
}

export function historiqueDividendes(
  codes: string[],
  noms: Record<string, string>,
  dividendes: LigneDividende[],
  nbExercices = 5,
): { exercices: number[]; lignes: HistoriqueValeur[]; manquants: string[] } {
  const concernes = dividendes.filter((d) => codes.includes(d.code) && d.exercice != null);
  const dernier = Math.max(...concernes.map((d) => d.exercice as number));
  const exercices = Number.isFinite(dernier)
    ? Array.from({ length: nbExercices }, (_, i) => dernier - nbExercices + 1 + i)
    : [];
  const lignes: HistoriqueValeur[] = [];
  const manquants: string[] = [];
  for (const code of codes) {
    const montants = exercices.map((exercice) => {
      const d = concernes.find((x) => x.code === code && x.exercice === exercice && x.montant != null && x.montant > 0);
      return { exercice, montant: d ? (d.montant as number) : null, baseNette: d?.base_fiscale === 'net' };
    });
    const verses = montants.filter((m) => m.montant != null).map((m) => m.montant as number);
    if (verses.length === 0) {
      manquants.push(code);
      continue;
    }
    let baisses = 0;
    for (let i = 1; i < verses.length; i++) if (verses[i]! < verses[i - 1]!) baisses++;
    lignes.push({ code, nom: noms[code] ?? code, montants, versements: verses.length, baisses });
  }
  return { exercices, lignes, manquants };
}

// ── Cours seuls (ticket d'entrée) ───────────────────────────────────────

export interface ExempleCours {
  code: string;
  nom: string;
  cours: number;
  dateCours: string;
  /** Coût de `actions` titres, hors frais (null si aucun nombre n'est donné). */
  cout: number | null;
}

/** Dernier cours de chaque valeur, dans l'ordre demandé. Une valeur sans cours est nommée. */
export function exemplesCours(
  codes: string[],
  noms: Record<string, string>,
  cotations: Cotation[],
  actions?: number,
): { dateCours: string | null; lignes: ExempleCours[]; manquants: string[] } {
  const lignes: ExempleCours[] = [];
  const manquants: string[] = [];
  for (const code of codes) {
    const c = cotations.find((x) => x.code === code && x.cours > 0);
    if (!c) {
      manquants.push(code);
      continue;
    }
    lignes.push({ code, nom: noms[code] ?? code, cours: c.cours, dateCours: c.date, cout: actions ? Math.round(actions * c.cours) : null });
  }
  return { dateCours: lignes.map((l) => l.dateCours).sort().at(-1) ?? null, lignes, manquants };
}

// ── Indices ─────────────────────────────────────────────────────────────

export interface LigneIndice {
  code: string;
  date_marche: string;
  libelle: string | null;
  valeur: number | null;
  variation_pct: number | null;
}

export interface LectureIndice {
  code: string;
  libelle: string;
  valeur: number;
  variationPct: number | null;
  date: string;
}

/** Dernière valeur connue de chaque indice demandé. Un indice sans valeur est nommé. */
export function lectureIndices(codes: string[], lignes: LigneIndice[]): { date: string | null; lignes: LectureIndice[]; manquants: string[] } {
  const out: LectureIndice[] = [];
  const manquants: string[] = [];
  for (const code of codes) {
    const d = lignes
      .filter((l) => l.code === code && l.valeur != null && l.valeur > 0)
      .sort((a, b) => b.date_marche.localeCompare(a.date_marche))[0];
    if (!d) {
      manquants.push(code);
      continue;
    }
    out.push({ code, libelle: d.libelle ?? code, valeur: d.valeur as number, variationPct: d.variation_pct, date: d.date_marche });
  }
  return { date: out.map((l) => l.date).sort().at(-1) ?? null, lignes: out, manquants };
}

// ── Ratios d'évaluation (PER, P/B, ROE) ─────────────────────────────────

export interface LigneFondamentale {
  code: string;
  year: number | null;
  net_income: number | null;
  equity: number | null;
}

export interface RatiosValeur {
  code: string;
  nom: string;
  exercice: number;
  cours: number;
  dateCours: string;
  /** Bénéfice par action (résultat ÷ titres). */
  bpa: number;
  /** null si le résultat est nul ou négatif : un PER n'a alors pas de sens. */
  per: number | null;
  /** Capitalisation ÷ fonds propres ; null si fonds propres ≤ 0. */
  pb: number | null;
  /** Résultat ÷ fonds propres, en %. */
  roePct: number | null;
}

/**
 * Ratios recalculés à partir de la base, jamais saisis : dernier exercice
 * portant à la fois un résultat et des fonds propres, dernier cours, nombre
 * de titres. Une valeur sans l'un des trois est NOMMÉE, jamais devinée.
 */
export function ratiosValeurs(
  codes: string[],
  noms: Record<string, string>,
  cotations: Cotation[],
  fondamentaux: LigneFondamentale[],
  titres: Record<string, number | null>,
): { dateCours: string | null; lignes: RatiosValeur[]; manquants: string[] } {
  const lignes: RatiosValeur[] = [];
  const manquants: string[] = [];
  for (const code of codes) {
    const c = cotations.find((x) => x.code === code && x.cours > 0);
    const n = titres[code];
    const f = fondamentaux
      .filter((x) => x.code === code && x.year != null && x.net_income != null && x.equity != null)
      .sort((a, b) => (b.year as number) - (a.year as number))[0];
    if (!c || !n || n <= 0 || !f) {
      manquants.push(code);
      continue;
    }
    const resultat = f.net_income as number;
    const fp = f.equity as number;
    const bpa = resultat / n;
    lignes.push({
      code,
      nom: noms[code] ?? code,
      exercice: f.year as number,
      cours: c.cours,
      dateCours: c.date,
      bpa,
      per: bpa > 0 ? c.cours / bpa : null,
      pb: fp > 0 ? (c.cours * n) / fp : null,
      roePct: fp > 0 ? (resultat / fp) * 100 : null,
    });
  }
  return { dateCours: lignes.map((l) => l.dateCours).sort().at(-1) ?? null, lignes, manquants };
}
