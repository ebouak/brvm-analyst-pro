import { rangTransversal, moyenne, ecartType } from './stats.js';
import { perfIndice, type Indice } from './indice.js';
import type { ComptesAnnuels, Donnees, FamilleFacteur, Serie } from './types.js';

/** Paramètres FIGÉS (spec §2.2). Toute modification invalide le PREREG. */
export const PARAMS = {
  tendanceCourte: 60,
  tendanceLongue: 120,
  volatilite: 60,
  baisseMax: 120,
  partEchangeeMin: 0.6,
  minParFamilleComptable: 5,
} as const;
export const MIN_COUVERTURE = 15;

export type ScoresFamilles = Record<FamilleFacteur, number | null>;

function fenetreEchangee(s: Serie, p: number, longueur: number): boolean {
  if (p - longueur < 0) return false;
  let echangees = 0;
  for (let i = p - longueur + 1; i <= p; i++) if ((s.volumes[i] ?? 0) > 0) echangees++;
  return echangees / longueur >= PARAMS.partEchangeeMin;
}

/** Derniers comptes disponibles à `date`, et ceux de l'exercice précédent. */
function comptesA(comptes: ComptesAnnuels[], code: string, date: string): { n: ComptesAnnuels | null; nm1: ComptesAnnuels | null } {
  const dispo = comptes.filter((c) => c.code === code && c.disponibleLe <= date).sort((a, b) => b.exercice - a.exercice);
  const n = dispo[0] ?? null;
  const nm1 = n ? dispo.find((c) => c.exercice === n.exercice - 1) ?? null : null;
  return { n, nm1 };
}

/** Ratio rapporté à la médiane de sa famille comptable (≥ 5 valeurs, sinon null). */
function rapportMediane(brut: Map<string, number | null>, familles: Donnees['familles']): Map<string, number | null> {
  const parFamille = new Map<string, number[]>();
  for (const [code, v] of brut) {
    if (v == null) continue;
    const f = familles.get(code) ?? 'general';
    (parFamille.get(f) ?? parFamille.set(f, []).get(f)!).push(v);
  }
  const medianes = new Map<string, number | null>();
  for (const [f, vs] of parFamille) {
    if (vs.length < PARAMS.minParFamilleComptable) { medianes.set(f, null); continue; }
    const t = [...vs].sort((a, b) => a - b);
    const m = t.length % 2 ? t[(t.length - 1) / 2]! : (t[t.length / 2 - 1]! + t[t.length / 2]!) / 2;
    medianes.set(f, m > 0 ? m : null);
  }
  const out = new Map<string, number | null>();
  for (const [code, v] of brut) {
    const m = medianes.get(familles.get(code) ?? 'general') ?? null;
    out.set(code, v != null && m != null ? v / m : null);
  }
  return out;
}

/** Moyenne des rangs disponibles ; null si aucun. Couverture < 15 → famille nulle partout. */
function famille(rangs: Map<string, number | null>[], codes: string[]): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const c of codes) {
    const vs = rangs.map((r) => r.get(c)).filter((v): v is number => v != null);
    out.set(c, vs.length ? moyenne(vs) : null);
  }
  const couverts = [...out.values()].filter((v) => v != null).length;
  if (couverts < MIN_COUVERTURE) for (const c of codes) out.set(c, null);
  return out;
}

/** Scores des 5 familles pour toutes les valeurs cotées à `date`. Aucune donnée postérieure n'est lue. */
export function scoresFamilles(d: Donnees, ind: Indice, date: string): Map<string, ScoresFamilles> {
  const codes = [...d.series].filter(([, s]) => s.pos.has(date)).map(([c]) => c);
  const m = () => new Map<string, number | null>();
  const brut = { t60: m(), t120: m(), vol: m(), dd: m(), per: m(), pb: m(), croiss: m(), roe: m(), rdt: m() };
  for (const code of codes) {
    const s = d.series.get(code)!;
    const p = s.pos.get(date)!;
    const cours = s.cours[p]!;
    for (const [long, cible] of [[PARAMS.tendanceCourte, brut.t60], [PARAMS.tendanceLongue, brut.t120]] as const) {
      cible.set(code, fenetreEchangee(s, p, long)
        ? cours / s.cours[p - long]! - 1 - perfIndice(ind, d.calendrier, s.dates[p - long]!, date)
        : null);
    }
    if (fenetreEchangee(s, p, PARAMS.volatilite)) {
      const r: number[] = [];
      for (let i = p - PARAMS.volatilite + 1; i <= p; i++) if ((s.volumes[i] ?? 0) > 0) r.push(Math.log(s.cours[i]! / s.cours[i - 1]!));
      brut.vol.set(code, r.length > 2 ? ecartType(r) : null);
    } else brut.vol.set(code, null);
    if (fenetreEchangee(s, p, PARAMS.baisseMax)) {
      let pic = 0, pire = 0;
      for (let i = p - PARAMS.baisseMax; i <= p; i++) { pic = Math.max(pic, s.cours[i]!); pire = Math.min(pire, s.cours[i]! / pic - 1); }
      brut.dd.set(code, -pire);
    } else brut.dd.set(code, null);
    const { n, nm1 } = comptesA(d.comptes, code, date);
    const capi = n?.actions != null && n.actions > 0 ? cours * n.actions : null;
    brut.per.set(code, capi != null && n?.resultatNet != null && n.resultatNet > 0 ? capi / n.resultatNet : null);
    brut.pb.set(code, capi != null && n?.capitauxPropres != null && n.capitauxPropres > 0 ? capi / n.capitauxPropres : null);
    brut.croiss.set(code, n?.resultatNet != null && nm1?.resultatNet != null && nm1.resultatNet !== 0
      ? (n.resultatNet - nm1.resultatNet) / Math.abs(nm1.resultatNet) : null);
    brut.roe.set(code, n?.resultatNet != null && n.capitauxPropres != null && n.capitauxPropres > 0 ? n.resultatNet / n.capitauxPropres : null);
    const div = d.dividendes.filter((x) => x.code === code && x.disponibleLe <= date).sort((a, b) => b.exercice - a.exercice)[0];
    brut.rdt.set(code, div && cours > 0 ? div.montant / cours : null);
  }
  const familles: Record<FamilleFacteur, Map<string, number | null>> = {
    valorisation: famille([rangTransversal(rapportMediane(brut.per, d.familles), -1), rangTransversal(rapportMediane(brut.pb, d.familles), -1)], codes),
    qualite: famille([rangTransversal(brut.croiss, 1), rangTransversal(rapportMediane(brut.roe, d.familles), 1)], codes),
    rendement: famille([rangTransversal(brut.rdt, 1)], codes),
    tendance: famille([rangTransversal(brut.t60, 1), rangTransversal(brut.t120, 1)], codes),
    risque: famille([rangTransversal(brut.vol, -1), rangTransversal(brut.dd, -1)], codes),
  };
  const out = new Map<string, ScoresFamilles>();
  for (const c of codes) {
    out.set(c, {
      valorisation: familles.valorisation.get(c) ?? null,
      qualite: familles.qualite.get(c) ?? null,
      rendement: familles.rendement.get(c) ?? null,
      tendance: familles.tendance.get(c) ?? null,
      risque: familles.risque.get(c) ?? null,
    });
  }
  return out;
}
