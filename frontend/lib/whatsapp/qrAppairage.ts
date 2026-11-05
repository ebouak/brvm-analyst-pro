import { create } from 'qrcode';

/**
 * QR code d'appairage WhatsApp.
 *
 * Le QR encode le lien `wa.me` qui ouvre WhatsApp avec le code PRÉ-REMPLI :
 * scanné depuis un téléphone, il ne reste qu'à appuyer sur « Envoyer ». La
 * preuve de possession est intacte — c'est toujours le WhatsApp de la personne
 * qui envoie le code, et le webhook qui crée la liaison (lib/whatsapp/appairage.ts).
 *
 * Le texte pré-rempli est le code SEUL : le webhook compare le message entier
 * au code (`normalizePairingCode`), une phrase autour le ferait échouer.
 */

/** Lien wa.me vers le numéro WESTBOURSE avec le code pré-rempli, ou null sans numéro configuré. */
export function lienAppairage(numero: string, code: string): string | null {
  const chiffres = numero.replace(/\D/g, '');
  const c = code.trim();
  if (chiffres.length < 8 || !c) return null;
  return `https://wa.me/${chiffres}?text=${encodeURIComponent(c)}`;
}

export interface CheminQr {
  /** Côté de la matrice, en modules (marge comprise). */
  taille: number;
  /** Tracé SVG des modules sombres, un carré 1×1 par module. */
  d: string;
}

/**
 * Matrice du QR rendue en un seul tracé SVG — rendu React direct, sans
 * injection de HTML. Niveau de correction M : lisible sur un écran un peu
 * reflétant, sans grossir la matrice.
 */
export function cheminQr(texte: string, marge = 2): CheminQr {
  const { modules } = create(texte, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  let d = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (modules.data[y * n + x]) d += `M${x + marge} ${y + marge}h1v1h-1z`;
    }
  }
  return { taille: n + marge * 2, d };
}
