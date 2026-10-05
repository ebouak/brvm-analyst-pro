/**
 * Complément des comptes annuels (CLI `annuel:complement [CODES]`).
 * Décisions dans complement.ts (pur, testé) ; ici : lire, appeler Gemini,
 * écrire les seuls champs vides, tracer chaque champ dans correction_champ.
 *
 * Exercice visé : le DERNIER exercice annuel en base de chaque société.
 * Un exercice protégé (fundamentals.source = 'pdf-verified', ex. PALC) n'est
 * jamais touché. `--mock` : liste ce qui serait complété, n'appelle ni n'écrit.
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { resolveApiKeyForScraper } from '../hebdo/apiKey.js';
import { jsonDepuisPdf } from '../interim/gemini.js';
import {
  champsManquants,
  construirePatches,
  promptComplement,
  schemaComplement,
  verifierComplement,
  type Famille,
  type Table,
} from './complement.js';

const log = logger.child({ module: 'annuel-complement' });

export interface ComplementResult {
  societes: number;
  champsEcrits: number;
  rejetes: number;
  echecs: number;
}

const TABLES: Table[] = ['income_statements', 'balance_sheets', 'cash_flow_statements'];

export async function runComplement({ mock = false, codes = [] as string[] } = {}): Promise<ComplementResult> {
  const sb = getSupabase();
  const cle = mock ? null : await resolveApiKeyForScraper('gemini');
  if (!mock && !cle) throw new Error('Clé Gemini absente (GEMINI_API_KEY ou api_keys provider gemini).');

  let q = sb.from('brvm_instruments').select('code, famille_comptable').eq('type', 'action');
  if (codes.length) q = q.in('code', codes);
  const { data: instr, error } = await q;
  if (error) throw new Error(`brvm_instruments : ${error.message}`);

  let societes = 0, champsEcrits = 0, rejetes = 0, echecs = 0;
  for (const { code, famille_comptable } of (instr ?? []) as { code: string; famille_comptable: Famille | null }[]) {
    const famille = (famille_comptable ?? 'general') as Famille;
    if (famille === 'assurance') continue; // aucune assurance cotée à ce jour

    // Dernier exercice annuel en base.
    const { data: dern } = await sb
      .from('income_statements')
      .select('periode, revenu_total, resultat_net')
      .eq('code', code)
      .eq('type_periode', 'annuel')
      .order('periode', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!dern) continue;
    const exercice = Number((dern as { periode: string }).periode);

    const { data: fund } = await sb.from('fundamentals').select('source').eq('code', code).eq('year', exercice).maybeSingle();
    if ((fund as { source?: string } | null)?.source === 'pdf-verified') continue;

    const existant = {} as Record<Table, Record<string, unknown> | null>;
    for (const t of TABLES) {
      const { data } = await sb.from(t).select('*').eq('code', code).eq('type_periode', 'annuel').eq('periode', String(exercice)).maybeSingle();
      existant[t] = (data as Record<string, unknown> | null) ?? null;
    }
    let manquants = champsManquants(famille, existant);
    if (manquants.length === 0) continue;
    societes++;

    // Documents de l'exercice : états financiers d'abord, puis rapport annuel.
    const { data: pubs } = await sb
      .from('publications')
      .select('id, libelle, type_publication, date_publication, source_url')
      .eq('code', code)
      .ilike('libelle', `%xercice ${exercice}%`)
      .not('source_url', 'is', null);
    const docs = ((pubs ?? []) as { id: string; libelle: string; type_publication: string | null; date_publication: string; source_url: string }[])
      .filter((p) => !/liquidit|dividende|convocation|assembl|r[ée]solution/i.test(p.libelle))
      .sort((a, b) => {
        const rang = (p: typeof a) => (p.type_publication === 'etats_financiers' ? 0 : /rapport annuel|activit|gestion/i.test(p.libelle) ? 1 : 2);
        return rang(a) - rang(b) || b.date_publication.localeCompare(a.date_publication);
      })
      .slice(0, 2);

    if (mock) {
      log.info({ code, exercice, manquants: manquants.map((m) => m.champ), docs: docs.map((d) => d.libelle) }, '[mock] à compléter');
      continue;
    }
    if (docs.length === 0) {
      log.warn({ code, exercice }, 'aucun document de l’exercice');
      continue;
    }

    const ancres = {
      revenu_total: (dern as { revenu_total: number | null }).revenu_total,
      resultat_net: (dern as { resultat_net: number | null }).resultat_net,
      total_actifs: (existant.balance_sheets?.total_actifs as number | null) ?? null,
    };

    for (const doc of docs) {
      if (manquants.length === 0) break;
      try {
        const r = await jsonDepuisPdf(doc.source_url, promptComplement(famille, exercice), `Société BRVM : ${code}. Document : ${doc.libelle}.`, cle!);
        const parse = schemaComplement.safeParse(r?.brut);
        if (!r || !parse.success) {
          rejetes++;
          log.warn({ code, doc: doc.libelle }, 'réponse vide ou hors schéma');
          continue;
        }
        const verdict = verifierComplement(parse.data, exercice, ancres);
        if (!verdict.ok) {
          rejetes++;
          log.warn({ code, exercice, doc: doc.libelle, motifs: verdict.motifs }, 'complément REJETÉ');
          continue;
        }
        for (const p of construirePatches(manquants, parse.data)) {
          const avant = existant[p.table];
          const maj: Record<string, unknown> = { ...p.colonnes };
          if (Object.keys(p.ls).length) {
            maj.lignes_specifiques = { ...((avant?.lignes_specifiques as Record<string, unknown> | null) ?? {}), ...p.ls };
          }
          if (avant) {
            const { error: e } = await sb.from(p.table).update(maj).eq('code', code).eq('type_periode', 'annuel').eq('periode', String(exercice));
            if (e) throw new Error(`${p.table} : ${e.message}`);
            Object.assign(avant, maj);
          } else {
            // Aucune ligne pour cet exercice : création (jamais d'écrasement).
            const ligne = { code, periode: String(exercice), type_periode: 'annuel', ...maj };
            const { error: e } = await sb.from(p.table).insert(ligne);
            if (e) throw new Error(`${p.table} (création) : ${e.message}`);
            existant[p.table] = ligne;
          }
          const traces = [
            ...Object.entries(p.colonnes).map(([champ, v]) => ({ champ, v })),
            ...Object.entries(p.ls).map(([champ, v]) => ({ champ: `lignes_specifiques.${champ}`, v })),
          ];
          const { error: e2 } = await sb.from('correction_champ').insert(
            traces.map((t) => ({
              table_cible: p.table,
              code,
              periode: String(exercice),
              champ: t.champ,
              valeur_avant: null,
              valeur_apres: t.v,
              motif: `Complément d'un champ vide, relu dans le PDF (ancrage : ${verdict.ancres} chiffre(s) existant(s) relu(s) à ±2 %).`,
              source_externe: doc.libelle,
              corrige_par: `gemini:${r.modele}`,
            })),
          );
          if (e2) log.error({ code, err: e2.message }, 'trace correction_champ non écrite');
          champsEcrits += traces.length;
        }
        manquants = champsManquants(famille, existant);
        log.info({ code, exercice, doc: doc.libelle, restants: manquants.map((m) => m.champ) }, 'complété');
      } catch (err) {
        echecs++;
        log.error({ code, doc: doc.libelle, err: (err as Error).message.slice(0, 200) }, 'échec');
      }
    }
  }

  log.info({ societes, champsEcrits, rejetes, echecs, mock }, 'complément des annuels');
  return { societes, champsEcrits, rejetes, echecs };
}
