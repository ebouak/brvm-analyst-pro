/** Redirection des nouveaux comptes vers l'écran WhatsApp — PUR. */
const JOUR_MS = 86_400_000;

export function nextSur(next: string | null | undefined, defaut = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return defaut;
  return next;
}

/** Compte créé il y a moins de 24 h : seuls les nouveaux inscrits voient l'écran. */
export function estNouveauCompte(createdAt: string | null | undefined, maintenant: Date): boolean {
  const c = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(c) && maintenant.getTime() - c < JOUR_MS;
}

export function versEcranWhatsapp(destination: string): string {
  return `/bienvenue/whatsapp?next=${encodeURIComponent(destination)}`;
}
