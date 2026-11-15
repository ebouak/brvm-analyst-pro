/**
 * Extraction des agrégats bancaires — I/O. Lit les publications des banques,
 * envoie chaque PDF à Gemini (src/interim/gemini.ts, jsonDepuisPdf), valide
 * (zod), normalise et contrôle. N'ÉCRIT RIEN : l'appelant décide (cron :
 * insertion ; reprise à blanc : rapport).
 *
 * Échec bruyant : clé Gemini absente → exception ; erreur HTTP, réponse hors
 * schéma → document en « echec », compté, et le run sort en code 1.
 *
 * Base sans la migration 0245 (reprise à blanc avant application) : la
 * colonne sources_specifiques manque ; la référence N−1 est alors lue sans
 * périmètre ni unité connus (non_precise, fcfa) et un avertissement le dit.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { resolveApiKeyForScraper } from '../hebdo/apiKey.js';
import { jsonDepuisPdf } from '../interim/gemini.js';
import { construireAlias, documentEtranger } from '../publications/emetteur.js';
import { promptAgregats, schemaLecture } from './schema.js';
import { periodeDuDocument, type PeriodeDoc } from './periode.js';
import { normaliser, type ObservationNouvelle } from './normaliser.js';
import { controler, type Reference } from './controles.js';
import { AGREGATS } from './indicateurs.js';
import { coupureCron, publicationsDuCron } from './coupure.js';
import type { DocumentRapport } from './rapport.js';

const log = logger.child({ module: 'agregats-extraction' });
const pause = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Avertissement porté par le rapport quand la base n'a pas encore 0245. */
export const AVERTISSEMENT_SANS_0245 =
  'Migration 0245 non appliquée sur la base lue : anciennes observations lues sans période ni état de contrôle, références N−1 sans périmètre ni unité. Le rapport reste une lecture à blanc ; il faudra le régénérer après application.';

/** Erreur PostgREST « colonne inexistante » (base sans 0245). */
export function colonneAbsente(e: { code?: string; message: string } | null): boolean {
  return !!e && (e.code === '42703' || /column .* does not exist/i.test(e.message));
}

export interface ResultatExtraction {
  documents: DocumentRapport[];
  observations: ObservationNouvelle[];
  echecs: number;
  avertissements: string[];
}

interface Pub { id: string; code: string; libelle: string; date_publication: string; source_url: string | null; type_publication: string | null }

const codePeriodeLigne = (p: PeriodeDoc) => (p.code === 'exercice' ? String(p.annee) : `${p.annee}-${p.code}`);

type LigneRef = { lignes_specifiques: Record<string, unknown> | null; sources_specifiques?: Record<string, { perimetre?: string; unite?: string }> | null };

async function reference(code: string, p: PeriodeDoc, avert: Set<string>): Promise<Reference> {
  const sb = getSupabase();
  const periode = codePeriodeLigne(p);
  const periodeNm1 = p.code === 'exercice' ? String(p.annee - 1) : `${p.annee - 1}-${p.code}`;
  const lignesNm1 = async (table: 'income_statements' | 'balance_sheets') => {
    const r = await sb.from(table).select('lignes_specifiques,sources_specifiques').eq('code', code).eq('periode', periodeNm1).limit(1);
    if (!colonneAbsente(r.error)) return r;
    avert.add(AVERTISSEMENT_SANS_0245);
    return sb.from(table).select('lignes_specifiques').eq('code', code).eq('periode', periodeNm1).limit(1);
  };
  const [annuel, inc, bal, incNm1, balNm1] = await Promise.all([
    sb.from('balance_sheets').select('total_actifs').eq('code', code).eq('type_periode', 'annuel').not('total_actifs', 'is', null).order('periode', { ascending: false }).limit(1),
    sb.from('income_statements').select('resultat_net,lignes_specifiques').eq('code', code).eq('periode', periode).limit(1),
    sb.from('balance_sheets').select('total_actifs,total_capitaux_propres').eq('code', code).eq('periode', periode).limit(1),
    lignesNm1('income_statements'),
    lignesNm1('balance_sheets'),
  ]);
  for (const r of [annuel, inc, bal, incNm1, balNm1]) if (r.error) throw new Error(`référence ${code} ${periode} : ${r.error.message}`);
  const num = (v: unknown) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
  // Valeurs N−1 retenues, avec leur périmètre et leur unité (sources_specifiques) ;
  // sans source connue : non_precise et fcfa (les comptes en base sont en FCFA).
  const valeursNm1: Record<string, number> = {};
  for (const row of [incNm1.data?.[0], balNm1.data?.[0]] as (LigneRef | undefined)[]) {
    if (!row?.lignes_specifiques) continue;
    for (const [cle, v] of Object.entries(row.lignes_specifiques)) {
      if (v == null) continue;
      const ind = AGREGATS.find((a) => a.cle === cle && a.nature !== 'ratio')?.indicateur;
      if (!ind) continue;
      const src = row.sources_specifiques?.[cle];
      valeursNm1[`${ind}|${src?.perimetre ?? 'non_precise'}|${src?.unite ?? 'fcfa'}`] = Number(v);
    }
  }
  const incRow = inc.data?.[0] as { resultat_net: unknown; lignes_specifiques: Record<string, unknown> | null } | undefined;
  return {
    totalBilanAnnuel: num(annuel.data?.[0]?.total_actifs),
    resultatNetBase: num(incRow?.resultat_net),
    totalActifsBase: num(bal.data?.[0]?.total_actifs),
    fondsPropresBase: num(bal.data?.[0]?.total_capitaux_propres),
    // Conservé comme recoupement (avenant D3), jamais réécrit.
    coefficientBase: num(incRow?.lignes_specifiques?.coefficient_exploitation),
    valeursNm1,
  };
}

async function publicationsDe(banques: string[], depuis: string | null): Promise<Pub[]> {
  const sb = getSupabase();
  const out: Pub[] = [];
  for (let de = 0; ; de += 1000) {
    let q = sb.from('publications').select('id,code,libelle,date_publication,source_url,type_publication').in('code', banques);
    if (depuis) q = q.gte('date_publication', depuis);
    const { data, error } = await q.order('date_publication').order('id').range(de, de + 999);
    if (error) throw new Error(`publications : ${error.message}`);
    const lot = (data ?? []) as Pub[];
    out.push(...lot);
    if (lot.length < 1000) return out;
  }
}

/**
 * Cron (reprise = false) : SEULES les publications datées de la coupure ou
 * après (coupure.ts, AGREGATS_COUPURE) — l'historique attend l'accord de
 * l'exploitant sur le rapport à blanc. Reprise : tout l'historique, ou depuis
 * `depuis` (AAAA-MM-JJ).
 */
export async function extraireAgregats(opts: { codes?: string[]; reprise: boolean; fixtures?: string | null; depuis?: string | null }): Promise<ResultatExtraction> {
  const sb = getSupabase();
  const cle = await resolveApiKeyForScraper('gemini');
  if (!cle) throw new Error('clé Gemini absente (GEMINI_API_KEY ou api_keys) : extraction impossible');

  const { data: instr, error: eI } = await sb.from('brvm_instruments').select('code,designation,famille_comptable').eq('type', 'action');
  if (eI) throw new Error(`brvm_instruments : ${eI.message}`);
  const tous = (instr ?? []) as { code: string; designation: string | null; famille_comptable: string | null }[];
  let banques = tous.filter((i) => i.famille_comptable === 'banque').map((i) => i.code);
  if (opts.codes?.length) banques = banques.filter((c) => opts.codes!.includes(c));
  if (banques.length === 0) return { documents: [], observations: [], echecs: 0, avertissements: [] };

  const coupure = opts.reprise ? null : coupureCron(process.env.AGREGATS_COUPURE);
  const lues = await publicationsDe(banques, opts.reprise ? opts.depuis ?? null : coupure);
  // Double verrou : même si la requête changeait, le cron ne traite rien d'antérieur à la coupure.
  const pubs = coupure ? publicationsDuCron(lues, coupure) : lues;

  const alias = construireAlias(tous);
  const codesConnus = new Set(tous.map((i) => i.code));
  const candidates = pubs
    .map((p) => ({ p, periode: periodeDuDocument(p.libelle, p.type_publication) }))
    .filter((x): x is { p: Pub; periode: PeriodeDoc } => x.periode != null && !!x.p.source_url);

  // Déjà lus par ce pipeline : sautés, sauf en reprise (qui relit tout, à blanc).
  const deja = new Set<string>();
  if (!opts.reprise && candidates.length) {
    const urls = [...new Set(candidates.map((c) => c.p.source_url!))];
    for (let i = 0; i < urls.length; i += 100) {
      const { data, error } = await sb.from('indicateur_source').select('document_url').eq('methode', 'gemini-agregats').in('document_url', urls.slice(i, i + 100));
      if (error) throw new Error(`indicateur_source (déjà lus) : ${error.message}`);
      for (const r of data ?? []) deja.add(r.document_url as string);
    }
  }

  const avert = new Set<string>();
  const documents: DocumentRapport[] = [];
  const observations: ObservationNouvelle[] = [];
  let echecs = 0;
  for (const { p, periode } of candidates) {
    const etiquette = { code: p.code, libelle: p.libelle, url: p.source_url!, periode: codePeriodeLigne(periode) };
    if (deja.has(p.source_url!)) continue;
    const autre = documentEtranger(p.code, p.libelle, p.source_url, alias, codesConnus);
    if (autre) {
      documents.push({ ...etiquette, etat: 'ecarte', erreur: `document de ${autre}` });
      continue;
    }
    try {
      const { systeme, consigne } = promptAgregats(p.code, p.libelle);
      const r = await jsonDepuisPdf(p.source_url!, systeme, consigne, cle);
      if (!r) {
        documents.push({ ...etiquette, etat: 'illisible', erreur: 'PDF trop lourd ou réponse vide' });
        continue;
      }
      if (opts.fixtures) {
        mkdirSync(opts.fixtures, { recursive: true });
        writeFileSync(`${opts.fixtures}/${p.code}-${etiquette.periode}.json`, JSON.stringify({ libelle: p.libelle, periode, reponse: r.brut }, null, 2));
      }
      const lecture = schemaLecture.safeParse(r.brut);
      if (!lecture.success) throw new Error(`réponse hors schéma : ${lecture.error.issues[0]?.message ?? '?'}`);
      const obs = normaliser(lecture.data, {
        code: p.code, url: p.source_url!, libelle: p.libelle, date: p.date_publication, publication_id: p.id, periode, modele: `gemini:${r.modele}`,
      });
      observations.push(...controler(obs, await reference(p.code, periode, avert)));
      documents.push({ ...etiquette, etat: 'lu', erreur: null });
      log.info({ code: p.code, periode: etiquette.periode, publiees: obs.filter((o) => o.statut === 'publie').length }, 'document lu');
    } catch (e) {
      echecs++;
      documents.push({ ...etiquette, etat: 'echec', erreur: (e as Error).message.slice(0, 200) });
      log.error({ code: p.code, libelle: p.libelle, err: (e as Error).message.slice(0, 200) }, 'extraction en échec');
    }
    await pause(2_000);
  }
  return { documents, observations, echecs, avertissements: [...avert] };
}
