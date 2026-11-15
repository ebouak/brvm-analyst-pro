import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { INDICATEURS_AGREGATS } from '@/lib/agregats/pure/agregats/indicateurs';
import { planifierEcritures, type LigneComptes, type ObsLue } from '@/lib/agregats/pure/agregats/ecritures';

/**
 * Applique IMMÉDIATEMENT une décision de relecture (avenant du 2026-11-15) :
 * rejoue la sélection des agrégats pour UNE banque et écrit la valeur
 * retenue — lignes_specifiques, sources_specifiques, trace correction_champ —
 * puis ouvre les éventuels nouveaux éléments de relecture.
 *
 * Miroir, pour une banque, de scraper/src/agregats/runSelectionAgregats.ts
 * (I/O non partageable entre les deux paquets). La DÉCISION elle-même vient
 * de la copie des modules purs du scraper (lib/agregats/pure/, vérifiée par
 * copie.test.ts) : cron et relecture décident à l'identique.
 *
 * Lève à la moindre erreur : l'appelant répond 500, jamais un faux succès.
 */
const COLONNES = 'id,code,indicateur,periode,date_arrete,perimetre,statut,valeur,comparateur,texte_original,motif,document_url,document_libelle,page,nature_source,provisoire,controle,controle_motif,unite,unite_source,decimales,methode';

async function paginer<T>(construire: (de: number, a: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await construire(de, de + 999);
    if (error) throw new Error(error.message);
    const lot = (data ?? []) as T[];
    out.push(...lot);
    if (lot.length < 1000) return out;
  }
}

export interface ResultatRejeu {
  /** Valeurs changées dans lignes_specifiques. */
  ecrites: number;
  /** Nouveaux éléments de relecture ouverts par ce rejeu. */
  ouvertes: number;
}

export async function rejouerSelectionBanque(db: SupabaseClient, code: string): Promise<ResultatRejeu> {
  const obs = (await paginer<ObsLue>((de, a) =>
    db.from('indicateur_source').select(COLONNES).eq('code', code).in('indicateur', INDICATEURS_AGREGATS).order('id').range(de, a)))
    .map((o) => ({ ...o, valeur: o.valeur == null ? null : Number(o.valeur) }));

  const lignes: LigneComptes[] = [];
  for (const table of ['income_statements', 'balance_sheets'] as const) {
    const rows = await paginer<Omit<LigneComptes, 'table'>>((de, a) =>
      db.from(table).select('code,periode,type_periode,lignes_specifiques,sources_specifiques').eq('code', code).order('periode').order('type_periode').range(de, a));
    lignes.push(...rows.map((r) => ({ ...r, table })));
  }

  const plan = planifierEcritures(obs, lignes);
  let ecrites = 0;
  for (const m of plan.misesAJour) {
    const { error } = await db.from(m.table).update({ lignes_specifiques: m.lignes_specifiques, sources_specifiques: m.sources_specifiques })
      .eq('code', m.code).eq('periode', m.periode).eq('type_periode', m.type_periode);
    if (error) throw new Error(`${m.table} ${m.periode} : ${error.message}`);
    if (m.traces.length) {
      const { error: e2 } = await db.from('correction_champ').insert(m.traces.map((t) => ({
        table_cible: m.table, code: m.code, periode: m.periode, champ: t.champ,
        valeur_avant: t.avant, valeur_apres: t.apres, motif: t.motif, source_externe: t.source, corrige_par: 'relecture-agregats',
      })));
      if (e2) throw new Error(`correction_champ ${m.periode} : ${e2.message}`);
    }
    ecrites += m.traces.length;
  }

  const { data: ouvertes, error: e3 } = await db.from('indicateur_relecture').select('indicateur,date_arrete,perimetre').eq('statut', 'ouverte').eq('code', code);
  if (e3) throw new Error(`indicateur_relecture : ${e3.message}`);
  const deja = new Set((ouvertes ?? []).map((r) => `${r.indicateur}|${r.date_arrete}|${r.perimetre}`));
  const nouvelles = plan.relectures.filter((r) => !deja.has(`${r.indicateur}|${r.date_arrete}|${r.perimetre}`));
  if (nouvelles.length) {
    const { error: e4 } = await db.from('indicateur_relecture').insert(nouvelles);
    if (e4) throw new Error(`indicateur_relecture (insertion) : ${e4.message}`);
  }
  return { ecrites, ouvertes: nouvelles.length };
}
