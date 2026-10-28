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
const MIN_HISTORIQUE = 10;
const MAX_SEANCES = 2;

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

function seances(ctx: Contexte, divs: DividendeRow[]): Fait[] {
  const candidats: { fait: Fait; poids: number }[] = [];
  for (const c of Object.values(ctx.cours)) {
    if (c.date_marche !== ctx.derniereSeance || c.cours_jour == null || c.variation_pct == null || !c.volume) continue;
    const hist = (ctx.historique[c.code] ?? []).slice(-30).filter((h) => (h.volume ?? 0) > 0);
    if (hist.length < MIN_HISTORIQUE) continue;
    const moyenne = hist.reduce((s, h) => s + (h.volume ?? 0), 0) / hist.length;
    const ratioVolume = c.volume / moyenne;
    const record =
      c.cours_haut_52s && c.cours_jour >= c.cours_haut_52s
        ? 'haut'
        : c.cours_bas_52s && c.cours_jour <= c.cours_bas_52s
          ? 'bas'
          : null;
    if (ratioVolume < SEUIL_VOLUME || !(Math.abs(c.variation_pct) >= SEUIL_VARIATION || record)) continue;
    // Un détachement à la séance ou depuis la précédente est JUXTAPOSÉ, jamais
    // présenté comme la cause du mouvement (assertNoCausalClaim veille).
    const veille = hist[hist.length - 1]?.date_marche ?? c.date_marche;
    const detache = divs.find(
      (d) => d.code === c.code && d.montant && d.ex_date && d.ex_date >= veille && d.ex_date <= c.date_marche,
    );
    candidats.push({
      poids: Math.max(Math.abs(c.variation_pct), 1) * ratioVolume,
      fait: {
        type: 'seance_hors_norme',
        code: c.code,
        cle: c.date_marche,
        dateFait: c.date_marche,
        donnees: {
          cours: c.cours_jour,
          variation: c.variation_pct,
          volume: c.volume,
          volume_moyen: Math.round(moyenne),
          ratio_volume: arrondi(ratioVolume, 1),
          seances_moyenne: hist.length,
          record,
          dividende_detache: detache?.montant ?? null,
          date_detachement: detache?.ex_date ?? null,
        },
      },
    });
  }
  return candidats
    .sort((a, b) => b.poids - a.poids)
    .slice(0, MAX_SEANCES)
    .map((c) => c.fait);
}

export function detecter(ctx: Contexte, divs: DividendeRow[], ops: OperationRow[]): Fait[] {
  return [...dividendes(ctx, divs), ...operations(ctx, ops), ...seances(ctx, divs)];
}
