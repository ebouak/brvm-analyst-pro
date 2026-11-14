/**
 * Assemblage des données du screener — fonctions pures, testées.
 *
 * Défauts corrigés le 2026-11-13 (audit du screener) :
 * - les signaux étaient lus à la date de la DERNIÈRE COTATION. En séance, la
 *   cotation intraday du jour existe déjà alors que le scoring porte sur la
 *   veille : aucune ligne ne correspondait, et RSI comme score s'affichaient
 *   « — » pour les 48 valeurs ;
 * - le RSI était « estimé » depuis le sous-score `score_rsi`, borné à ±1 : il
 *   ne pouvait pas sortir de [30 ; 70], donc le préréglage « Survendu (RSI<30) »
 *   ne pouvait rien trouver ;
 * - le dividende retenu pouvait être une ligne sans exercice ou à montant nul.
 */
import { rsiSeries } from '@/lib/indicators';

export interface SignalLigne { code: string; date_marche: string; score_total: number | null }

/** Dernier signal connu par valeur, à la date de cotation ou avant (lignes dans n'importe quel ordre). */
export function dernierSignalParCode(lignes: SignalLigne[], dateMax: string): Map<string, SignalLigne> {
  const out = new Map<string, SignalLigne>();
  for (const l of lignes) {
    if (l.date_marche > dateMax) continue;
    const prec = out.get(l.code);
    if (!prec || l.date_marche > prec.date_marche) out.set(l.code, l);
  }
  return out;
}

export interface DividendeLigne { code: string; montant: number; exercice: number | null }

/** Dernier dividende versé par valeur : exercice connu et montant > 0 seulement. */
export function dernierDividendeParCode(lignes: DividendeLigne[]): Map<string, DividendeLigne> {
  const out = new Map<string, DividendeLigne>();
  for (const l of lignes) {
    if (l.exercice == null || !(l.montant > 0)) continue;
    const prec = out.get(l.code);
    if (!prec || l.exercice > (prec.exercice as number)) out.set(l.code, l);
  }
  return out;
}

export interface ClotureLigne { code: string; date_marche: string; cours_jour: number | null }

/** RSI 14 (Wilder) de la dernière séance, par valeur. `null` sous 15 clôtures. */
export function rsiParCode(lignes: ClotureLigne[], periode = 14): Map<string, number> {
  const parCode = new Map<string, ClotureLigne[]>();
  for (const l of lignes) {
    const liste = parCode.get(l.code) ?? [];
    liste.push(l);
    parCode.set(l.code, liste);
  }
  const out = new Map<string, number>();
  for (const [code, liste] of parCode) {
    const closes = liste
      .slice()
      .sort((a, b) => a.date_marche.localeCompare(b.date_marche))
      .map((l) => l.cours_jour)
      .filter((v): v is number => v != null && v > 0);
    const serie = rsiSeries(closes, periode);
    const dernier = serie.length > 0 ? serie[serie.length - 1] : null;
    if (dernier != null && Number.isFinite(dernier)) out.set(code, dernier);
  }
  return out;
}

export interface VolumeLigne { code: string; date_marche: string; volume: number | null }

/**
 * Volume de la dernière séance ÷ moyenne des 20 séances précédentes (séances
 * sans échange comptées à zéro). `null` sous 5 séances d'historique ou si la
 * moyenne est nulle.
 */
export function ratioVolumeParCode(lignes: VolumeLigne[], fenetre = 20): Map<string, number> {
  const parCode = new Map<string, VolumeLigne[]>();
  for (const l of lignes) {
    const liste = parCode.get(l.code) ?? [];
    liste.push(l);
    parCode.set(l.code, liste);
  }
  const out = new Map<string, number>();
  for (const [code, liste] of parCode) {
    const tri = liste.slice().sort((a, b) => a.date_marche.localeCompare(b.date_marche));
    if (tri.length < 6) continue;
    const dernier = tri[tri.length - 1]!.volume ?? 0;
    const precedents = tri.slice(-1 - fenetre, -1).map((l) => l.volume ?? 0);
    const moyenne = precedents.reduce((a, b) => a + b, 0) / precedents.length;
    if (moyenne > 0) out.set(code, dernier / moyenne);
  }
  return out;
}
