/**
 * Import des exercices annuels publiés mais absents de la base
 * (CLI `annuel:nouveau [CODES]`). Décisions dans nouvelExercice.ts (pur).
 *
 * Détection : une publication « états financiers … Exercice Y » existe alors
 * que le dernier exercice en base est < Y. L'exercice Y n'est écrit que si la
 * colonne Y−1 du même PDF retrouve la base à ±2 % (≥ 2 ancres).
 *
 * Écrit income / balance / cash_flow + fundamentals + provenance_exercice.
 * Ne remplace JAMAIS une ligne existante (création seule).
 * `--mock` : liste ce qui serait importé, n'appelle ni n'écrit.
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { resolveApiKeyForScraper } from '../hebdo/apiKey.js';
import { jsonDepuisPdf } from '../interim/gemini.js';
import { lignesExercice, promptNouvelExercice, schemaNouvelExercice, verifierNouvelExercice } from './nouvelExercice.js';

const log = logger.child({ module: 'annuel-nouveau' });

export interface NouveauResult {
  candidats: number;
  importes: number;
  rejetes: number;
  echecs: number;
}

function exerciceDuLibelle(libelle: string): number | null {
  const m = /exercice\s+(20\d{2})/i.exec(libelle);
  return m ? Number(m[1]) : null;
}

export async function runNouvelExercice({ mock = false, codes = [] as string[] } = {}): Promise<NouveauResult> {
  const sb = getSupabase();
  const cle = mock ? null : await resolveApiKeyForScraper('gemini');
  if (!mock && !cle) throw new Error('Clé Gemini absente (GEMINI_API_KEY ou api_keys provider gemini).');

  let q = sb.from('publications').select('id, code, libelle, date_publication, source_url').eq('type_publication', 'etats_financiers').not('source_url', 'is', null);
  if (codes.length) q = q.in('code', codes);
  const { data: pubs, error } = await q;
  if (error) throw new Error(`publications : ${error.message}`);

  // Dernière publication d'états financiers par société, avec son exercice.
  const parCode = new Map<string, { id: string; libelle: string; source_url: string; exercice: number; date: string }>();
  for (const p of (pubs ?? []) as { id: string; code: string; libelle: string; date_publication: string; source_url: string }[]) {
    const ex = exerciceDuLibelle(p.libelle);
    if (!ex) continue;
    const prev = parCode.get(p.code);
    if (!prev || ex > prev.exercice || (ex === prev.exercice && p.date_publication > prev.date)) {
      parCode.set(p.code, { id: p.id, libelle: p.libelle, source_url: p.source_url, exercice: ex, date: p.date_publication });
    }
  }

  let candidats = 0, importes = 0, rejetes = 0, echecs = 0;
  for (const [code, pub] of parCode) {
    const { data: dern } = await sb.from('income_statements').select('periode').eq('code', code).eq('type_periode', 'annuel').order('periode', { ascending: false }).limit(1).maybeSingle();
    const enBase = dern ? Number((dern as { periode: string }).periode) : 0;
    if (pub.exercice <= enBase) continue; // déjà en base
    candidats++;
    if (mock) {
      log.info({ code, enBase, aImporter: pub.exercice, doc: pub.libelle }, '[mock] exercice à importer');
      continue;
    }

    try {
      const prev = String(pub.exercice - 1);
      const [{ data: incP }, { data: balP }] = await Promise.all([
        sb.from('income_statements').select('revenu_total, resultat_net').eq('code', code).eq('type_periode', 'annuel').eq('periode', prev).maybeSingle(),
        sb.from('balance_sheets').select('total_actifs').eq('code', code).eq('type_periode', 'annuel').eq('periode', prev).maybeSingle(),
      ]);
      const ancres = {
        revenu_total: (incP as { revenu_total: number | null } | null)?.revenu_total ?? null,
        resultat_net: (incP as { resultat_net: number | null } | null)?.resultat_net ?? null,
        total_actifs: (balP as { total_actifs: number | null } | null)?.total_actifs ?? null,
      };

      const r = await jsonDepuisPdf(pub.source_url, promptNouvelExercice(pub.exercice), `Société BRVM : ${code}. Document : ${pub.libelle}.`, cle!);
      const parse = schemaNouvelExercice.safeParse(r?.brut);
      if (!r || !parse.success) {
        rejetes++;
        log.warn({ code, doc: pub.libelle }, 'réponse vide ou hors schéma');
        continue;
      }
      const verdict = verifierNouvelExercice(parse.data, pub.exercice, ancres);
      if (!verdict.ok) {
        rejetes++;
        log.warn({ code, exercice: pub.exercice, motifs: verdict.motifs }, 'exercice REJETÉ');
        continue;
      }

      const col = parse.data.colonnes.find((c) => c.annee === pub.exercice)!;
      const l = lignesExercice(code, col, pub.libelle);
      const tables: [string, Record<string, unknown>][] = [
        ['income_statements', l.income],
        ['balance_sheets', l.balance],
        ['cash_flow_statements', l.cashflow],
      ];
      const ecrites: string[] = [];
      for (const [t, ligne] of tables) {
        const { data: ex } = await sb.from(t).select('id').eq('code', code).eq('type_periode', 'annuel').eq('periode', String(pub.exercice)).maybeSingle();
        if (ex) continue; // jamais d'écrasement
        const { error: e } = await sb.from(t).insert(ligne);
        if (e) throw new Error(`${t} : ${e.message}`);
        ecrites.push(t);
      }
      const { data: fEx } = await sb.from('fundamentals').select('id').eq('code', code).eq('year', pub.exercice).maybeSingle();
      if (!fEx) {
        const { error: e } = await sb.from('fundamentals').insert(l.fundamentals);
        if (e) throw new Error(`fundamentals : ${e.message}`);
      }
      if (ecrites.length) {
        await sb.from('provenance_exercice').upsert(
          ecrites.map((table_cible) => ({
            code, periode: String(pub.exercice), table_cible, publication_id: pub.id,
            extrait_le: new Date().toISOString(), extracteur: `gemini:${r.modele}`, confiance: 'extrait',
          })),
          { onConflict: 'code,periode,table_cible' },
        );
      }
      importes++;
      log.info({ code, exercice: pub.exercice, ancres: verdict.ancres, tables: ecrites, modele: r.modele }, 'exercice importé');
    } catch (err) {
      echecs++;
      log.error({ code, err: (err as Error).message.slice(0, 200) }, 'échec');
    }
  }

  log.info({ candidats, importes, rejetes, echecs, mock }, 'nouveaux exercices');
  return { candidats, importes, rejetes, echecs };
}
