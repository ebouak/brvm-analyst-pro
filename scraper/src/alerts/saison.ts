/**
 * Alerte « valeur sortie de sa fourchette saisonnière » (saisonnalité v2,
 * lot 4, F12) — PUR, testé. Conception revue par fable-advisor (2026-11-11) :
 * - bande LARGE (10-90 %) et verdict au moins indicatif, sinon l'alerte
 *   sonnerait pour la moitié des valeurs suivies chaque mois ;
 * - état daté : un état d'une autre séance que la dernière est périmé ;
 * - au plus une notification par sens et par mois (une valeur qui oscille
 *   autour de la borne ne renvoie rien).
 */

export const ETATS_HORS = ['au_dessus', 'en_dessous'] as const;

export interface EtatAlerte { etat_large: string; verdict: string; annee: number; mois: number; date_seance: string }
export interface MemoireAlerte { dernier_etat_notifie: string | null; dernier_mois_notifie: string | null }

export const cleMois = (annee: number, mois: number) => `${annee}-${String(mois).padStart(2, '0')}`;

export function saisonADeclencher(a: MemoireAlerte, etat: EtatAlerte | undefined, derniereSeance: string): { declenche: boolean; raison: string } {
  if (!etat) return { declenche: false, raison: 'aucun état' };
  if (etat.date_seance !== derniereSeance) return { declenche: false, raison: 'état périmé' };
  if (!(ETATS_HORS as readonly string[]).includes(etat.etat_large)) return { declenche: false, raison: 'dans sa fourchette' };
  if (etat.verdict === 'hasard') return { declenche: false, raison: 'saison non distinguable du hasard' };
  if (a.dernier_mois_notifie === cleMois(etat.annee, etat.mois) && a.dernier_etat_notifie === etat.etat_large) {
    return { declenche: false, raison: 'déjà notifié ce mois dans ce sens' };
  }
  return { declenche: true, raison: 'sortie de la fourchette large' };
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1).replace('.', ',')} %`;

export interface LigneMessage { code: string; etat_large: string; rdt_en_cours: number; q10: number | null; q90: number | null; n: number; mois: number; rang: number }

/** Un seul message par utilisateur et par passage, toutes valeurs réunies. Descriptif, sans consigne. */
export function messageSaison(lignes: LigneMessage[]): { subject: string; body: string } {
  const subject = lignes.length === 1
    ? `Saisonnalité : ${lignes[0]!.code} hors de sa fourchette habituelle`
    : `Saisonnalité : ${lignes.length} valeurs hors de leur fourchette habituelle`;
  const corps = lignes.map((l) => {
    const sens = l.etat_large === 'au_dessus' ? 'au-dessus' : 'en dessous';
    const borne = l.q10 != null && l.q90 != null ? ` (fourchette large ${pct(l.q10)} à ${pct(l.q90)} sur ${l.n} années, à la ${l.rang}e séance)` : '';
    return `${l.code} : ${pct(l.rdt_en_cours)} depuis le début de ${MOIS[l.mois - 1]}, dividende compris, ${sens} de son habitude${borne}.`;
  });
  const body = [
    ...corps,
    '',
    'Une habitude passée n’est pas une prévision. Information de marché, pas un conseil en investissement.',
  ].join('\n');
  return { subject, body };
}
