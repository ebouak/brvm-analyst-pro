/**
 * Sélection des agrégats bancaires — I/O. Lit toutes les observations des
 * banques (paginées : PostgREST tronque à 1000 EN SILENCE), y ajoute celles
 * en mémoire (reprise à blanc), calcule le plan (ecritures.ts) et, hors
 * dryRun, l'applique : lignes_specifiques + sources_specifiques, traces
 * correction_champ, éléments de relecture non encore ouverts.
 *
 * Miroir côté frontend (une banque, décision de relecture appliquée
 * immédiatement) : frontend/lib/admin/rejouerSelection.ts. Toute correction
 * de la logique d'écriture se reporte des deux côtés.
 *
 * Base sans 0245 : seule la lecture À BLANC se replie sur les colonnes de
 * 0147-0149 (avertissement dans le rapport). Une écriture l'exige, et lève.
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { INDICATEURS_AGREGATS } from './indicateurs.js';
import { periodeDeDate } from './dates.js';
import { planifierEcritures, type LigneComptes, type ObsLue, type PlanEcritures } from './ecritures.js';
import { AVERTISSEMENT_SANS_0245, colonneAbsente } from './runExtraction.js';

const log = logger.child({ module: 'agregats-selection' });
const COLONNES = 'id,code,indicateur,periode,date_arrete,perimetre,statut,valeur,comparateur,texte_original,motif,document_url,document_libelle,page,nature_source,provisoire,controle,controle_motif,unite,unite_source,decimales,methode';
const COLONNES_0149 = 'id,code,indicateur,date_arrete,perimetre,statut,valeur,comparateur,texte_original,motif,document_url,document_libelle,page,nature_source,provisoire,unite,decimales,methode';

type Erreur = { code?: string; message: string } | null;

async function paginer<T>(construire: (de: number, a: number) => PromiseLike<{ data: unknown; error: Erreur }>): Promise<{ lignes: T[]; erreur: Erreur }> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await construire(de, de + 999);
    if (error) return { lignes: out, erreur: error };
    const lot = (data ?? []) as T[];
    out.push(...lot);
    if (lot.length < 1000) return { lignes: out, erreur: null };
  }
}

export async function selectionnerAgregats(opts: { dryRun: boolean; codes: string[]; enMemoire?: ObsLue[] }): Promise<PlanEcritures & { ecrites: number; relecturesOuvertes: number; avertissements: string[] }> {
  const sb = getSupabase();
  const avertissements: string[] = [];
  const lire = (cols: string) => paginer<ObsLue>((de, a) =>
    sb.from('indicateur_source').select(cols).in('code', opts.codes).in('indicateur', INDICATEURS_AGREGATS).order('id').range(de, a));
  let r = await lire(COLONNES);
  if (colonneAbsente(r.erreur)) {
    if (!opts.dryRun) throw new Error(`indicateur_source : migration 0245 non appliquée (${r.erreur!.message}) — aucune écriture possible`);
    avertissements.push(AVERTISSEMENT_SANS_0245);
    r = await lire(COLONNES_0149);
    r = { ...r, lignes: r.lignes.map((o) => ({ ...o, periode: periodeDeDate(o.date_arrete) ?? 'exercice', controle: 'ok' as const })) };
  }
  if (r.erreur) throw new Error(`indicateur_source : ${r.erreur.message}`);

  // Reprise à blanc : la relecture en mémoire d'un document REMPLACE ses
  // anciennes lectures Gemini en base (sinon une même lecture compterait deux
  // fois). Les observations saisies à la main (0147) sont gardées.
  const urlsMemoire = new Set((opts.enMemoire ?? []).map((o) => o.document_url));
  const enBase = r.lignes
    .filter((o) => !(o.methode === 'gemini-agregats' && urlsMemoire.has(o.document_url)))
    .map((o) => ({ ...o, valeur: o.valeur == null ? null : Number(o.valeur) }));
  const ids = new Set(enBase.map((o) => o.id));
  const obs = [...enBase, ...(opts.enMemoire ?? []).filter((o) => !ids.has(o.id))];

  const lignes: LigneComptes[] = [];
  for (const table of ['income_statements', 'balance_sheets'] as const) {
    const lireLignes = (cols: string) => paginer<Omit<LigneComptes, 'table'>>((de, a) =>
      sb.from(table).select(cols).in('code', opts.codes).order('periode').order('type_periode').range(de, a));
    let l = await lireLignes('code,periode,type_periode,lignes_specifiques,sources_specifiques');
    if (colonneAbsente(l.erreur) && opts.dryRun) {
      if (!avertissements.includes(AVERTISSEMENT_SANS_0245)) avertissements.push(AVERTISSEMENT_SANS_0245);
      l = await lireLignes('code,periode,type_periode,lignes_specifiques');
      l = { ...l, lignes: l.lignes.map((x) => ({ ...x, sources_specifiques: null })) };
    }
    if (l.erreur) throw new Error(`${table} : ${l.erreur.message}`);
    lignes.push(...l.lignes.map((x) => ({ ...x, table })));
  }

  const plan = planifierEcritures(obs, lignes);
  if (plan.orphelins.length) log.warn({ orphelins: plan.orphelins }, 'observations sans ligne de comptes — non écrites');
  if (opts.dryRun) return { ...plan, ecrites: 0, relecturesOuvertes: plan.relectures.length, avertissements };

  let ecrites = 0;
  for (const m of plan.misesAJour) {
    const { error } = await sb.from(m.table).update({ lignes_specifiques: m.lignes_specifiques, sources_specifiques: m.sources_specifiques })
      .eq('code', m.code).eq('periode', m.periode).eq('type_periode', m.type_periode);
    if (error) throw new Error(`${m.table} ${m.code} ${m.periode} : ${error.message}`);
    if (m.traces.length) {
      const { error: e2 } = await sb.from('correction_champ').insert(m.traces.map((t) => ({
        table_cible: m.table, code: m.code, periode: m.periode, champ: t.champ,
        valeur_avant: t.avant, valeur_apres: t.apres, motif: t.motif, source_externe: t.source, corrige_par: 'selection-agregats',
      })));
      if (e2) throw new Error(`correction_champ ${m.code} ${m.periode} : ${e2.message}`);
    }
    ecrites += m.traces.length;
  }

  // Relecture : n'ouvre que ce qui n'est pas déjà ouvert (index unique partiel).
  const { data: ouvertes, error: e3 } = await sb.from('indicateur_relecture').select('code,indicateur,date_arrete,perimetre').eq('statut', 'ouverte').in('code', opts.codes);
  if (e3) throw new Error(`indicateur_relecture : ${e3.message}`);
  const deja = new Set((ouvertes ?? []).map((x) => `${x.code}|${x.indicateur}|${x.date_arrete}|${x.perimetre}`));
  const nouvelles = plan.relectures.filter((x) => !deja.has(`${x.code}|${x.indicateur}|${x.date_arrete}|${x.perimetre}`));
  if (nouvelles.length) {
    const { error: e4 } = await sb.from('indicateur_relecture').insert(nouvelles);
    if (e4) throw new Error(`indicateur_relecture (insertion) : ${e4.message}`);
  }
  return { ...plan, ecrites, relecturesOuvertes: deja.size + nouvelles.length, avertissements };
}
