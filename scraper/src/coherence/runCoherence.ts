/**
 * Balayage hebdomadaire de cohérence : fait tourner les quatre règles de
 * `./pure/regles.ts` sur les 48 actions cotées et range les anomalies dans
 * `coherence_anomalies`, pour alimenter la console d'administration
 * `/admin/coherence` (écrite ailleurs — ce module ne fait qu'écrire la table).
 *
 * La fiche société (autre tâche, non traitée ici) appelle les mêmes règles
 * au rendu, sur une seule valeur à la fois. Ce fichier est l'AUTRE usage :
 * tout l'univers, en tâche de fond, une fois par semaine.
 *
 * Logique testable séparée des appels Supabase — même convention que
 * `scoring/`, `alerts/` et `liquidity/` dans ce dépôt : les fonctions PURES
 * (assemblage des entrées, pagination, résumé, garde du succès silencieux)
 * sont exportées et testées dans `tests/coherence.test.ts` ; `runCoherence`
 * lui-même (impur) ne l'est pas, comme `runLiquidity`/`runHebdo`.
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import {
  collecterAnomalies,
  type Anomalie,
  type EntreeAnomalies,
  type Publication,
  type RefSociete,
  type RegleCode,
} from './pure/regles.js';

/* ───────────────────────── Lignes brutes (telles que lues en base) ───────────────────────── */

export interface InstrumentRow {
  code: string;
  designation: string | null;
  notation_json: Record<string, unknown> | null;
}

/** Une ligne de `publications`, avec son code — `Publication` (pure/regles.ts) ne l'a pas. */
export interface PublicationRow extends Publication {
  code: string;
}

export interface SignalRow {
  code: string;
  date_marche: string;
  explication: string | null;
  score_variation: number | null;
  score_volume: number | null;
  score_rsi: number | null;
  score_macd: number | null;
  bonus_tendance: number | null;
}

export interface FundamentalRow {
  code: string;
  year: number | null;
}

/* ───────────────────────── 1. Assemblage d'une entrée (PUR) ───────────────────────── */

/** `notation_json.date_notation`, ou `null` — jamais devinée si absente ou d'un type inattendu. */
function dateNotationDe(notationJson: Record<string, unknown> | null): string | null {
  const v = notationJson?.date_notation;
  return typeof v === 'string' ? v : null;
}

/**
 * Assemble une `EntreeAnomalies` à partir des lignes brutes de quatre tables
 * (brvm_instruments, publications déjà filtrées pour ce code, dernier signal
 * du code, dernier exercice du code). PURE : aucun accès réseau — `runCoherence`
 * a déjà lu, filtré et groupé les lignes par code avant d'appeler cette
 * fonction pour chaque instrument. Séparée pour être testable sans Supabase.
 */
export function construireEntree(
  instrument: InstrumentRow,
  publications: Publication[],
  signal: SignalRow | null,
  dernierExercice: number | null,
  autresSocietes: RefSociete[],
): EntreeAnomalies {
  return {
    code: instrument.code,
    designation: instrument.designation ?? '',
    dateNotation: dateNotationDe(instrument.notation_json),
    explication: signal?.explication ?? null,
    sousScores: {
      variation: signal?.score_variation ?? null,
      volume: signal?.score_volume ?? null,
      rsi: signal?.score_rsi ?? null,
      macd: signal?.score_macd ?? null,
      tendance: signal?.bonus_tendance ?? null,
    },
    dernierExercice,
    publications,
    autresSocietes,
  };
}

/* ───────────────────────── 2. Pagination (PUR + pilote impur) ───────────────────────── */

const PAGE = 1000;

/**
 * Concatène des pages déjà récupérées, en s'arrêtant à la première page
 * INCOMPLÈTE — même invariant que la boucle `.range()` réelle : une page plus
 * courte que `taillePage` signale la fin ; tout ce qui suivrait est ignoré,
 * exactement comme la boucle réelle ne l'aurait jamais demandé.
 *
 * PUR : aucun accès réseau. C'est la logique de concaténation et d'arrêt qui
 * est éprouvée ici, indépendamment de Supabase — voir `fetchPaginated`
 * ci-dessous pour le pilote impur qui fait les appels réels page par page.
 */
export function concatenerPages<T>(pages: T[][], taillePage: number): T[] {
  const out: T[] = [];
  for (const page of pages) {
    out.push(...page);
    if (page.length < taillePage) break;
  }
  return out;
}

/**
 * Pagine un fetch Supabase par blocs de `taillePage` jusqu'à la première page
 * incomplète. PostgREST plafonne CHAQUE réponse à 1000 lignes, en SILENCE :
 * `publications` compte plusieurs milliers de lignes, et une troncature
 * invisible produirait des anomalies fausses et plausibles — exactement le
 * défaut que ce module existe pour détecter (voir `src/scrapers/range52.ts`
 * et `src/hebdo/runHebdo.ts`, qui paginent pour la même raison).
 */
async function fetchPaginated<T>(
  fetchPage: (offset: number, taillePage: number) => Promise<T[]>,
  taillePage = PAGE,
): Promise<T[]> {
  const pages: T[][] = [];
  for (let offset = 0; ; offset += taillePage) {
    const page = await fetchPage(offset, taillePage);
    pages.push(page);
    if (page.length < taillePage) break;
  }
  return concatenerPages(pages, taillePage);
}

/* ───────────────────────── 3. Résumé journalisé (PUR) ───────────────────────── */

export interface ResumeCoherence {
  nb_anomalies: number;
  par_regle: Record<RegleCode, number>;
  par_gravite: Record<Anomalie['gravite'], number>;
}

const TOUTES_REGLES: RegleCode[] = [
  'notation_perimee', 'etiquette_contredite', 'publication_mal_attribuee', 'comptes_perimes',
];
const TOUTES_GRAVITES: Anomalie['gravite'][] = ['trompeuse', 'a_surveiller'];

/**
 * Comptages par règle et par gravité — TOUTES les clés sont présentes, y
 * compris à zéro : un objet creux forcerait la console admin à deviner si
 * une règle absente vaut zéro ou n'a simplement pas été journalisée.
 */
export function resumerAnomalies(lignes: { regle: RegleCode; gravite: Anomalie['gravite'] }[]): ResumeCoherence {
  const par_regle = Object.fromEntries(TOUTES_REGLES.map((r) => [r, 0])) as Record<RegleCode, number>;
  const par_gravite = Object.fromEntries(TOUTES_GRAVITES.map((g) => [g, 0])) as Record<Anomalie['gravite'], number>;
  for (const l of lignes) {
    par_regle[l.regle]++;
    par_gravite[l.gravite]++;
  }
  return { nb_anomalies: lignes.length, par_regle, par_gravite };
}

/* ───────────────────────── 4. Garde du succès silencieux (PUR) ───────────────────────── */

/**
 * Refuse le silence : lire ZÉRO instrument n'est jamais un succès, que la
 * table soit vraiment vide ou (bien plus probable) inaccessible. PURE — ne
 * lit rien elle-même, elle ne fait que trancher sur un compte déjà obtenu.
 *
 * Raison d'être : ce dépôt a déjà vécu sept semaines de panne d'emails
 * invisible parce qu'un workflow affichait « success » sans que rien ne
 * parte (voir CLAUDE.md §9). Un run qui n'a rien lu ne doit jamais ressembler
 * à un run qui a tout vérifié et n'a rien trouvé à signaler.
 */
export function verifierLectureInstruments(nbInstruments: number): void {
  if (nbInstruments === 0) {
    throw new Error(
      "coherence : aucun instrument actif lu dans brvm_instruments (type='action', actif=true) " +
        '— refus de considérer ce run comme un succès silencieux.',
    );
  }
}

/* ───────────────────────── 5. Runner (impur) ───────────────────────── */

export interface CoherenceRunResult {
  status: 'success' | 'mock';
  date_detection: string;
  nb_instruments: number;
  nb_anomalies: number;
  par_regle: Record<RegleCode, number>;
  par_gravite: Record<Anomalie['gravite'], number>;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Ligne prête pour l'upsert : l'anomalie + la clé naturelle qui la rattache. */
interface LigneAnomalie {
  code: string;
  regle: RegleCode;
  gravite: Anomalie['gravite'];
  message: string;
  preuve: Anomalie['preuve'];
}

function collecterToutesLesAnomalies(
  instruments: InstrumentRow[],
  publicationsParCode: Map<string, Publication[]>,
  signauxParCode: Map<string, SignalRow>,
  exerciceParCode: Map<string, number>,
  autresSocietes: RefSociete[],
): LigneAnomalie[] {
  const lignes: LigneAnomalie[] = [];
  for (const instrument of instruments) {
    const entree = construireEntree(
      instrument,
      publicationsParCode.get(instrument.code) ?? [],
      signauxParCode.get(instrument.code) ?? null,
      exerciceParCode.get(instrument.code) ?? null,
      autresSocietes,
    );
    for (const a of collecterAnomalies(entree)) {
      lignes.push({ code: instrument.code, regle: a.regle, gravite: a.gravite, message: a.message, preuve: a.preuve });
    }
  }
  return lignes;
}

/** Fixture en mémoire — aucun accès réseau. Démontre le pipeline complet. */
function runMock(): CoherenceRunResult {
  const today = todayIso();
  const instruments: InstrumentRow[] = [
    { code: 'AAAA', designation: 'SOCIETE AAAA CI', notation_json: { date_notation: '2025-01-01' } },
    { code: 'BBBB', designation: 'SOCIETE BBBB CI', notation_json: null },
  ];
  const autresSocietes: RefSociete[] = instruments.map((i) => ({ code: i.code, designation: i.designation ?? '' }));
  const publicationsParCode = new Map<string, Publication[]>([
    ['AAAA', [{ date_publication: today, libelle: 'Notation Financière - AAAA CI' }]],
    ['BBBB', []],
  ]);

  const lignes = collecterToutesLesAnomalies(instruments, publicationsParCode, new Map(), new Map(), autresSocietes);
  const resume = resumerAnomalies(lignes);
  logger.info(
    {
      nb_instruments: instruments.length,
      nb_anomalies: resume.nb_anomalies,
      par_regle: resume.par_regle,
      par_gravite: resume.par_gravite,
    },
    '[mock] coherence',
  );
  return {
    status: 'mock',
    date_detection: today,
    nb_instruments: instruments.length,
    nb_anomalies: resume.nb_anomalies,
    par_regle: resume.par_regle,
    par_gravite: resume.par_gravite,
  };
}

/**
 * Balaie les 48 actions actives, exécute les 4 règles sur chacune et upsert
 * les anomalies trouvées dans `coherence_anomalies`.
 *
 * ÉCHOUE BRUYAMMENT PAR CONCEPTION : aucun branchement `try/catch` global.
 * Zéro instrument lu, une lecture Supabase en erreur, ou une écriture
 * refusée (table absente — migration 0141 non appliquée) lèvent chacun une
 * erreur explicite qui remonte telle quelle jusqu'à `index.ts`, qui sort en
 * code 1. C'est la même convention que `runLiquidity`/`runHebdo` : ni l'un ni
 * l'autre n'avale ses erreurs. Zéro anomalie TROUVÉE, en revanche, n'est pas
 * un échec — c'est un résultat sain, et rien n'est alors écrit.
 */
export async function runCoherence(opts: { mock?: boolean } = {}): Promise<CoherenceRunResult> {
  if (opts.mock) return runMock();

  const cfg = getConfig();
  const sb = getSupabase();
  const today = todayIso();

  // 1) Univers : actions actives. 48 lignes aujourd'hui — largement sous le
  //    plafond PostgREST — mais paginée quand même : aucune lecture
  //    multi-lignes de ce module ne doit dépendre d'un plafond implicite.
  const instruments = await fetchPaginated<InstrumentRow>(async (offset, limit) => {
    const { data, error } = await sb
      .from('brvm_instruments')
      .select('code, designation, notation_json')
      .eq('type', 'action')
      .eq('actif', true)
      .order('code', { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`lecture brvm_instruments : ${error.message}`);
    return (data ?? []) as InstrumentRow[];
  });
  // Refuse le succès silencieux — voir la doc de la fonction.
  verifierLectureInstruments(instruments.length);

  const toutesLesSocietes: RefSociete[] = instruments.map((i) => ({ code: i.code, designation: i.designation ?? '' }));

  // 2) Publications de TOUTES les sociétés — plusieurs milliers de lignes.
  //    PAGINATION OBLIGATOIRE : une troncature silencieuse à 1000 lignes
  //    produirait des anomalies fausses et plausibles (ex. « notation
  //    périmée » parce que la publication qui la contredit n'a simplement
  //    pas été lue) — exactement le défaut que ce module existe pour détecter.
  const publications = await fetchPaginated<PublicationRow>(async (offset, limit) => {
    const { data, error } = await sb
      .from('publications')
      .select('code, date_publication, libelle')
      .order('code', { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`lecture publications : ${error.message}`);
    return (data ?? []) as PublicationRow[];
  });
  const publicationsParCode = new Map<string, Publication[]>();
  for (const p of publications) {
    const ligne: Publication = { date_publication: p.date_publication, libelle: p.libelle };
    const liste = publicationsParCode.get(p.code);
    if (liste) liste.push(ligne);
    else publicationsParCode.set(p.code, [ligne]);
  }

  // 3) Dernier signal PAR CODE. Le scoring note tout l'univers le même jour
  //    (une seule date_marche par run — voir docs/SCORING.md) : la dernière
  //    date de signals_daily couvre donc tous les codes scorés. Un code
  //    absent de cette date reste à `null` : sous-scores absents, règle 2
  //    muette pour lui plutôt que devinée.
  const { data: dateRow, error: eDate } = await sb
    .from('signals_daily')
    .select('date_marche')
    .order('date_marche', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eDate) throw new Error(`lecture signals_daily (dernière date) : ${eDate.message}`);
  const dateSignal = (dateRow?.date_marche as string | undefined) ?? null;

  const signauxParCode = new Map<string, SignalRow>();
  if (dateSignal) {
    const signaux = await fetchPaginated<SignalRow>(async (offset, limit) => {
      const { data, error } = await sb
        .from('signals_daily')
        .select('code, date_marche, explication, score_variation, score_volume, score_rsi, score_macd, bonus_tendance')
        .eq('date_marche', dateSignal)
        .range(offset, offset + limit - 1);
      if (error) throw new Error(`lecture signals_daily : ${error.message}`);
      return (data ?? []) as SignalRow[];
    });
    for (const s of signaux) signauxParCode.set(s.code, s);
  }

  // 4) Dernier exercice comptable par code (max(year) en mémoire).
  const fondamentaux = await fetchPaginated<FundamentalRow>(async (offset, limit) => {
    const { data, error } = await sb
      .from('fundamentals')
      .select('code, year')
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`lecture fundamentals : ${error.message}`);
    return (data ?? []) as FundamentalRow[];
  });
  const exerciceParCode = new Map<string, number>();
  for (const f of fondamentaux) {
    if (f.year == null) continue;
    const actuel = exerciceParCode.get(f.code);
    if (actuel == null || f.year > actuel) exerciceParCode.set(f.code, f.year);
  }

  // 5) Construction des entrées + exécution des 4 règles, pour chaque valeur.
  const lignes = collecterToutesLesAnomalies(
    instruments, publicationsParCode, signauxParCode, exerciceParCode, toutesLesSocietes,
  );
  const resume = resumerAnomalies(lignes);
  logger.info(
    {
      nb_instruments: instruments.length,
      nb_anomalies: resume.nb_anomalies,
      par_regle: resume.par_regle,
      par_gravite: resume.par_gravite,
    },
    'coherence : balayage terminé',
  );

  if (cfg.DRY_RUN) {
    logger.warn('DRY_RUN : anomalies calculées mais non écrites.');
    return {
      status: 'success', date_detection: today, nb_instruments: instruments.length,
      nb_anomalies: resume.nb_anomalies, par_regle: resume.par_regle, par_gravite: resume.par_gravite,
    };
  }

  // 6) Écriture — idempotente sur (code, regle, detectee_le, message).
  //    Rien à écrire N'EST PAS un échec (aucune anomalie détectée est un
  //    résultat sain, le plus fréquent en pratique). Échouer À ÉCRIRE alors
  //    qu'il y avait quelque chose à écrire EST un échec, et ne doit jamais
  //    ressembler à un succès : sept semaines de panne email invisible ont
  //    déjà coûté cher à ce dépôt pour exactement cette raison (CLAUDE.md §9).
  if (lignes.length > 0) {
    const { error } = await sb.from('coherence_anomalies').upsert(
      lignes.map((l) => ({
        code: l.code,
        regle: l.regle,
        gravite: l.gravite,
        message: l.message,
        preuve: l.preuve,
        detectee_le: today,
      })),
      { onConflict: 'code,regle,detectee_le,message' },
    );
    if (error) {
      throw new Error(
        `Écriture coherence_anomalies impossible (${error.message}) — la migration ` +
          '0141_coherence_et_flag_lecture_seance.sql est-elle appliquée ?',
        { cause: error },
      );
    }
  }

  return {
    status: 'success',
    date_detection: today,
    nb_instruments: instruments.length,
    nb_anomalies: resume.nb_anomalies,
    par_regle: resume.par_regle,
    par_gravite: resume.par_gravite,
  };
}
