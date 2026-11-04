import { resultatsJev } from './decision';
import { rechercheMotsCles } from './motsCles';
import { empreinte } from './normaliser';
import { validerReponseJev } from './validerJev';
import type { CleCache, Instantane, RaisonRepli, ReponseRecherche, ResultatJevValide } from './types';

export interface EntreeCache {
  etat: 'en_cours' | 'prete';
  resultat: ResultatJevValide | null;
}

/** Cache + verrou, atomiques côté stockage (fonctions SQL en production). */
export interface StockageRecherche {
  lire(cle: CleCache): Promise<EntreeCache | null>;
  /** true = verrou obtenu (aucune entrée, ou entrée abandonnée / expirée). */
  verrouiller(cle: CleCache): Promise<boolean>;
  ecrire(cle: CleCache, resultat: ResultatJevValide): Promise<void>;
  liberer(cle: CleCache): Promise<void>;
}

export interface Utilisateur {
  id: string;
  email: string | null;
}

export interface DepsRecherche {
  instantane(): Promise<Instantane | null>;
  utilisateur(): Promise<Utilisateur | null>;
  eligible(u: Utilisateur): Promise<boolean>;
  /** true = autorisé (et consommé). */
  quota(u: Utilisateur): Promise<boolean>;
  stockage: StockageRecherche;
  reserverBudget(): Promise<'ok' | 'refuse' | 'erreur'>;
  jev(q: string, instantane: Instantane, signal: AbortSignal): Promise<unknown>;
  attendre(ms: number): Promise<void>;
  /** Journal d'exploitation : JAMAIS le texte de la requête ni un message d'erreur. */
  journal(evenement: string, details?: Record<string, string | number>): void;
  delaiJevMs?: number;
  attenteMs?: number;
  attenteEssais?: number;
}

export const DELAI_JEV_MS = 8_000;
export const ATTENTE_MS = 500;
export const ATTENTE_ESSAIS = 16;

const DELAI = Symbol('delai');

/**
 * Ordre : instantané → session → éligibilité (AVANT tout cache) → cache →
 * verrou → quota → budget → Jev → validation → écriture du cache. Toute
 * défaillance retombe sur la recherche par mots-clés, avec sa raison.
 */
export async function rechercher(q: string, deps: DepsRecherche): Promise<ReponseRecherche> {
  let lu: Instantane | null = null;
  try {
    lu = await deps.instantane();
  } catch {
    lu = null;
  }
  if (!lu) {
    deps.journal('donnees_indisponibles');
    return { mode: 'mots-cles', raison: 'donnees_indisponibles', cache: false, statut: 'aucune', resultats: [], snapshotId: null, actualiseLe: null };
  }
  const instantane = lu;
  const meta = { snapshotId: instantane.snapshotId, actualiseLe: instantane.actualiseLe };
  const repli = (raison: RaisonRepli): ReponseRecherche => ({ mode: 'mots-cles', raison, cache: false, ...rechercheMotsCles(q, instantane.fiches), ...meta });
  const parJev = (r: ResultatJevValide, cache: boolean): ReponseRecherche => ({ mode: 'jev', raison: null, cache, ...resultatsJev(r, instantane.fiches), ...meta });

  const utilisateur = await deps.utilisateur().catch(() => null);
  if (!utilisateur) return repli('non_connecte');
  const eligible = await deps.eligible(utilisateur).catch(() => false);
  if (!eligible) return repli('offre_non_eligible');

  const cle: CleCache = { empreinte: empreinte(q), snapshotId: instantane.snapshotId };
  const resultatPret = async (): Promise<ResultatJevValide | null> => {
    try {
      const e = await deps.stockage.lire(cle);
      return e?.etat === 'prete' && e.resultat ? e.resultat : null;
    } catch {
      return null;
    }
  };

  const enCache = await resultatPret();
  if (enCache) return parJev(enCache, true);

  let verrou: boolean;
  try {
    verrou = await deps.stockage.verrouiller(cle);
  } catch {
    deps.journal('stockage_indisponible');
    return repli('compteur_indisponible');
  }
  if (!verrou) {
    // La même recherche est calculée ailleurs : on attend son résultat.
    const essais = deps.attenteEssais ?? ATTENTE_ESSAIS;
    for (let i = 0; i < essais; i += 1) {
      await deps.attendre(deps.attenteMs ?? ATTENTE_MS);
      const r = await resultatPret();
      if (r) return parJev(r, true);
    }
    deps.journal('attente_verrou_expiree');
    return repli('jev_indisponible');
  }
  const liberer = async () => {
    try {
      await deps.stockage.liberer(cle);
    } catch {
      deps.journal('verrou_non_libere');
    }
  };

  // Le quota est un anti-abus : ouvert si son infrastructure faillit. Le budget, lui, ferme.
  const quotaOk = await deps.quota(utilisateur).catch(() => true);
  if (!quotaOk) {
    await liberer();
    return repli('quota_atteint');
  }

  const budget = await deps.reserverBudget().catch(() => 'erreur' as const);
  if (budget !== 'ok') {
    await liberer();
    const raison = budget === 'refuse' ? 'plafond_atteint' : 'compteur_indisponible';
    deps.journal(raison);
    return repli(raison);
  }

  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), deps.delaiJevMs ?? DELAI_JEV_MS);
  let brut: unknown;
  try {
    const appel = deps.jev(q, instantane, ctrl.signal);
    appel.catch(() => undefined); // un rejet tardif (après le délai) ne doit pas rester orphelin
    const delai = new Promise<typeof DELAI>((resoudre) => ctrl.signal.addEventListener('abort', () => resoudre(DELAI), { once: true }));
    brut = await Promise.race([appel, delai]);
    if (brut === DELAI) throw new Error('delai');
  } catch {
    await liberer();
    deps.journal('jev_indisponible');
    return repli('jev_indisponible');
  } finally {
    clearTimeout(minuterie);
  }

  const valide = validerReponseJev(brut, instantane.fiches.map((f) => f.code));
  if (!valide) {
    await liberer();
    deps.journal('jev_reponse_invalide');
    return repli('jev_indisponible');
  }
  try {
    await deps.stockage.ecrire(cle, valide);
  } catch {
    deps.journal('cache_ecriture_echec');
  }
  return parJev(valide, false);
}
