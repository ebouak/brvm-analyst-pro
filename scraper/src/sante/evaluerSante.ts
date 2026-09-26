/**
 * Évaluation pure de la santé des trois fournisseurs LLM (DeepSeek, Mistral, xAI).
 *
 * CONTEXTE. Le 2026-09-26, un rapport de production affichait « tous les
 * fournisseurs ont échoué ». DeepSeek était à court de crédit, ET les deux
 * fournisseurs de repli étaient appelés avec des noms de modèles retirés
 * depuis longtemps — la panne était invisible tant que DeepSeek répondait, un
 * repli qui échoue ne se voit que le jour où le premier tombe aussi.
 *
 * Ce module classe le résultat d'un sondage réel de chaque fournisseur (voir
 * `runSanteLlm.ts` pour l'appel HTTP) et produit le verdict + le texte
 * d'alerte. Aucun I/O ici, tout est testable en isolation.
 */

export type Fournisseur = 'deepseek' | 'mistral' | 'xai';
export type EtatFournisseur = 'ok' | 'limite' | 'panne';

export interface SondageFournisseur {
  fournisseur: Fournisseur;
  modele: string;
  /** null = aucune clé configurée, ou erreur réseau avant réponse HTTP. */
  statutHttp: number | null;
  /** Message court renvoyé par le fournisseur, déjà tronqué. JAMAIS une clé. */
  detail?: string;
  /** true si aucune clé n'a pu être résolue — le sondage n'a alors pas été tenté. */
  cleAbsente: boolean;
}

export interface EtatDetaille {
  fournisseur: Fournisseur;
  modele: string;
  etat: EtatFournisseur;
  raison: string;
}

export type NiveauVerdict = 'sain' | 'partiel' | 'total';

export interface Verdict {
  etats: EtatDetaille[];
  /**
   * 'sain'    = aucune panne (des 429 isolés n'en sont pas un).
   * 'partiel' = au moins une panne, mais au moins un fournisseur reste utilisable.
   * 'total'   = plus AUCUN fournisseur utilisable (ni ok ni limite) — le
   *             produit tourne à vide, c'est le seul cas qui doit faire
   *             échouer bruyamment le job cron.
   */
  niveau: NiveauVerdict;
  /** Sous-ensemble en panne, pour composer une alerte ciblée. */
  enPanne: EtatDetaille[];
  /** Nombre de fournisseurs encore utilisables (ok + limite). */
  utilisables: number;
}

/**
 * Neutralise tout fragment ressemblant à un secret avant de l'exposer dans un
 * message ou un log. Filet de sécurité en plus de la consigne de l'appelant
 * (« detail » ne doit déjà contenir aucune clé) : une régression côté sonde ne
 * doit pas se retrouver telle quelle dans une alerte Telegram.
 */
function assainirDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  const masque = detail.replace(/[A-Za-z0-9_-]{20,}/g, '[masqué]');
  return masque.slice(0, 200);
}

/**
 * Classe un sondage individuel.
 *
 * Un 429 est une LIMITE DE DÉBIT, pas une panne : le palier gratuit Mistral y
 * répond même à deux secondes d'intervalle, et le modèle appelé reste bon. Le
 * traiter comme une panne fabriquerait une alerte quotidienne permanente,
 * donc ignorée — exactement le défaut que ce contrôle doit éviter.
 */
function classer(s: SondageFournisseur): EtatDetaille {
  const detail = assainirDetail(s.detail);

  if (s.cleAbsente) {
    return { fournisseur: s.fournisseur, modele: s.modele, etat: 'panne', raison: 'aucune clé configurée' };
  }
  if (s.statutHttp === null) {
    return {
      fournisseur: s.fournisseur,
      modele: s.modele,
      etat: 'panne',
      raison: detail ? `erreur réseau — ${detail}` : 'erreur réseau',
    };
  }
  if (s.statutHttp >= 200 && s.statutHttp < 300) {
    return { fournisseur: s.fournisseur, modele: s.modele, etat: 'ok', raison: `HTTP ${s.statutHttp}` };
  }
  if (s.statutHttp === 429) {
    return {
      fournisseur: s.fournisseur,
      modele: s.modele,
      etat: 'limite',
      raison: 'limite de débit (429) — pas une panne',
    };
  }
  return {
    fournisseur: s.fournisseur,
    modele: s.modele,
    etat: 'panne',
    raison: detail ? `HTTP ${s.statutHttp} — ${detail}` : `HTTP ${s.statutHttp}`,
  };
}

/** Évalue la santé globale à partir des sondages des trois fournisseurs. */
export function evaluerSante(sondages: SondageFournisseur[]): Verdict {
  const etats = sondages.map(classer);
  const enPanne = etats.filter((e) => e.etat === 'panne');
  const utilisables = etats.filter((e) => e.etat === 'ok' || e.etat === 'limite').length;
  const niveau: NiveauVerdict = utilisables === 0 ? 'total' : enPanne.length > 0 ? 'partiel' : 'sain';
  return { etats, niveau, enPanne, utilisables };
}

const LIBELLE_ETAT: Record<EtatFournisseur, string> = {
  ok: 'OK',
  limite: 'limité (429, pas une panne)',
  panne: 'EN PANNE',
};

/**
 * Compose le texte d'alerte listant chaque fournisseur, son état et sa
 * raison. Pure : aucun I/O, et ne peut pas fuiter de clé (voir
 * `assainirDetail`). L'appelant décide QUAND l'envoyer (jamais pour un
 * niveau 'sain' — un simple 429 ne doit rien déclencher).
 */
export function construireMessageAlerte(verdict: Verdict): string {
  const lignes = verdict.etats.map(
    (e) => `- ${e.fournisseur} (${e.modele}) : ${LIBELLE_ETAT[e.etat]} — ${e.raison}`,
  );
  const entete =
    verdict.niveau === 'total'
      ? "ALERTE — plus aucun fournisseur LLM utilisable. Le produit tourne à vide."
      : 'Alerte — un fournisseur LLM est en panne (au moins un repli reste disponible).';
  return [entete, '', ...lignes].join('\n');
}
