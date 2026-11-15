/**
 * Lecture bancaire — module PUR et UNIQUE (spec 2026-11-15 §3 et §5).
 *
 * Entrée : les lignes income_statements / balance_sheets d'une banque. Seules
 * comptent les valeurs RETENUES par la sélection du scraper, c'est-à-dire
 * celles qui portent une source dans `sources_specifiques` ; s'y ajoutent le
 * résultat net de la base (recoupé à l'extraction) et, à défaut d'agrégat
 * sourcé, les capitaux propres de la base. Sortie : agrégats publiés,
 * comparaisons, ratios CALCULÉS (une seule définition), agrégats non publiés,
 * constat de titre. Revue, fiche, dossier et articles l'appellent ; aucune
 * surface ne recalcule.
 *
 * ⚠️ COPIE OCTET POUR OCTET : scraper/src/bank/pure/lecture.ts (deux paquets
 * TS distincts). frontend/lib/bank/coherence.test.ts échoue si les deux
 * fichiers divergent : toute correction se fait ici, puis se recopie.
 * Pour rester copiable, ce fichier n'importe RIEN.
 *
 * Unités (avenant du 2026-11-15) : une valeur garde l'unité de sa source
 * (`sources_specifiques[clé].unite` : fcfa, usd ou pct) — ETIT publie en USD
 * et s'affiche en USD. Aucune conversion : deux unités différentes ne se
 * comparent pas et ne forment pas de ratio, exactement comme deux périmètres.
 */

export type Perimetre = 'individuel' | 'consolide' | 'non_precise';
export type Unite = 'fcfa' | 'usd' | 'pct';
export type CodePeriode = 'exercice' | 'S1' | 'T1' | 'T3';
export type Agregat =
  | 'pnb' | 'marge_interets' | 'produits_interets' | 'charges_interets' | 'commissions_nettes'
  | 'charges_exploitation' | 'resultat_brut_exploitation' | 'cout_du_risque' | 'resultat_net'
  | 'credits_clientele' | 'depots_clientele' | 'creances_souffrance_brutes' | 'taux_creances_souffrance'
  | 'couverture_creances_souffrance' | 'fonds_propres' | 'total_bilan' | 'solvabilite_total' | 'ratio_cet1' | 'ratio_tier1';

export interface SourceValeur {
  document_url: string;
  document_libelle: string | null;
  page: number | null;
}

export interface Valeur {
  valeur: number;
  perimetre: Perimetre;
  /** Unité de la source ; une valeur de la base (sans source) est en FCFA. */
  unite: Unite;
  /** null = valeur de la base (résultat net, capitaux propres), sans document rattaché. */
  source: SourceValeur | null;
}

export interface PeriodeBancaire {
  annee: number;
  code: CodePeriode;
  valeurs: Partial<Record<Agregat, Valeur>>;
}

export interface LigneComptesBancaire {
  periode: string;
  lignes_specifiques: Record<string, unknown> | null;
  sources_specifiques: Record<string, { document_url: string; document_libelle: string | null; page: number | null; perimetre: Perimetre; unite?: Unite }> | null;
  resultat_net?: number | null;
  total_capitaux_propres?: number | null;
}

export interface Comparaison {
  valeur: number;
  libelle: string;
  /** Variation en % (montants, base strictement positive) ou en points (ratios publiés). */
  variation: number | null;
  uniteVariation: '%' | 'pts';
}

export interface LigneAgregat {
  cle: Agregat;
  libelle: string;
  /** Unité de la valeur affichée : toute surface écrit la devise de la ligne, jamais « FCFA » en dur. */
  unite: Unite;
  valeur: Valeur;
  precedent: Comparaison | null;
  cloture: Comparaison | null;
}

export type CleRatio = 'coefficient_exploitation' | 'cout_du_risque_relatif' | 'credits_sur_depots' | 'roe';

export interface LigneRatio {
  cle: CleRatio;
  libelle: string;
  /** Fraction (0,45 = 45 %). */
  valeur: number;
  precedent: number | null;
  phrase: string;
  mention: string | null;
}

export interface Constat {
  pnb: { valeur: number; variation: number | null } | null;
  second: { cle: 'coefficient_exploitation' | 'cout_du_risque' | 'resultat_net'; variation: number; valeur: number } | null;
}

export interface LectureBancaire {
  annee: number;
  code: CodePeriode;
  libelle: string;
  libellePrecedent: string;
  /** Au moins une valeur sourcée : sinon la surface garde l'ancien affichage. */
  extrait: boolean;
  compteResultat: LigneAgregat[];
  encours: LigneAgregat[];
  ratios: LigneRatio[];
  nonPublies: string[];
  mentionNonPublies: string | null;
  constat: Constat;
  titre: string;
  sources: SourceValeur[];
}

const LIBELLES: Record<Agregat, string> = {
  pnb: 'Produit net bancaire',
  marge_interets: 'Marge d’intérêts',
  produits_interets: 'Intérêts et produits assimilés',
  charges_interets: 'Intérêts et charges assimilées',
  commissions_nettes: 'Commissions nettes',
  charges_exploitation: 'Charges d’exploitation',
  resultat_brut_exploitation: 'Résultat brut d’exploitation',
  cout_du_risque: 'Coût du risque',
  resultat_net: 'Résultat net',
  credits_clientele: 'Crédits à la clientèle',
  depots_clientele: 'Dépôts de la clientèle',
  creances_souffrance_brutes: 'Créances en souffrance brutes',
  taux_creances_souffrance: 'Taux de créances en souffrance',
  couverture_creances_souffrance: 'Couverture des créances en souffrance',
  fonds_propres: 'Fonds propres',
  total_bilan: 'Total du bilan',
  solvabilite_total: 'Solvabilité totale',
  ratio_cet1: 'Ratio CET1',
  ratio_tier1: 'Ratio Tier 1',
};

const EN_POURCENT = new Set<Agregat>(['taux_creances_souffrance', 'couverture_creances_souffrance', 'solvabilite_total', 'ratio_cet1', 'ratio_tier1']);

const ORDRE_CR: Agregat[] = ['pnb', 'marge_interets', 'produits_interets', 'charges_interets', 'commissions_nettes', 'charges_exploitation', 'resultat_brut_exploitation', 'cout_du_risque', 'resultat_net'];
const ORDRE_ENCOURS: Agregat[] = ['credits_clientele', 'depots_clientele', 'creances_souffrance_brutes', 'taux_creances_souffrance', 'couverture_creances_souffrance', 'fonds_propres', 'total_bilan', 'solvabilite_total', 'ratio_cet1', 'ratio_tier1'];
/** Agrégats dont l'absence est dite au lecteur. */
const PRINCIPAUX: Agregat[] = ['pnb', 'marge_interets', 'commissions_nettes', 'charges_exploitation', 'cout_du_risque', 'credits_clientele', 'depots_clientele', 'creances_souffrance_brutes', 'fonds_propres', 'solvabilite_total'];

/** Clé de lignes_specifiques → agrégat (clés historiques de lib/bank/kpis.ts conservées). */
const CLE_VERS_AGREGAT: Record<string, Agregat> = {
  pnb: 'pnb', produit_interets: 'produits_interets', charges_interets: 'charges_interets', marge_interets: 'marge_interets',
  commissions_nettes: 'commissions_nettes', charges_exploitation: 'charges_exploitation', resultat_brut_exploitation: 'resultat_brut_exploitation',
  cout_du_risque: 'cout_du_risque', total_bilan: 'total_bilan', credits_clientele: 'credits_clientele', depots_clientele: 'depots_clientele',
  fonds_propres: 'fonds_propres', creances_souffrance_brutes: 'creances_souffrance_brutes', taux_creances_souffrance: 'taux_creances_souffrance',
  couverture_creances_souffrance: 'couverture_creances_souffrance', ratio_solvabilite: 'solvabilite_total', ratio_cet1: 'ratio_cet1', ratio_tier1: 'ratio_tier1',
};

const MOIS: Record<CodePeriode, number> = { T1: 3, S1: 6, T3: 9, exercice: 12 };

const nf = (v: number, d: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (fraction: number) => `${nf(fraction * 100, 1)} %`;

/** Devise d'un montant : « USD » pour un document en dollars, « FCFA » sinon. */
export function deviseDe(unite: Unite): string {
  return unite === 'usd' ? 'USD' : 'FCFA';
}

/** Montant court avec son unité : « 3 000 Md FCFA », « 1,2 Md USD », « 14,39 % ». */
export function montantCourt(v: number, unite: Unite): string {
  if (unite === 'pct') return `${nf(v, 2)} %`;
  return `${nf(v / 1e9, Math.abs(v) >= 1e12 ? 0 : 1)} Md ${deviseDe(unite)}`;
}
const minuscule = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function lirePeriode(periode: string): { annee: number; code: CodePeriode } | null {
  if (/^\d{4}$/.test(periode)) return { annee: Number(periode), code: 'exercice' };
  if (/^\d{4}-12-31$/.test(periode)) return { annee: Number(periode.slice(0, 4)), code: 'exercice' };
  const m = /^(\d{4})-(T1|S1|T3)$/.exec(periode);
  return m ? { annee: Number(m[1]), code: m[2] as CodePeriode } : null;
}

export function libellePeriode(annee: number, code: CodePeriode): string {
  switch (code) {
    case 'T1': return `1er trimestre ${annee}`;
    case 'S1': return `1er semestre ${annee}`;
    case 'T3': return `9 premiers mois de ${annee}`;
    default: return `exercice ${annee}`;
  }
}

export function avecArticle(annee: number, code: CodePeriode): string {
  const l = libellePeriode(annee, code);
  return code === 'T3' ? `les ${l}` : code === 'exercice' ? `l’${l}` : `le ${l}`;
}

const POUR_CE: Record<CodePeriode, string> = { T1: 'ce trimestre', S1: 'ce semestre', T3: 'ces neuf mois', exercice: 'cet exercice' };
const ANNUALISATION: Record<CodePeriode, string | null> = { T1: 'trimestre annualisé (×4)', S1: 'semestre annualisé (×2)', T3: 'neuf mois annualisés (×4/3)', exercice: null };

export function periodesDepuisLignes(income: LigneComptesBancaire[], balance: LigneComptesBancaire[]): PeriodeBancaire[] {
  const parCle = new Map<string, PeriodeBancaire>();
  const periodeDe = (l: LigneComptesBancaire): PeriodeBancaire | null => {
    const p = lirePeriode(l.periode);
    if (!p) return null;
    const k = `${p.annee}|${p.code}`;
    let pb = parCle.get(k);
    if (!pb) {
      pb = { annee: p.annee, code: p.code, valeurs: {} };
      parCle.set(k, pb);
    }
    return pb;
  };
  for (const l of [...income, ...balance]) {
    const pb = periodeDe(l);
    if (!pb) continue;
    const ls = l.lignes_specifiques ?? {};
    for (const [cle, s] of Object.entries(l.sources_specifiques ?? {})) {
      const ag = CLE_VERS_AGREGAT[cle];
      const brut = ls[cle];
      if (!ag || !s || brut == null || !Number.isFinite(Number(brut))) continue;
      pb.valeurs[ag] = { valeur: Number(brut), perimetre: s.perimetre, unite: s.unite ?? (EN_POURCENT.has(ag) ? 'pct' : 'fcfa'), source: { document_url: s.document_url, document_libelle: s.document_libelle, page: s.page } };
    }
  }
  for (const l of income) {
    const pb = periodeDe(l);
    if (pb && l.resultat_net != null && !pb.valeurs.resultat_net) pb.valeurs.resultat_net = { valeur: Number(l.resultat_net), perimetre: 'non_precise', unite: 'fcfa', source: null };
  }
  for (const l of balance) {
    const pb = periodeDe(l);
    if (pb && l.total_capitaux_propres != null && !pb.valeurs.fonds_propres) pb.valeurs.fonds_propres = { valeur: Number(l.total_capitaux_propres), perimetre: 'non_precise', unite: 'fcfa', source: null };
  }
  return [...parCle.values()].sort((a, b) => b.annee - a.annee || MOIS[b.code] - MOIS[a.code]);
}

const perimetresCompatibles = (a: Perimetre, b: Perimetre) => a === b || a === 'non_precise' || b === 'non_precise';
/** Même unité (jamais de conversion) et périmètres rapprochables. */
const compatibles = (a: Valeur, b: Valeur) => a.unite === b.unite && perimetresCompatibles(a.perimetre, b.perimetre);
const variationPct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
const trouver = (ps: PeriodeBancaire[], annee: number, code: CodePeriode) => ps.find((p) => p.annee === annee && p.code === code) ?? null;

function rapport(p: PeriodeBancaire | null, num: Agregat, den: Agregat): number | null {
  const x = p?.valeurs[num];
  const y = p?.valeurs[den];
  if (!x || !y || !compatibles(x, y) || !(y.valeur > 0)) return null;
  return x.valeur / y.valeur;
}

function comparer(cour: PeriodeBancaire, ag: Agregat, ref: PeriodeBancaire | null): Comparaison | null {
  const v = cour.valeurs[ag];
  const r = ref?.valeurs[ag];
  if (!v || !r || !ref || !compatibles(v, r)) return null;
  const enPoints = EN_POURCENT.has(ag);
  return { valeur: r.valeur, libelle: libellePeriode(ref.annee, ref.code), variation: enPoints ? v.valeur - r.valeur : variationPct(v.valeur, r.valeur), uniteVariation: enPoints ? 'pts' : '%' };
}

function ligneAgregat(cour: PeriodeBancaire, ag: Agregat, nm1: PeriodeBancaire | null, cloture: PeriodeBancaire | null): LigneAgregat {
  return {
    cle: ag, libelle: LIBELLES[ag], unite: cour.valeurs[ag]!.unite, valeur: cour.valeurs[ag]!,
    precedent: comparer(cour, ag, nm1), cloture: cloture ? comparer(cour, ag, cloture) : null,
  };
}

export function lireBanque(periodes: PeriodeBancaire[], visee: { annee: number; code: CodePeriode }): LectureBancaire | null {
  const cour = trouver(periodes, visee.annee, visee.code);
  if (!cour) return null;
  const nm1 = trouver(periodes, visee.annee - 1, visee.code);
  const annuelNm1 = trouver(periodes, visee.annee - 1, 'exercice');
  const cloture = visee.code === 'exercice' ? null : annuelNm1;
  const facteur = 12 / MOIS[visee.code];

  const compteResultat = ORDRE_CR.filter((ag) => cour.valeurs[ag]).map((ag) => ligneAgregat(cour, ag, nm1, null));
  const encours = ORDRE_ENCOURS.filter((ag) => cour.valeurs[ag]).map((ag) => ligneAgregat(cour, ag, nm1, cloture));

  const ratios: LigneRatio[] = [];
  const coef = rapport(cour, 'charges_exploitation', 'pnb');
  if (coef != null) {
    ratios.push({ cle: 'coefficient_exploitation', libelle: 'Coefficient d’exploitation', valeur: coef, precedent: rapport(nm1, 'charges_exploitation', 'pnb'), phrase: `Les charges d’exploitation représentent ${pct(coef)} du PNB.`, mention: null });
  }
  const cdr = rapport(cour, 'cout_du_risque', 'credits_clientele');
  if (cdr != null) {
    const prec = rapport(nm1, 'cout_du_risque', 'credits_clientele');
    ratios.push({
      cle: 'cout_du_risque_relatif', libelle: 'Coût du risque rapporté aux crédits', valeur: cdr * facteur, precedent: prec == null ? null : prec * facteur,
      phrase: `Le coût du risque représente ${pct(cdr * facteur)} de l’encours de crédits à la clientèle${ANNUALISATION[visee.code] ? `, ${ANNUALISATION[visee.code]}` : ''}.`,
      mention: ANNUALISATION[visee.code],
    });
  }
  const cd = rapport(cour, 'credits_clientele', 'depots_clientele');
  if (cd != null) {
    ratios.push({ cle: 'credits_sur_depots', libelle: 'Crédits ÷ dépôts', valeur: cd, precedent: rapport(nm1, 'credits_clientele', 'depots_clientele'), phrase: `Les crédits à la clientèle représentent ${pct(cd)} des dépôts de la clientèle.`, mention: null });
  }
  const fp = cour.valeurs.fonds_propres;
  const rn = cour.valeurs.resultat_net;
  if (fp && rn && fp.valeur > 0 && compatibles(fp, rn)) {
    if (visee.code === 'exercice') {
      const roe = rn.valeur / fp.valeur;
      ratios.push({ cle: 'roe', libelle: 'Rentabilité des fonds propres', valeur: roe, precedent: rapport(nm1, 'resultat_net', 'fonds_propres'), phrase: `Le résultat net de l’exercice représente ${pct(roe)} des fonds propres.`, mention: null });
    } else {
      const rnNm1 = nm1?.valeurs.resultat_net;
      const rnAn = annuelNm1?.valeurs.resultat_net;
      const termes = [rn, rnNm1, rnAn, fp];
      const ok = rnNm1 && rnAn && termes.every((a) => termes.every((b) => compatibles(a!, b!)));
      if (ok) {
        const roe = (rnAn!.valeur + rn.valeur - rnNm1!.valeur) / fp.valeur;
        ratios.push({
          cle: 'roe', libelle: 'Rentabilité des fonds propres', valeur: roe, precedent: null,
          phrase: `Le résultat net des douze derniers mois représente ${pct(roe)} des fonds propres.`,
          mention: `douze mois glissants : exercice ${visee.annee - 1} + ${libellePeriode(visee.annee, visee.code)} − ${libellePeriode(visee.annee - 1, visee.code)}`,
        });
      }
    }
  }

  const nonPublies = PRINCIPAUX.filter((ag) => !cour.valeurs[ag]).map((ag) => LIBELLES[ag]);
  const extrait = Object.values(cour.valeurs).some((v) => v?.source != null);
  const mentionNonPublies = extrait && nonPublies.length
    ? `Autres agrégats non publiés pour ${POUR_CE[visee.code]} : ${nonPublies.map(minuscule).join(', ')}.`
    : null;

  // Constat : PNB d'abord, puis le plus marquant (score = écart ÷ seuil de lecture ; ≥ 1 pour être cité).
  const lignePnb = compteResultat.find((l) => l.cle === 'pnb');
  const constat: Constat = { pnb: lignePnb ? { valeur: lignePnb.valeur.valeur, variation: lignePnb.precedent?.variation ?? null } : null, second: null };
  const candidats: { cle: 'coefficient_exploitation' | 'cout_du_risque' | 'resultat_net'; variation: number; valeur: number; score: number }[] = [];
  const rCoef = ratios.find((r) => r.cle === 'coefficient_exploitation');
  if (rCoef?.precedent != null) {
    const ecart = (rCoef.valeur - rCoef.precedent) * 100;
    candidats.push({ cle: 'coefficient_exploitation', variation: ecart, valeur: rCoef.valeur, score: Math.abs(ecart) / 2 });
  }
  for (const [cle, seuil] of [['cout_du_risque', 20], ['resultat_net', 10]] as const) {
    const l = compteResultat.find((x) => x.cle === cle);
    const v = l?.precedent?.variation;
    if (l && v != null) candidats.push({ cle, variation: v, valeur: l.valeur.valeur, score: Math.abs(v) / seuil });
  }
  const meilleur = candidats.filter((c) => c.score >= 1).sort((a, b) => b.score - a.score)[0];
  if (meilleur) constat.second = { cle: meilleur.cle, variation: meilleur.variation, valeur: meilleur.valeur };

  const sens = (v: number) => (v >= 0 ? 'hausse' : 'baisse');
  const art = avecArticle(visee.annee, visee.code);
  const debut = constat.pnb
    ? constat.pnb.variation != null
      ? `PNB en ${sens(constat.pnb.variation)} de ${nf(Math.abs(constat.pnb.variation), 1)} % sur ${art}`
      : `PNB de ${montantCourt(constat.pnb.valeur, lignePnb!.unite)} sur ${art}`
    : null;
  const s = constat.second;
  const suite = s
    ? s.cle === 'coefficient_exploitation'
      ? `coefficient d’exploitation en ${sens(s.variation)} de ${nf(Math.abs(s.variation), 1)} point${Math.abs(s.variation) >= 2 ? 's' : ''}, à ${pct(s.valeur)}`
      : `${s.cle === 'cout_du_risque' ? 'coût du risque' : 'résultat net'} en ${sens(s.variation)} de ${nf(Math.abs(s.variation), 1)} %`
    : null;
  const prefixe = visee.code === 'exercice' ? 'de l’' : visee.code === 'T3' ? 'des ' : 'du ';
  const titre = debut && suite ? `${debut}, ${suite}` : debut ?? (suite ? `${majuscule(suite)} sur ${art}` : `Comptes ${prefixe}${libellePeriode(visee.annee, visee.code)}`);

  const vus = new Set<string>();
  const sources: SourceValeur[] = [];
  for (const v of Object.values(cour.valeurs)) {
    if (!v?.source || vus.has(v.source.document_url)) continue;
    vus.add(v.source.document_url);
    sources.push(v.source);
  }

  return {
    annee: visee.annee, code: visee.code, libelle: libellePeriode(visee.annee, visee.code), libellePrecedent: libellePeriode(visee.annee - 1, visee.code),
    extrait, compteResultat, encours, ratios, nonPublies, mentionNonPublies, constat, titre, sources,
  };
}

/** Dernier exercice portant une valeur sourcée ; à défaut le dernier exercice ; null sinon. */
export function dernierExercice(periodes: PeriodeBancaire[]): { annee: number; code: 'exercice' } | null {
  const exercices = periodes.filter((p) => p.code === 'exercice');
  const p = exercices.find((x) => Object.values(x.valeurs).some((v) => v?.source != null)) ?? exercices[0];
  return p ? { annee: p.annee, code: 'exercice' } : null;
}
