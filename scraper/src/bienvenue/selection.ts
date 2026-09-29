/**
 * Emails de bienvenue — QUI reçoit QUOI. Fonction pure, testée.
 *
 * Deux motifs : l'inscription (tout nouveau compte) et l'abonnement payant
 * (premium, platinium — jamais le plan gratuit). Chacun ne part qu'une fois
 * par compte : la table emails_bienvenue (clé user_id + motif) le garantit,
 * et cette fonction saute tout couple déjà 'envoye'.
 *
 * JAMAIS RÉTROACTIF. Seuls les comptes créés, et les abonnements démarrés,
 * APRÈS la mise en service sont visés. Le 24/09/2026, le site a écrit à ses
 * lecteurs « vous ne recevrez plus rien sans l'avoir demandé » : écrire d'un
 * coup à tous les comptes existants romprait cette phrase.
 *
 * Un échec est retenté au passage suivant, au plus MAX_TENTATIVES fois — au
 * delà, l'adresse est probablement invalide et insister n'aide personne.
 */

export type Motif = 'inscription' | 'abonnement';

/** Date de mise en service de l'envoi (2026-09-29). Rien avant n'est visé. */
export const MISE_EN_SERVICE = '2026-09-29T00:00:00Z';
export const MAX_TENTATIVES = 3;

export interface Compte {
  id: string;
  email: string | null;
  created_at: string;
}
export interface Abonnement {
  user_id: string;
  status: string;
  started_at: string | null;
  /** Plan payant (prix mensuel > 0). Le plan gratuit n'est pas un abonnement. */
  payant: boolean;
}
export interface Journal {
  user_id: string;
  motif: Motif;
  statut: 'envoye' | 'echec';
  tentatives: number;
}
export interface Envoi {
  user_id: string;
  email: string;
  motif: Motif;
  /** Tentatives déjà faites (0 si jamais tenté). */
  tentatives: number;
}

const emailValide = (e: string | null | undefined): e is string =>
  typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export function aEnvoyer(entree: {
  comptes: Compte[];
  abonnements: Abonnement[];
  journal: Journal[];
  depuis?: string;
}): Envoi[] {
  const depuis = Date.parse(entree.depuis ?? MISE_EN_SERVICE);
  const parCompte = new Map(entree.comptes.map((c) => [c.id, c]));
  const deja = new Map(entree.journal.map((j) => [`${j.user_id}|${j.motif}`, j]));

  const envois: Envoi[] = [];
  const ajouter = (user_id: string, motif: Motif) => {
    const compte = parCompte.get(user_id);
    if (!compte || !emailValide(compte.email)) return;
    const j = deja.get(`${user_id}|${motif}`);
    if (j?.statut === 'envoye') return;
    const tentatives = j?.tentatives ?? 0;
    if (tentatives >= MAX_TENTATIVES) return;
    envois.push({ user_id, email: compte.email.trim(), motif, tentatives });
  };

  for (const c of entree.comptes) {
    if (Date.parse(c.created_at) >= depuis) ajouter(c.id, 'inscription');
  }
  const vus = new Set<string>();
  for (const a of entree.abonnements) {
    if (a.status !== 'active' || !a.payant || !a.started_at) continue;
    if (Date.parse(a.started_at) < depuis || vus.has(a.user_id)) continue;
    vus.add(a.user_id);
    ajouter(a.user_id, 'abonnement');
  }
  return envois;
}
