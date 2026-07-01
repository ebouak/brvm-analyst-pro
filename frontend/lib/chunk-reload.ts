/**
 * Résilience ChunkLoadError (chunks périmés après un redéploiement).
 * Un navigateur avec une ancienne page en cache demande un chunk dont le hash
 * a changé → 404 → ChunkLoadError. On recharge alors la page une fois pour
 * récupérer les chunks frais. Anti-boucle par horodatage (auto-réarmé).
 */

const FLAG = 'wb_chunk_reload_ts';
const COOLDOWN_MS = 10_000;

/** Vrai si l'erreur est un échec de chargement de chunk (JS ou CSS). */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; message?: string };
  return (
    e.name === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed|ChunkLoadError|Loading CSS chunk/i.test(e.message ?? '')
  );
}

/**
 * Recharge la page UNE fois si l'erreur est un chunk périmé.
 * @returns true si un rechargement a été déclenché (ne pas afficher d'UI d'erreur).
 * Auto-guérison : un 2e chunk error < 10 s ne recharge pas (évite la boucle) ;
 * passé ce délai, le mécanisme se réarme tout seul.
 */
export function reloadOnceForChunkError(error: unknown): boolean {
  if (typeof window === 'undefined' || !isChunkLoadError(error)) return false;
  try {
    const last = Number(sessionStorage.getItem(FLAG) || '0');
    if (Date.now() - last < COOLDOWN_MS) return false; // rechargement récent → stop boucle
    sessionStorage.setItem(FLAG, String(Date.now()));
  } catch {
    /* sessionStorage indisponible (mode privé strict) → on recharge quand même une fois */
  }
  window.location.reload();
  return true;
}
