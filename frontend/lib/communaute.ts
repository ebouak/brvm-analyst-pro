/**
 * Communauté sur les réseaux — PUR, testé. Le dernier relevé de chaque réseau,
 * dans un ordre fixe, avec l'adresse publique du profil quand elle existe.
 *
 * Un réseau sans relevé n'apparaît pas : afficher « 0 abonné » ou un tiret
 * ferait croire à un compte vide. Un relevé de plus de RELEVE_MAX_JOURS est
 * écarté : un chiffre périmé présenté comme actuel serait faux.
 */
export type ReseauCommunaute = 'tiktok' | 'facebook' | 'linkedin' | 'telegram' | 'whatsapp';

export interface ReleveCommunaute {
  reseau: ReseauCommunaute;
  releve_le: string; // AAAA-MM-JJ
  abonnes: number;
  source: 'auto' | 'manuel';
}

export const RESEAUX_COMMUNAUTE: { reseau: ReseauCommunaute; libelle: string; unite: string; url: string | null }[] = [
  { reseau: 'tiktok', libelle: 'TikTok', unite: 'abonnés', url: 'https://www.tiktok.com/@westbourse7' },
  { reseau: 'facebook', libelle: 'Facebook', unite: 'abonnés', url: 'https://www.facebook.com/profile.php?id=61593099424531' },
  { reseau: 'linkedin', libelle: 'LinkedIn', unite: 'abonnés', url: 'https://www.linkedin.com/company/westbourse' },
  { reseau: 'telegram', libelle: 'Telegram', unite: 'membres', url: 'https://t.me/westbourse7' },
  { reseau: 'whatsapp', libelle: 'Chaîne WhatsApp', unite: 'abonnés', url: 'https://whatsapp.com/channel/0029VbDkKjK5K3zL18MshI0d' },
];

export const RELEVE_MAX_JOURS = 45;

export function estReseauCommunaute(v: string): v is ReseauCommunaute {
  return RESEAUX_COMMUNAUTE.some((r) => r.reseau === v);
}

export function derniersReleves(lignes: ReleveCommunaute[], aujourdhui: Date): (ReleveCommunaute & { libelle: string; unite: string; url: string | null })[] {
  const limite = new Date(aujourdhui.getTime() - RELEVE_MAX_JOURS * 86_400_000).toISOString().slice(0, 10);
  const dernier = new Map<ReseauCommunaute, ReleveCommunaute>();
  for (const l of lignes) {
    if (!estReseauCommunaute(l.reseau) || l.releve_le < limite || !Number.isFinite(l.abonnes) || l.abonnes < 0) continue;
    const d = dernier.get(l.reseau);
    if (!d || l.releve_le > d.releve_le) dernier.set(l.reseau, l);
  }
  return RESEAUX_COMMUNAUTE.filter((r) => dernier.has(r.reseau)).map((r) => ({ ...dernier.get(r.reseau)!, libelle: r.libelle, unite: r.unite, url: r.url }));
}
