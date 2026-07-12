import { createHash, randomBytes } from 'node:crypto';

/**
 * Clés de l'API publique — CÔTÉ SERVEUR UNIQUEMENT.
 *
 * (Pas de `import 'server-only'` : ce module est couvert par des tests Node
 * purs, qui ne passent pas par le bundler Next et ne sauraient pas le résoudre.
 * La garantie vient d'ailleurs : `node:crypto` fait échouer tout build qui
 * tenterait de le bundler pour le navigateur — c'est exactement ce qui a
 * détecté l'erreur ici.)
 *
 * Règle : la clé n'est JAMAIS stockée en clair. On conserve son sha256 et un
 * préfixe lisible (pour l'identifier dans la console admin). Une fuite de la
 * base ne doit pas donner accès à l'API — et personne, pas même un admin, ne
 * peut « relire » une clé : elle est affichée une seule fois, à l'approbation.
 *
 * Le simple affichage (masquage) vit dans `mask.ts`, sans dépendance crypto :
 * un composant client ne doit jamais embarquer la génération de clés.
 *
 * Fonctions pures — testées dans keys.test.mjs.
 */

/** Longueur du secret aléatoire (32 octets = 256 bits). */
const SECRET_BYTES = 32;

export interface GeneratedKey {
  /** Clé en clair — à transmettre UNE fois au demandeur, jamais persistée. */
  key: string;
  /** sha256(key) — c'est ce qui va en base. */
  hash: string;
  /** Préfixe lisible pour l'affichage admin (n'identifie pas le secret). */
  prefix: string;
}

/** sha256 hexadécimal (déterministe — sert aussi à la vérification). */
export function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** Génère une clé `wb_live_<64 hex>` + son hash + son préfixe. */
export function generateKey(): GeneratedKey {
  const secret = randomBytes(SECRET_BYTES).toString('hex');
  const key = `wb_live_${secret}`;
  return {
    key,
    hash: hashKey(key),
    // 8 premiers caractères du secret : suffisant pour distinguer deux clés
    // dans une liste, insuffisant pour la reconstituer.
    prefix: `wb_live_${secret.slice(0, 8)}`,
  };
}

/** Forme attendue d'une clé (filtre les requêtes manifestement invalides). */
export function isWellFormedKey(key: string | null | undefined): boolean {
  return typeof key === 'string' && /^wb_live_[0-9a-f]{64}$/.test(key);
}

