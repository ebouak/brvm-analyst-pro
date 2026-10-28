/**
 * Détecteurs du lot 1 : la base dit ce qui s'est passé, ces fonctions disent
 * ce qui mérite un article. Pures — le runner leur passe la donnée.
 */
import { ecartJours, joursOuvresEntre } from './calendrier.js';
import type { Contexte, CoursRow, DividendeRow, Fait, OperationRow } from './types.js';

/** Sources de dividendes dont un montant est publiable sans relecture. */
const SOURCES_FIABLES = new Set(['brvm-calendrier', 'brvm-boc', 'richbourse']);
const SEUIL_VARIATION = 5;
const SEUIL_VOLUME = 2;
const SEUIL_PART = 40; // % des capitaux de la séance
const MIN_HISTORIQUE = 10;
const MIN_COTES = 20;
const INDICES = ['BRVMC', 'BRVM30', 'BRVMPRES'];

const arrondi = (x: number, d: number) => Number(x.toFixed(d));

function rendement(montant: number, cours: CoursRow | undefined): number | null {
  const c = cours?.cours_jour;
  return c && c > 0 ? arrondi((montant / c) * 100, 2) : null;
}

function dividendes(ctx: Contexte, rows: DividendeRow[]): Fait[] {
  const faits: Fait[] = [];
  for (const d of rows) {
    if (!(d.montant && d.montant > 0) || d.exercice == null) continue;
    const donnees = {
      montant: d.montant,
      exercice: d.exercice,
      ex_date: d.ex_date,
      payment_date: d.payment_date,
      cours: ctx.cours[d.code]?.cours_jour ?? null,
      date_cours: ctx.derniereSeance,
      rendement: rendement(d.montant, ctx.cours[d.code]),
      source: d.source,
    };
    const inscrit = d.created_at.slice(0, 10);
    if (d.source && SOURCES_FIABLES.has(d.source) && ecartJours(inscrit, ctx.aujourdhui) <= 3) {
      faits.push({ type: 'dividende_annonce', code: d.code, cle: String(d.exercice), dateFait: inscrit, donnees });
    }
    if (d.ex_date) {
      const n = joursOuvresEntre(ctx.aujourdhui, d.ex_date);
      if (n >= 1 && n <= 3) faits.push({ type: 'detachement_rappel', code: d.code, cle: d.ex_date, dateFait: d.ex_date, donnees });
    }
    if (d.payment_date && joursOuvresEntre(ctx.aujourdhui, d.payment_date) === 1) {
      faits.push({ type: 'paiement_rappel', code: d.code, cle: d.payment_date, dateFait: d.payment_date, donnees });
    }
  }
  return faits;
}

function operations(ctx: Contexte, rows: OperationRow[]): Fait[] {
  return rows
    .filter((o) => o.ratio > 0 && Math.abs(ecartJours(ctx.aujourdhui, o.date_effet)) <= 5)
    .map((o) => ({
      type: 'operation_titres' as const,
      code: o.code,
      cle: o.date_effet,
      dateFait: o.date_effet,
      donnees: { ratio: o.ratio, operation: o.type, date_effet: o.date_effet, cours: ctx.cours[o.code]?.cours_jour ?? null },
    }));
}

/** Mouvement d'une valeur, pour la liste des autres hausses et baisses. */
export interface Mouvement {
  code: string;
  cours: number;
  variation: number;
}

/**
 * Le compte rendu de séance : UN par jour. L'angle est la valeur la plus
 * remarquable, dans cet ordre — record de capitaux sur tout l'historique en
 * base, puis valeur qui pèse au moins 40 % des échanges, puis séance hors
 * norme (variation ≥ 5 % ou record 52 semaines, sur un volume ≥ 2× sa
 * moyenne), sinon la plus forte variation.
 */
function seance(ctx: Contexte, divs: DividendeRow[], ops: OperationRow[]): Fait[] {
  const cotes = Object.values(ctx.cours).filter(
    (c) => c.date_marche === ctx.derniereSeance && c.cours_jour != null && c.variation_pct != null,
  );
  const total = cotes.reduce((s, c) => s + (c.valeur_echangee ?? 0), 0);
  if (cotes.length < MIN_COTES || total <= 0) return [];

  const evalues = cotes.map((c) => {
    const hist = (ctx.historique[c.code] ?? []).slice(-30).filter((h) => (h.volume ?? 0) > 0);
    const moyenne = hist.length >= MIN_HISTORIQUE ? hist.reduce((s, h) => s + (h.volume ?? 0), 0) / hist.length : null;
    const ratioVolume = moyenne && c.volume ? c.volume / moyenne : null;
    const valeur = c.valeur_echangee ?? 0;
    const part = (valeur / total) * 100;
    const prec = ctx.recordsValeur?.[c.code];
    const recordValeur = Boolean(prec && valeur > prec.valeur);
    const record52 =
      c.cours_haut_52s && c.cours_jour! >= c.cours_haut_52s ? 'haut' : c.cours_bas_52s && c.cours_jour! <= c.cours_bas_52s ? 'bas' : null;
    const v = Math.abs(c.variation_pct!);
    const horsNorme = ratioVolume != null && ratioVolume >= SEUIL_VOLUME && (v >= SEUIL_VARIATION || record52 != null);
    const rang = recordValeur ? 4 : part >= SEUIL_PART ? 3 : horsNorme ? 2 : 1;
    const departage = rang >= 3 ? valeur : rang === 2 ? v * (ratioVolume ?? 1) : v;
    return { c, hist, moyenne, ratioVolume, valeur, part, prec, recordValeur, record52, rang, departage };
  });
  const angle = [...evalues].sort((a, b) => b.rang - a.rang || b.departage - a.departage)[0]!;
  const c = angle.c;

  const veille = angle.hist[angle.hist.length - 1]?.date_marche ?? c.date_marche;
  const detache = divs.find((d) => d.code === c.code && d.montant && d.ex_date && d.ex_date >= veille && d.ex_date <= c.date_marche);
  const op = ops.find((o) => o.code === c.code && o.date_effet <= c.date_marche && ecartJours(o.date_effet, c.date_marche) <= 10);
  const mouvement = (x: CoursRow): Mouvement => ({ code: x.code, cours: x.cours_jour!, variation: x.variation_pct! });
  const autres = cotes.filter((x) => x.code !== c.code);
  const indice = (code: string) => {
    const i = ctx.indices?.find((x) => x.code === code);
    return i && i.valeur != null && i.variation_pct != null ? { valeur: i.valeur, variation: i.variation_pct } : null;
  };
  const actions = ctx.actions?.[c.code] ?? null;

  return [
    {
      type: 'seance_hors_norme',
      code: c.code,
      cle: c.date_marche,
      dateFait: c.date_marche,
      donnees: {
        rang: angle.rang,
        cours: c.cours_jour,
        cours_precedent: c.cours_precedent,
        variation: c.variation_pct,
        volume: c.volume,
        valeur: angle.valeur,
        total: total,
        part: arrondi(angle.part, 2),
        capitalisation_delta: actions && c.cours_precedent ? actions * (c.cours_jour! - c.cours_precedent) : null,
        record_valeur: angle.recordValeur,
        record_prec: angle.prec ?? null,
        volume_moyen: angle.moyenne != null ? Math.round(angle.moyenne) : null,
        ratio_volume: angle.ratioVolume != null ? arrondi(angle.ratioVolume, 1) : null,
        seances_moyenne: angle.hist.length,
        record: angle.record52,
        cours_haut_52s: c.cours_haut_52s,
        cours_bas_52s: c.cours_bas_52s,
        dividende_detache: detache?.montant ?? null,
        date_detachement: detache?.ex_date ?? null,
        operation: op ? { type: op.type, ratio: op.ratio, date_effet: op.date_effet } : null,
        indices: Object.fromEntries(INDICES.map((k) => [k, indice(k)])),
        hausses: autres.filter((x) => x.variation_pct! > 0).length + (c.variation_pct! > 0 ? 1 : 0),
        baisses: autres.filter((x) => x.variation_pct! < 0).length + (c.variation_pct! < 0 ? 1 : 0),
        stables: autres.filter((x) => x.variation_pct === 0).length + (c.variation_pct === 0 ? 1 : 0),
        top_hausses: [...autres].filter((x) => x.variation_pct! > 0).sort((a, b) => b.variation_pct! - a.variation_pct!).slice(0, 3).map(mouvement),
        top_baisses: [...autres].filter((x) => x.variation_pct! < 0).sort((a, b) => a.variation_pct! - b.variation_pct!).slice(0, 3).map(mouvement),
      },
    },
  ];
}

export function detecter(ctx: Contexte, divs: DividendeRow[], ops: OperationRow[]): Fait[] {
  return [...dividendes(ctx, divs), ...operations(ctx, ops), ...seance(ctx, divs, ops)];
}
