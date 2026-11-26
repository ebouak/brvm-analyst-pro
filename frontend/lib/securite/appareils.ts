/**
 * « Mes appareils » — regroupement des sessions d'un compte. PUR.
 *
 * Même définition de l'appareil que le plafond (créneau = système + préfixe
 * réseau, cf. plafond.ts) : l'abonné voit le décompte que la règle applique,
 * pas un autre. Chrome et le navigateur intégré de Gmail sur le même téléphone
 * forment une seule ligne.
 */
import { appareilDe } from './appareil';
import { creneauDe, type SessionVivante } from './plafond';

export interface AppareilConnecte {
  cle: string;
  /** Libellés distincts des sessions de l'appareil (« Chrome · Android »…). */
  libelles: string[];
  /** ISO : activité la plus récente. */
  activite: string;
  sessionIds: string[];
  /** Contient la session de la page en cours : jamais proposé à la déconnexion ici. */
  courant: boolean;
}

export function regrouperAppareils(sessions: SessionVivante[], sessionCourante: string | null): AppareilConnecte[] {
  const groupes = new Map<string, AppareilConnecte>();
  for (const s of sessions) {
    const cle = creneauDe(s);
    const g = groupes.get(cle) ?? { cle, libelles: [], activite: s.activite, sessionIds: [], courant: false };
    const libelle = appareilDe(s.userAgent).libelle;
    if (!g.libelles.includes(libelle)) g.libelles.push(libelle);
    if (Date.parse(s.activite) > Date.parse(g.activite)) g.activite = s.activite;
    g.sessionIds.push(s.sessionId);
    if (sessionCourante && s.sessionId === sessionCourante) g.courant = true;
    groupes.set(cle, g);
  }
  return [...groupes.values()].sort((a, b) => {
    if (a.courant !== b.courant) return a.courant ? -1 : 1;
    return Date.parse(b.activite) - Date.parse(a.activite);
  });
}
