/**
 * Relance WhatsApp — PUR. Le message est préparé ici, relu par l'exploitant,
 * puis envoyé À LA MAIN depuis son téléphone (wa.me) : jamais par la
 * passerelle (non officielle — un envoi commercial en série fait bannir le numéro).
 */
export const MENTION_STOP = 'Répondez STOP pour ne plus être recontacté.';

export function avecMentionStop(texte: string): string {
  const t = texte.trim();
  return t.includes(MENTION_STOP) ? t : `${t}\n\n${MENTION_STOP}`;
}

export function texteOffre(lien: string): string {
  return `Offert : le dossier PDF d'une valeur de votre choix → ${lien}`;
}

export function lienWaMeVers(e164: string, texte: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}?text=${encodeURIComponent(texte)}`;
}

/** Un message qui n'est QUE « STOP » (ou ARRÊT), ponctuation finale et « / » tolérés. */
export function estStop(texte: string): boolean {
  const t = texte.trim().replace(/^[/!]\s*/, '').replace(/[.!]+$/, '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return t === 'stop' || t === 'arret';
}
