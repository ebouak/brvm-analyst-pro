/**
 * Plafond d'appareils Premium — choix des sessions à fermer. PUR.
 *
 * Règle annoncée à l'utilisateur : un compte Premium reste connecté sur
 * `plafond` appareils à la fois ; une connexion de plus ferme le moins
 * récemment utilisé.
 *
 * « Appareil » = CRÉNEAU (système + préfixe réseau), pas session. Un même
 * téléphone ouvre facilement plusieurs sessions : Chrome, puis le navigateur
 * intégré de Gmail ou de WhatsApp quand on suit un lien. Compter les sessions
 * ferait déconnecter un abonné seul, sur un seul téléphone. Toutes les sessions
 * d'un créneau comptent donc pour un, et un créneau se ferme en entier.
 *
 * Jamais fermée : la session `garder` (celle qui vient de se connecter). Jamais
 * concernés : comptes non Premium, comptes d'administration et comptes de test.
 */
import { appareilDe } from './appareil';

export interface SessionVivante {
  sessionId: string;
  userId: string;
  userAgent: string | null;
  reseau: string | null;
  /** ISO. */
  creeLe: string;
  /** ISO : dernière activité connue (rafraîchissement du jeton). */
  activite: string;
  estPremium: boolean;
  exempte: boolean;
}

export interface Fermeture {
  session: SessionVivante;
  creneau: string;
  /** Utilisée dans les 14 derniers jours : seule une session récente vaut un e-mail. */
  recente: boolean;
}

export const RECENTE_JOURS = 14;

/** Au-delà, on soupçonne un défaut de sélection plutôt qu'un partage : on ne ferme rien. */
export const GARDE_FOU = { maxFermeturesParPassage: 40, maxRecentesParPassage: 10 } as const;

export function creneauDe(s: Pick<SessionVivante, 'userAgent' | 'reseau'>): string {
  return `${appareilDe(s.userAgent).systeme}|${s.reseau ?? 'inconnu'}`;
}

function ms(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export function choisirFermetures(
  sessions: SessionVivante[],
  opts: { plafond: number; garder?: string | null; maintenant: Date },
): Fermeture[] {
  const plafond = Math.max(1, Math.floor(opts.plafond));
  const seuilRecente = opts.maintenant.getTime() - RECENTE_JOURS * 86_400_000;

  const parCompte = new Map<string, SessionVivante[]>();
  for (const s of sessions) {
    if (!s.estPremium || s.exempte) continue;
    const l = parCompte.get(s.userId);
    if (l) l.push(s);
    else parCompte.set(s.userId, [s]);
  }

  const fermetures: Fermeture[] = [];
  for (const liste of parCompte.values()) {
    const creneaux = new Map<string, { sessions: SessionVivante[]; activite: number; garde: boolean }>();
    for (const s of liste) {
      const c = creneauDe(s);
      const e = creneaux.get(c) ?? { sessions: [], activite: 0, garde: false };
      e.sessions.push(s);
      e.activite = Math.max(e.activite, ms(s.activite), ms(s.creeLe));
      if (opts.garder && s.sessionId === opts.garder) e.garde = true;
      creneaux.set(c, e);
    }
    if (creneaux.size <= plafond) continue;

    // Le créneau gardé d'abord, puis du plus récemment utilisé au plus ancien.
    // Égalité départagée par le nom du créneau : le résultat ne dépend pas de
    // l'ordre de lecture en base.
    const tries = [...creneaux.entries()].sort(([ca, a], [cb, b]) => {
      if (a.garde !== b.garde) return a.garde ? -1 : 1;
      if (b.activite !== a.activite) return b.activite - a.activite;
      return ca < cb ? -1 : ca > cb ? 1 : 0;
    });
    for (const [creneau, e] of tries.slice(plafond)) {
      for (const s of e.sessions) {
        fermetures.push({ session: s, creneau, recente: Math.max(ms(s.activite), ms(s.creeLe)) >= seuilRecente });
      }
    }
  }
  return fermetures;
}

export function verifierGardeFou(fermetures: Fermeture[]): { ok: true } | { ok: false; raison: string } {
  const recentes = fermetures.filter((f) => f.recente).length;
  if (fermetures.length > GARDE_FOU.maxFermeturesParPassage) {
    return { ok: false, raison: `${fermetures.length} sessions à fermer en un passage (plafond de sûreté ${GARDE_FOU.maxFermeturesParPassage})` };
  }
  if (recentes > GARDE_FOU.maxRecentesParPassage) {
    return { ok: false, raison: `${recentes} sessions récentes à fermer en un passage (plafond de sûreté ${GARDE_FOU.maxRecentesParPassage})` };
  }
  return { ok: true };
}
