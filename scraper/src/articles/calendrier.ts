/**
 * Jours ouvrés BRVM : lundi-vendredi. Les jours fériés ne sont pas connus ici ;
 * un rappel peut donc tomber un jour férié — il reste exact sur la date annoncée.
 */
const MS_JOUR = 86_400_000;
const jour = (iso: string) => new Date(`${iso}T12:00:00Z`);
const versIso = (d: Date) => d.toISOString().slice(0, 10);

export function estOuvre(iso: string): boolean {
  const j = jour(iso).getUTCDay();
  return j !== 0 && j !== 6;
}

export function ajouterJoursOuvres(iso: string, n: number): string {
  let d = jour(iso);
  for (let k = 0; k < n; ) {
    d = new Date(d.getTime() + MS_JOUR);
    if (estOuvre(versIso(d))) k++;
  }
  return versIso(d);
}

/** Séances ouvrées strictement après `de`, jusqu'à `a` inclus (0 si a ≤ de). */
export function joursOuvresEntre(de: string, a: string): number {
  if (a <= de) return 0;
  let n = 0;
  for (let d = jour(de); d < jour(a); ) {
    d = new Date(d.getTime() + MS_JOUR);
    if (estOuvre(versIso(d))) n++;
  }
  return n;
}

export function ecartJours(de: string, a: string): number {
  return Math.round((jour(a).getTime() - jour(de).getTime()) / MS_JOUR);
}
