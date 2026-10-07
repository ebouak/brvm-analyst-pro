/**
 * Passe la valeur retenue de `indicateur_source` vers `lignes_specifiques`,
 * exercice par exercice, selon `selectionnerExercice`.
 *
 * Écrit dans DEUX cas seulement :
 *   * une valeur est retenue et diffère de celle en base ;
 *   * les observations prouvent qu'aucune valeur n'est retenable (conflit,
 *     borne, estimation…) alors qu'un chiffre est en base — il est RETIRÉ
 *     (SIBC 2025 portait « 14 », lecture exacte d'une borne « > 14 % »).
 * Un exercice sans observation, ou seulement « non trouvé », n'est pas touché :
 * l'absence d'une valeur dans les documents consultés ne prouve pas que celle
 * en base, venue d'un autre document, soit fausse.
 *
 * Aucune ligne de bilan n'est créée ; chaque écriture est tracée dans
 * correction_champ.
 *
 * Correspondance volontairement limitée à la solvabilité totale. Les créances
 * en souffrance (PCB) ne sont PAS versées dans `creances_douteuses` : les deux
 * définitions ne se fusionnent pas (règle de 0147).
 */

import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { selectionnerExercice, type Decision, type ObsPrudentielle } from './selection.js';

const log = logger.child({ module: 'prudentiel-selection' });

export const CORRESPONDANCE = { solvabilite_total: 'ratio_solvabilite' } as const;

export interface LigneDecision {
  code: string;
  periode: string;
  champ: string;
  avant: number | null;
  apres: number | null;
  decision: Decision['etat'];
  ecrit: boolean;
}

interface ObsLue extends ObsPrudentielle {
  code: string;
  indicateur: string;
  document_libelle: string | null;
  page: number | null;
}

/**
 * Date d'arrêté d'une période annuelle. Deux formats coexistent en base :
 * « 2025 » et « 2025-12-31 » (BICB). Toute autre forme n'est pas un exercice
 * clos au 31 décembre et n'est pas appariée.
 */
export function dateArrete(periode: string): string | null {
  if (/^\d{4}$/.test(periode)) return `${periode}-12-31`;
  if (/^\d{4}-12-31$/.test(periode)) return periode;
  return null;
}

function motifTrace(d: Decision, obs: ObsLue[]): { motif: string; source: string | null } {
  const par = new Map(obs.map((o) => [o.id, o]));
  const src = (id: string) => {
    const o = par.get(id);
    return o ? `${o.document_libelle ?? o.document_url}${o.page ? `, p. ${o.page}` : ''}` : null;
  };
  const plusieurs = (ids: string[]) => ids.map(src).filter(Boolean).join(' ; ') || null;
  switch (d.etat) {
    case 'retenue':
      return {
        motif: `Valeur retenue depuis indicateur_source (${d.classe === 'unique' ? 'source unique' : 'compatibles à l’arrondi, la plus précise'}, périmètre ${d.perimetre})${d.reserve ? ' — contrôle documentaire en cours' : ''}.`,
        source: src(d.observation),
      };
    case 'conflit':
      return { motif: 'Retirée : sources contradictoires, aucune valeur retenue (source_conflict).', source: plusieurs(d.observations) };
    case 'borne':
      return { motif: `Retirée : seule une borne est publiée (${d.comparateur} ${d.valeur}), jamais une valeur exacte.`, source: src(d.observation) };
    case 'non_exploitable':
      return { motif: `Retirée : publiée mais non exploitable (${d.motif ?? 'motif non précisé'}).`, source: plusieurs(d.observations) };
    case 'non_applicable':
      return { motif: 'Retirée : indicateur non applicable à cet émetteur.', source: null };
    default:
      return { motif: '', source: null };
  }
}

export async function runSelectionPrudentielle(opts: { dryRun: boolean; codes?: string[] }): Promise<{ lignes: LigneDecision[]; ecrites: number }> {
  const sb = getSupabase();
  const indicateurs = Object.keys(CORRESPONDANCE);

  let q = sb.from('indicateur_source')
    .select('id,code,indicateur,date_arrete,perimetre,statut,valeur,comparateur,texte_original,motif,document_url,document_libelle,page')
    .in('indicateur', indicateurs);
  if (opts.codes?.length) q = q.in('code', opts.codes);
  const { data: obs, error } = await q;
  if (error) throw new Error(`indicateur_source : ${error.message}`);
  const toutes = (obs ?? []).map((o) => ({ ...o, valeur: o.valeur == null ? null : Number(o.valeur) })) as ObsLue[];

  const codes = [...new Set(toutes.map((o) => o.code))];
  if (codes.length === 0) return { lignes: [], ecrites: 0 };
  const { data: bilans, error: e2 } = await sb.from('balance_sheets')
    .select('code,periode,lignes_specifiques')
    .in('code', codes).eq('type_periode', 'annuel');
  if (e2) throw new Error(`balance_sheets : ${e2.message}`);

  const lignes: LigneDecision[] = [];
  let ecrites = 0;
  for (const bilan of bilans ?? []) {
    const ls = { ...((bilan.lignes_specifiques as Record<string, unknown> | null) ?? {}) };
    const traces: { champ: string; avant: number | null; apres: number | null; motif: string; source: string | null }[] = [];

    for (const [indicateur, champ] of Object.entries(CORRESPONDANCE)) {
      const obsCode = toutes.filter((o) => o.code === bilan.code && o.indicateur === indicateur);
      const date = dateArrete(String(bilan.periode));
      if (!date) continue;
      const d = selectionnerExercice(obsCode, date);
      const brut = ls[champ];
      const avant = brut == null ? null : Number(brut);
      let apres = avant;
      if (d.etat === 'retenue') apres = d.valeur;
      else if (d.etat === 'conflit' || d.etat === 'borne' || d.etat === 'non_exploitable' || d.etat === 'non_applicable') apres = null;
      const change = apres !== avant;
      lignes.push({ code: bilan.code, periode: String(bilan.periode), champ, avant, apres, decision: d.etat, ecrit: change && !opts.dryRun });
      if (!change) continue;
      ls[champ] = apres;
      traces.push({ champ, avant, apres, ...motifTrace(d, obsCode) });
    }

    if (traces.length === 0 || opts.dryRun) continue;
    const { error: e3 } = await sb.from('balance_sheets').update({ lignes_specifiques: ls })
      .eq('code', bilan.code).eq('type_periode', 'annuel').eq('periode', bilan.periode);
    if (e3) throw new Error(`balance_sheets ${bilan.code} ${bilan.periode} : ${e3.message}`);
    const { error: e4 } = await sb.from('correction_champ').insert(traces.map((t) => ({
      table_cible: 'balance_sheets',
      code: bilan.code,
      periode: String(bilan.periode),
      champ: `lignes_specifiques.${t.champ}`,
      valeur_avant: t.avant,
      valeur_apres: t.apres,
      motif: t.motif,
      source_externe: t.source,
      corrige_par: 'selection-prudentielle',
    })));
    if (e4) log.error({ code: bilan.code, err: e4.message }, 'trace correction_champ non écrite');
    ecrites += traces.length;
  }

  // Exercices observés sans ligne de bilan : signalés, jamais créés.
  const avecBilan = new Set((bilans ?? []).map((b) => `${b.code}|${dateArrete(String(b.periode))}`));
  const orphelins = [...new Set(toutes.filter((o) => o.date_arrete?.endsWith('-12-31'))
    .map((o) => `${o.code}|${o.date_arrete}`))].filter((k) => !avecBilan.has(k));
  if (orphelins.length) log.warn({ orphelins }, 'observations sans ligne de bilan annuel — non écrites');

  return { lignes, ecrites };
}
