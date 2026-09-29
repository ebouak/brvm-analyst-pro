/**
 * Format d'un prix, utilisable côté serveur ET client. Module neutre : une
 * fonction exportée d'un fichier 'use client' devient une référence client,
 * et l'appeler depuis un composant serveur casse la page (HTTP 500 vu sur la
 * landing, corrigé de la même façon par lib/landing/formats.ts).
 */
const nf = new Intl.NumberFormat('fr-FR');

export function prixAffiche(montant: number, devise: string): string {
  return devise === 'XOF' ? `${nf.format(montant)} FCFA` : `${nf.format(montant)} ${devise}`;
}
