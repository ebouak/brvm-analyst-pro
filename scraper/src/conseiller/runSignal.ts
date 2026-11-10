import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { chargerHistorique } from './historique.js';
import { SIGNAL_VERSION, construireGrille, lignesSignaux, signauxSeance, verifierSignaux, type EtatSignal, type LigneSignal } from './signal.js';
import { CONFIRMATION, ecartsCohortes, lireConfirmation, resumer, type EtatValeur, type Lecture, type Resume } from './signalEvaluation.js';

const COLONNES = 'date_marche, code, etat, score, eligible, perf_120, perf_250, rang_120, rang_250, presence_60, effectif, revision, moteur_version';

/**
 * Écart de score toléré entre le calcul et la relecture. PostgREST renvoie un
 * double précision sur 15 chiffres significatifs, JavaScript en garde 17 : un
 * score relu peut différer au 16e chiffre (constaté le 2026-11-10, écart 4,4e-16
 * sur BOAN). Le score vit dans [−1, 1] : 1e-9 ne masque aucun vrai changement.
 */
export const TOLERANCE_SCORE = 1e-9;

/**
 * Codes dont la ligne relue diffère du calcul (état, éligibilité, ou score au-delà
 * de TOLERANCE_SCORE), ou relus sans calcul correspondant. Fonction pure.
 */
export function lignesDivergentes(
  calculees: Pick<LigneSignal, 'code' | 'etat' | 'score' | 'eligible'>[],
  relues: Pick<LigneSignal, 'code' | 'etat' | 'score' | 'eligible'>[],
): string[] {
  const parCode = new Map(calculees.map((l) => [l.code, l]));
  const scoreDiffere = (a: number | null, b: number | null) =>
    a == null || b == null ? a !== b : Math.abs(a - b) > TOLERANCE_SCORE;
  return relues
    .filter((r) => {
      const c = parCode.get(r.code);
      return !c || c.etat !== r.etat || c.eligible !== r.eligible || scoreDiffere(c.score, r.score);
    })
    .map((r) => r.code);
}

/**
 * Signal « tendance longue » de la dernière séance.
 * Sans `ecrire` : calcul et contrôle à blanc. Avec `ecrire` : insertion sur
 * (date_marche, code), la première écriture faisant foi (doublons ignorés), puis
 * relecture et contrôle sur la donnée RELUE, divergence comprise. Une anomalie
 * LÈVE. Seule la dernière séance est écrite : aucune option ne réécrit le passé,
 * c'est ce qui fait de la table un registre d'époque pour le test confirmatoire.
 */
export async function runSignaux(ecrire: boolean): Promise<{ date: string; lignes: number; revision: boolean; etats: Record<EtatSignal, string[]> }> {
  const { donnees: d } = await chargerHistorique();
  const i = d.calendrier.length - 1;
  const date = d.calendrier[i];
  if (!date) throw new Error('aucune séance en base');
  const lignes = lignesSignaux(construireGrille(d), i);
  const etats = { a_eviter: [], favorable: [], neutre: [], pas_de_signal: [] } as Record<EtatSignal, string[]>;
  for (const l of lignes) etats[l.etat].push(l.code);
  const revision = lignes[0]?.revision ?? false;

  const aBlanc = verifierSignaux(lignes, date);
  if (aBlanc.length) throw new Error(`conseiller:signaux : lot invalide avant écriture — ${aBlanc.join(' ; ')}`);
  if (!ecrire) {
    logger.info({ date, lignes: lignes.length, revision }, 'conseiller:signaux : calcul à blanc conforme (rien écrit)');
    return { date, lignes: lignes.length, revision, etats };
  }

  const sb = getSupabase();
  // Registre d'époque : la PREMIÈRE écriture fait foi. Une séance déjà écrite n'est
  // jamais réécrite (relance du workflow, lancement manuel) : doublons ignorés.
  // supabase-js n'accepte pas onConflict/ignoreDuplicates sur insert() ; upsert()
  // avec ignoreDuplicates produit « INSERT … ON CONFLICT (date_marche, code) DO
  // NOTHING » (Prefer: resolution=ignore-duplicates) : aucune ligne existante modifiée.
  const { error } = await sb.from('conseiller_signaux').upsert(lignes, { onConflict: 'date_marche,code', ignoreDuplicates: true });
  if (error) throw new Error(`conseiller:signaux : écriture refusée — ${error.message}`);
  const { data: relues, error: eRelue } = await sb.from('conseiller_signaux').select(COLONNES).eq('date_marche', date);
  if (eRelue) throw new Error(`conseiller:signaux : relecture impossible — ${eRelue.message}`);
  const anomalies = verifierSignaux((relues ?? []) as LigneSignal[], date);
  if ((relues?.length ?? 0) !== lignes.length) anomalies.push(`${relues?.length ?? 0} lignes relues pour ${lignes.length} écrites`);
  if (anomalies.length) throw new Error(`conseiller:signaux : contrôle sur la donnée relue — ${anomalies.join(' ; ')}`);
  // Une séance déjà écrite AUTREMENT (état, score ou éligibilité différents du calcul
  // de ce soir) se résout par un humain : on le dit et on s'arrête, sans réécrire.
  const divergentes = lignesDivergentes(lignes, (relues ?? []) as LigneSignal[]);
  if (divergentes.length) {
    logger.error({ date, codes: divergentes }, 'conseiller:signaux : séance déjà écrite avec un contenu différent, rien réécrit');
    throw new Error(`conseiller:signaux : séance ${date} déjà écrite autrement pour ${divergentes.join(', ')} — à résoudre par un humain`);
  }
  logger.info({ date, lignes: relues?.length, revision }, 'conseiller:signaux : signaux écrits et vérifiés');
  return { date, lignes: relues?.length ?? 0, revision, etats };
}

export interface RapportConfirmation {
  version: string;
  apres: string;
  derniereSeance: string | null;
  derniereCohorteClose: string | null;
  seancesAttendues: number;
  seancesAvecSignal: number;
  lignesEcarteesPourRetard: number;
  /** Lecture pré-enregistrée (« À éviter » contre l'univers éligible). */
  aEviter: Lecture;
  /** Descriptif : mêmes cohortes, formées aux seules séances de révision mensuelle. */
  aEviterRevisions: Resume;
  /** Descriptif : « Favorable » contre l'univers éligible. Aucune hypothèse testée. */
  favorable: Resume;
}

const JOUR_MS = 86_400_000;

/**
 * Test confirmatoire sur les signaux D'ÉPOQUE : les états sont LUS dans
 * conseiller_signaux tels qu'écrits le soir de chaque séance, jamais recalculés.
 * Lecture seule.
 */
export async function runConfirmation(): Promise<RapportConfirmation> {
  const sb = getSupabase();
  const lues: { date_marche: string; code: string; etat: EtatSignal; eligible: boolean; revision: boolean; created_at: string }[] = [];
  for (let a = 0; ; a += 1000) {
    const { data, error } = await sb.from('conseiller_signaux')
      .select('date_marche, code, etat, eligible, revision, created_at')
      .gt('date_marche', CONFIRMATION.apres).eq('moteur_version', SIGNAL_VERSION)
      .order('date_marche', { ascending: true }).order('code', { ascending: true }).range(a, a + 999);
    if (error) throw new Error(`conseiller:confirmation : lecture impossible — ${error.message}`);
    lues.push(...((data ?? []) as typeof lues));
    if ((data ?? []).length < 1000) break;
  }
  const parDate = new Map<string, Map<string, EtatValeur>>();
  const revisions = new Set<string>();
  let enRetard = 0;
  for (const l of lues) {
    const retard = (Date.parse(l.created_at) - Date.parse(`${l.date_marche}T00:00:00Z`)) / JOUR_MS;
    if (retard > CONFIRMATION.retardMaxJours) { enRetard++; continue; }
    let m = parDate.get(l.date_marche);
    if (!m) parDate.set(l.date_marche, (m = new Map()));
    m.set(l.code, { etat: l.etat, eligible: l.eligible });
    if (l.revision) revisions.add(l.date_marche);
  }

  const { donnees: d } = await chargerHistorique();
  const g = construireGrille(d);
  const cal = g.calendrier;
  const indices = cal.map((x, i) => (x > CONFIRMATION.apres ? i : -1)).filter((i) => i >= 0);
  const etatsA = (i: number) => parDate.get(cal[i]!);
  const iClose = cal.length - 2 - CONFIRMATION.horizon;
  const derniereCohorteClose = iClose >= 0 ? cal[iClose]! : null;
  const aEviter = ecartsCohortes(g, etatsA, indices, 'a_eviter');
  return {
    version: SIGNAL_VERSION,
    apres: CONFIRMATION.apres,
    derniereSeance: cal.at(-1) ?? null,
    derniereCohorteClose,
    seancesAttendues: indices.length,
    seancesAvecSignal: indices.filter((i) => parDate.has(cal[i]!)).length,
    lignesEcarteesPourRetard: enRetard,
    aEviter: lireConfirmation(aEviter, derniereCohorteClose),
    aEviterRevisions: resumer(aEviter.filter((e) => revisions.has(e.date))),
    favorable: resumer(ecartsCohortes(g, etatsA, indices, 'favorable')),
  };
}

/**
 * Relecture EXPLORATOIRE de l'historique par la chaîne du dépôt : les signaux sont
 * recalculés à chaque séance de `debut` à CONFIRMATION.apres. Ce n'est PAS une
 * preuve (la règle a été choisie en regardant ces données) ; cela sert à vérifier
 * que la chaîne reproduit les chiffres affichés sur la carte Premium.
 */
export async function runSignalHistorique(debut = '2008-01-01'): Promise<{ debut: string; fin: string; aEviter: Resume; favorable: Resume; etatsDerniereSeance: Record<EtatSignal, string[]> }> {
  const { donnees: d } = await chargerHistorique();
  const g = construireGrille(d);
  const cal = g.calendrier;
  const indices = cal.map((x, i) => (x >= debut && x <= CONFIRMATION.apres ? i : -1)).filter((i) => i >= 0);
  const memo = new Map<number, Map<string, EtatValeur>>();
  const etatsA = (i: number) => {
    let m = memo.get(i);
    if (!m) memo.set(i, (m = new Map([...signauxSeance(g, i)].map(([c, v]) => [c, { etat: v.etat, eligible: v.eligible }]))));
    return m;
  };
  const etats = { a_eviter: [], favorable: [], neutre: [], pas_de_signal: [] } as Record<EtatSignal, string[]>;
  const dernier = indices.at(-1);
  if (dernier != null) for (const [c, v] of etatsA(dernier)) etats[v.etat].push(c);
  return {
    debut,
    fin: dernier != null ? cal[dernier]! : debut,
    aEviter: resumer(ecartsCohortes(g, etatsA, indices, 'a_eviter')),
    favorable: resumer(ecartsCohortes(g, etatsA, indices, 'favorable')),
    etatsDerniereSeance: etats,
  };
}
