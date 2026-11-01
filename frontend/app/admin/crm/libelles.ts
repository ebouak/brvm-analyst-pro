// Libellés d'état d'une action du journal — une seule table. Jamais « reçu » : le journal ne sait pas si le message est lu.
export const LIB_STATUT: Record<string, string> = {
  envoye: 'envoyé', prepare: 'préparé, non envoyé', echec: 'échec', envoi: 'en cours', simulation: 'simulation (non envoyé)',
};
export const libStatut = (s: string): string => LIB_STATUT[s] ?? s;

import type { Dossier } from '@/lib/crm/types';
import { libelleSuivi, type LibelleSuivi } from '@/lib/crm/suivi';
import { compareIso } from '@/lib/crm/score';

/** Une réponse (déclarée ou message de contact) postérieure à cette relance existe-t-elle ? */
export function reponseApres(d: Pick<Dossier, 'actions' | 'messages'>, dateRelance: string): boolean {
  return d.messages.some((m) => compareIso(m.date, dateRelance) > 0)
    || d.actions.some((a) => a.type === 'decision' && a.decision === 'reponse' && compareIso(a.date, dateRelance) > 0);
}

/** Libellé de suivi d'une relance + sa teinte : livré = up, échec/spam = down, retardée = warn, le reste = discret. */
export function suiviRelance(d: Pick<Dossier, 'actions' | 'messages'>, a: Dossier['actions'][number]): { lib: LibelleSuivi; cls: string } {
  const lib = libelleSuivi(a, reponseApres(d, a.date));
  const cls = lib === 'livré' ? 'text-up'
    : lib === 'échec' || lib === 'signalé comme spam' || lib === "échec d'envoi" ? 'text-down'
    : lib === 'remise retardée' ? 'text-warn' : 'text-muted';
  return { lib, cls };
}

/** « séquence paiement inachevé, étape 2 » pour une clé `paiement_inacheve:2` ; null si la relance n'est pas automatique. */
export function libSequence(cle: string | null | undefined): string | null {
  const m = /^(?:sim_)?([a-z_]+):(\d+)$/.exec(cle ?? '');
  return m ? `séquence ${m[1].replace(/_/g, ' ')} étape ${m[2]}` : null;
}

/** Heure UTC (= Africa/Abidjan) « JJ/MM à HH:MM ». */
export function fmtJourHeure(iso: string, annee = false): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}${annee ? `/${d.getUTCFullYear()}` : ''} à ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
