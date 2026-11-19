import type { Signal } from './types';

/**
 * Tour de contrôle — appels vocaux (migration 0250). PUR.
 *
 * Deux défauts possibles, jamais silencieux :
 *   - une ligne non terminale (`en_cours`, `en_file`, `peut_etre_parti`)
 *     depuis plus de 24 h : l'appel n'a jamais été relu, ou Bland n'a pas
 *     répondu — personne ne sait s'il a sonné ;
 *   - un appel terminé sans transcription (`erreur = 'transcription absente'`).
 * Pas de passage périodique : la relecture d'un rappel se fait par le bouton
 * « Actualiser » de la console ; ce signal dit quand elle a été oubliée.
 */
export interface LigneAppelVocal {
  id: string;
  motif: 'rappel_contact' | 'alerte_exploitant';
  source_id: string;
  statut: string;
  erreur: string | null;
  cree_le: string;
}

const NON_TERMINAUX = new Set(['en_cours', 'en_file', 'peut_etre_parti']);
const SEUIL_MS = 24 * 3_600_000;

export function evaluerAppelsVocaux(lignes: LigneAppelVocal[], maintenant: Date): Signal[] {
  const bloques = lignes.filter((l) => NON_TERMINAUX.has(l.statut) && maintenant.getTime() - new Date(l.cree_le).getTime() > SEUIL_MS);
  const sansTexte = lignes.filter((l) => l.statut === 'termine' && l.erreur === 'transcription absente');
  const base = { id: 'envois:appels_vocaux', domaine: 'envois' as const, titre: 'Appels vocaux' };

  if (bloques.length > 0) {
    const premier = bloques.find((l) => l.motif === 'rappel_contact');
    return [
      {
        ...base,
        niveau: 'alerte',
        detail: `${bloques.length} appel${bloques.length > 1 ? 's' : ''} sans issue connue depuis plus de 24 h (en cours, en file ou peut-être parti) : on ignore s'il a sonné.`,
        actions: premier ? [{ libelle: 'Ouvrir le message', href: `/admin/contact/${premier.source_id}` }] : [],
      },
    ];
  }
  if (sansTexte.length > 0) {
    return [
      {
        ...base,
        niveau: 'attention',
        detail: `${sansTexte.length} appel${sansTexte.length > 1 ? 's' : ''} terminé${sansTexte.length > 1 ? 's' : ''} sans transcription reçue de Bland : une demande « stop » n'a pas pu être vérifiée.`,
      },
    ];
  }
  if (lignes.length === 0) return [{ ...base, niveau: 'na', detail: 'Aucun appel vocal sur 30 jours.' }];
  return [{ ...base, niveau: 'ok', detail: `${lignes.length} appel${lignes.length > 1 ? 's' : ''} sur 30 jours, tous avec une issue connue.` }];
}
