import { demandeStop, type Replique } from './stop';

/**
 * Lecture d'un appel Bland (`GET /calls/{id}`) et règles d'éligibilité — PUR.
 */
export type StatutAppel = 'en_cours' | 'peut_etre_parti' | 'en_file' | 'termine' | 'echec' | 'non_decroche';

export const STATUTS_NON_TERMINAUX: readonly StatutAppel[] = ['en_cours', 'peut_etre_parti', 'en_file'];

export const LIBELLE_STATUT: Record<StatutAppel, string> = {
  en_cours: 'En cours',
  peut_etre_parti: 'Peut-être parti (réponse de Bland non reçue)',
  en_file: 'En file chez Bland',
  termine: 'Terminé',
  echec: 'Échec',
  non_decroche: 'Non décroché',
};

/** Ce que renvoie `GET /calls/{id}` — champs lus seulement, tous facultatifs. */
export interface DetailBland {
  status?: string | null;
  completed?: boolean | null;
  call_length?: number | null;
  price?: number | null;
  call_ended_by?: string | null;
  answered_by?: string | null;
  error_message?: string | null;
  transcripts?: Replique[] | null;
  concatenated_transcript?: string | null;
}

export interface LectureAppel {
  statut: StatutAppel;
  dureeMin: number | null;
  prix: number | null;
  finPar: string | null;
  transcription: string | null;
  /** Appel terminé et décroché, mais aucune transcription : à SIGNALER, jamais silencieux. */
  transcriptionAbsente: boolean;
  /** La personne a demandé à ne plus être appelée. */
  stop: boolean;
}

const ECHECS = new Set(['failed', 'error', 'canceled', 'cancelled']);
const NON_DECROCHES = new Set(['no-answer', 'no_answer', 'busy', 'voicemail', 'unanswered']);

function nombre(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export function lireDetailBland(d: DetailBland): LectureAppel {
  const status = String(d.status ?? '').toLowerCase();
  const duree = nombre(d.call_length);
  const transcription = (d.concatenated_transcript ?? '').trim() || null;
  const base = {
    dureeMin: duree,
    prix: nombre(d.price),
    finPar: d.call_ended_by ? String(d.call_ended_by).slice(0, 40) : null,
    transcription,
    stop: demandeStop(d.transcripts ?? null, d.concatenated_transcript ?? null),
  };

  let statut: StatutAppel;
  if (ECHECS.has(status) || (d.error_message && !d.completed)) statut = 'echec';
  else if (NON_DECROCHES.has(status) || NON_DECROCHES.has(String(d.answered_by ?? '').toLowerCase())) statut = 'non_decroche';
  else if (d.completed) statut = (duree ?? 0) > 0 ? 'termine' : 'non_decroche';
  else if (status === 'queued' || status === 'scheduled') statut = 'en_file';
  else statut = 'en_cours';

  return { ...base, statut, transcriptionAbsente: statut === 'termine' && !transcription };
}

/** Anti double-clic : deux rappels du même message à moins de 2 min sont refusés. */
export const ANTI_DOUBLE_MS = 2 * 60 * 1000;

/** Plafond de dépense par défaut (appels par jour, tous motifs). */
export const MAX_JOUR_DEFAUT = 10;

export function plafondJour(brut: string | undefined): number {
  const n = Number(brut);
  return Number.isInteger(n) && n > 0 ? n : MAX_JOUR_DEFAUT;
}

export interface EtatRappel {
  telephone: string | null;
  consentAt: string | null;
  opposition: boolean;
  /** Appel le plus récent pour ce message, s'il y en a un. */
  dernier: { statut: StatutAppel; cree_le: string } | null;
  appelsDuJour: number;
  maxJour: number;
}

export type Eligibilite = { ok: true } | { ok: false; raison: string };

/**
 * Règle UNIQUE, appliquée par le bouton (affichage) ET par l'action serveur
 * (qui revérifie juste avant l'appel).
 */
export function eligibiliteRappel(e: EtatRappel, maintenant: Date): Eligibilite {
  if (!e.telephone || !e.consentAt) return { ok: false, raison: 'Aucun numéro avec consentement au rappel vocal.' };
  if (e.opposition) return { ok: false, raison: 'Ce numéro a demandé à ne plus être appelé.' };
  if (e.dernier) {
    const age = maintenant.getTime() - new Date(e.dernier.cree_le).getTime();
    if (age < ANTI_DOUBLE_MS) return { ok: false, raison: 'Un appel vient d’être lancé : attendez deux minutes.' };
    if (e.dernier.statut === 'en_cours' || e.dernier.statut === 'en_file') {
      return { ok: false, raison: 'Un appel est encore en cours : actualisez son statut.' };
    }
  }
  if (e.appelsDuJour >= e.maxJour) return { ok: false, raison: `Plafond de ${e.maxJour} appels par jour atteint.` };
  return { ok: true };
}
