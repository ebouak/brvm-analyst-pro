import { CANAUX } from '@/lib/canaux';

/**
 * Liens de suivi par source (« d'où viennent les abonnés de la Chaîne ? ») — PUR.
 *
 * Une URL whatsapp.com ou t.me ne transporte pas notre paramètre : on passe donc
 * par nos routes `/chaine` et `/telegram`, qui comptent puis redirigent (302).
 * Le seul paramètre est `src`, une étiquette de CAMPAGNE (`affiche`,
 * `delegue-<ecole>-<classe>`…), jamais une personne. Aucune IP, aucun
 * identifiant, aucun cookie : le compteur est agrégé par (source, jour, événement).
 */

export const SITE = 'https://www.westbourse.com';

/** Étiquette retenue quand `src` est absent ou invalide. */
export const SRC_INCONNU = 'inconnu';

const MOTIF_SRC = /^[a-z0-9-]{1,40}$/;

export type Cible = 'chaine' | 'telegram';
export type Evenement = 'visite_chaine' | 'visite_telegram' | 'inscription';

/**
 * Source normalisée : espaces de bord retirés et minuscules (un délégué qui tape
 * « Delegue-… » ne doit pas créer une seconde ligne), puis validation stricte
 * `^[a-z0-9-]{1,40}$`. Tout le reste devient `inconnu` — jamais tronqué ni nettoyé
 * caractère par caractère, pour ne pas fabriquer une source qui n'a pas été écrite.
 */
export function normaliserSrc(v: unknown): string {
  if (typeof v !== 'string') return SRC_INCONNU;
  const s = v.trim().toLowerCase();
  return MOTIF_SRC.test(s) ? s : SRC_INCONNU;
}

/** Chemin interne de suivi (liens du site). */
export function cheminSuivi(cible: Cible, src: string): string {
  return `/${cible}?src=${encodeURIComponent(normaliserSrc(src))}`;
}

/** URL absolue de suivi (QR code, messages, affiches). */
export function urlSuivi(cible: Cible, src: string): string {
  return `${SITE}${cheminSuivi(cible, src)}`;
}

/** URL absolue d'inscription attribuée à une source. */
export function urlInscription(src: string): string {
  return `${SITE}/signup?src=${encodeURIComponent(normaliserSrc(src))}`;
}

/** Destination de la redirection : uniquement nos deux canaux, jamais une URL reçue. */
export function destination(cible: Cible): string {
  return cible === 'chaine' ? CANAUX.whatsappChaine : CANAUX.telegram;
}

export function evenementVisite(cible: Cible): Evenement {
  return cible === 'chaine' ? 'visite_chaine' : 'visite_telegram';
}

/**
 * Robots et aperçus de lien. Un lien partagé dans un groupe WhatsApp est d'abord
 * ouvert par le robot d'aperçu de WhatsApp : sans ce filtre, chaque partage
 * compterait une visite que personne n'a faite.
 */
const MOTIF_ROBOT =
  /bot\b|bot\/|crawl|spider|slurp|preview|facebookexternalhit|facebot|telegrambot|twitterbot|linkedinbot|slackbot|discordbot|skypeuripreview|embedly|quora link|pinterest|vkshare|w3c_validator|curl\/|wget\/|python-requests|httpclient|axios\/|node-fetch|go-http-client|headlesschrome|lighthouse|uptime|monitor/i;

/**
 * Le robot d'aperçu de WhatsApp s'annonce « WhatsApp/2.x … » SANS « Mozilla » ;
 * le navigateur intégré d'une application, lui, garde un User-Agent de
 * navigateur (« Mozilla/5.0 … ») : c'est une vraie personne, on la compte.
 */
const MOTIF_APERCU_APPLI = /^whatsapp\//i;

export function estRobot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').trim();
  if (!ua) return true; // aucun navigateur n'envoie un User-Agent vide
  return MOTIF_APERCU_APPLI.test(ua) || MOTIF_ROBOT.test(ua);
}

/**
 * Une requête compte-t-elle ? GET seulement (HEAD = vérification de lien),
 * pas de robot, pas de préchargement (`Purpose`/`Sec-Purpose: prefetch`).
 */
export function doitCompter(r: { methode: string; userAgent: string | null; purpose?: string | null }): boolean {
  if (r.methode.toUpperCase() !== 'GET') return false;
  if (/prefetch|prerender/i.test(r.purpose ?? '')) return false;
  return !estRobot(r.userAgent);
}

/** Fenêtre au-delà de laquelle un compte n'est plus « une inscription qui vient d'avoir lieu ». */
export const FENETRE_INSCRIPTION_MS = 30 * 60_000;

/** Le compte vient-il d'être créé (moins de 30 min) ? Sinon c'est une connexion, pas une inscription. */
export function estInscriptionRecente(createdAt: string | null | undefined, maintenant: Date): boolean {
  const c = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(c)) return false;
  const ecart = maintenant.getTime() - c;
  return ecart >= -60_000 && ecart < FENETRE_INSCRIPTION_MS;
}

export interface LigneCompteur {
  src: string;
  jour: string;
  evenement: Evenement | string;
  n: number;
}

export interface LigneSource {
  src: string;
  visitesChaine: number;
  visitesTelegram: number;
  inscriptions: number;
  total: number;
}

/** Agrégat par source, trié par total décroissant puis par nom. Événement inconnu ignoré. */
export function agregerParSource(lignes: LigneCompteur[]): LigneSource[] {
  const m = new Map<string, LigneSource>();
  for (const l of lignes) {
    const n = Number(l.n);
    if (!Number.isFinite(n) || n <= 0) continue;
    const s = m.get(l.src) ?? { src: l.src, visitesChaine: 0, visitesTelegram: 0, inscriptions: 0, total: 0 };
    if (l.evenement === 'visite_chaine') s.visitesChaine += n;
    else if (l.evenement === 'visite_telegram') s.visitesTelegram += n;
    else if (l.evenement === 'inscription') s.inscriptions += n;
    else continue;
    s.total += n;
    m.set(l.src, s);
  }
  return [...m.values()].sort((a, b) => b.total - a.total || a.src.localeCompare(b.src));
}
