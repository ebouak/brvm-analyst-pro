import { contientDonneePersonnelle } from '@/lib/recherche/normaliser';
import { decider, type Decision } from './decider';
import type { Intention } from './intentions';
import { construireRequeteAiguillage, type SocieteIdentite } from './requete';
import { validerAiguillage } from './valider';

export interface EntreeJournal {
  intention: Intention;
  decision: Decision['type'];
  probabilite: number;
}

export interface DepsAiguillage {
  actif(): Promise<boolean>;
  societes(): Promise<SocieteIdentite[]>;
  /** true = autorisé (et consommé). */
  quota(chatId: string): Promise<boolean>;
  reserverBudget(): Promise<'ok' | 'refuse' | 'erreur'>;
  jev(corps: ReturnType<typeof construireRequeteAiguillage>, signal: AbortSignal): Promise<unknown>;
  /** Journal anonyme (table) : jamais le texte ni le numéro. */
  journaliser(e: EntreeJournal): Promise<void>;
  /** Journal d'exploitation : codes d'événement seulement. */
  journal(evenement: string): void;
  delaiMs?: number;
}

export const DELAI_MS = 6_000;
export const LONGUEUR_MIN = 3;
export const LONGUEUR_MAX = 500;
const ACTUEL: Decision = { type: 'aiguillage_actuel' };
const DELAI = Symbol('delai');

/** Toute défaillance, tout doute ⇒ chemin actuel : on ne perd jamais un message. */
export async function aiguillerParJev(texte: string, chatId: string, deps: DepsAiguillage): Promise<Decision> {
  if (!(await deps.actif().catch(() => false))) return ACTUEL;
  const t = texte.trim();
  if (t.length < LONGUEUR_MIN || t.length > LONGUEUR_MAX) return ACTUEL;
  if (contientDonneePersonnelle(t)) {
    deps.journal('donnee_personnelle');
    return ACTUEL;
  }
  const societes = await deps.societes().catch(() => [] as SocieteIdentite[]);
  if (societes.length === 0) {
    deps.journal('societes_indisponibles');
    return ACTUEL;
  }
  if (!(await deps.quota(chatId).catch(() => true))) {
    deps.journal('quota_atteint');
    return ACTUEL;
  }
  const budget = await deps.reserverBudget().catch(() => 'erreur' as const);
  if (budget !== 'ok') {
    deps.journal(budget === 'refuse' ? 'plafond_atteint' : 'compteur_indisponible');
    return ACTUEL;
  }

  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), deps.delaiMs ?? DELAI_MS);
  let brut: unknown;
  try {
    const appel = deps.jev(construireRequeteAiguillage(t, societes), ctrl.signal);
    appel.catch(() => undefined);
    const delai = new Promise<typeof DELAI>((r) => ctrl.signal.addEventListener('abort', () => r(DELAI), { once: true }));
    brut = await Promise.race([appel, delai]);
    if (brut === DELAI) throw new Error('delai');
  } catch {
    deps.journal('jev_indisponible');
    return ACTUEL;
  } finally {
    clearTimeout(minuterie);
  }

  const valide = validerAiguillage(brut, societes.map((s) => s.code));
  if (!valide) {
    deps.journal('jev_reponse_invalide');
    return ACTUEL;
  }
  const decision = decider(valide);
  await deps
    .journaliser({ intention: valide.intention, decision: decision.type, probabilite: valide.probabilites[valide.intention] ?? 0 })
    .catch(() => deps.journal('journal_non_ecrit'));
  return decision;
}
