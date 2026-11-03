/**
 * Tour de contrôle — domaine « envois » (PUR, aucun import serveur).
 *
 * Question posée : ce qui doit partir part-il vraiment ? Pas « le workflow
 * est-il vert » : pendant sept semaines (CLAUDE.md §9) `alerts.yml` a été vert
 * alors qu'aucun e-mail ne partait, parce que `dispatch` retombait sur la
 * console sans lever. On juge donc sur la DONNÉE produite par chaque flux
 * (journaux d'envoi, statuts de livraison), jamais sur la couleur d'un run.
 *
 * Le chargeur (`lectureEnvois.ts`) ne fait que lire des lignes bornées dans le
 * temps ; TOUTES les fenêtres et tous les seuils sont appliqués ici, à partir
 * de `maintenant`, pour être testables à la minute près.
 *
 * RGPD : les identifiants de compte servent au rapprochement en mémoire, mais
 * aucun texte produit ne contient d'identifiant, d'adresse, de numéro ni de
 * chat_id — seulement des nombres de comptes.
 */
import type { Signal, Niveau } from './types';

export type CanalPerso = 'email' | 'telegram' | 'whatsapp';

/** Une ligne de `notifications_log` (30 derniers jours). */
export interface LigneNotification {
  user_id: string | null;
  /** 'email' | 'telegram' | 'whatsapp' | 'console' (scraper/src/alerts/channels.ts). */
  channel: string;
  /** 'sent' | 'failed' — seules valeurs écrites par les workers. */
  status: string;
  created_at: string;
  /**
   * Vrai pour une ALERTE (alerte de cours : `alert_id` posé ; thèse : `code`
   * posé). Faux pour le point de clôture et le brief, qui écrivent dans la même
   * table avec `alert_id` et `code` nuls : les compter gonflerait le volume
   * « alertes » d'envois qui n'en sont pas.
   */
  alerte: boolean;
}

/**
 * Preuve qu'une alerte était DUE à un compte : `alerts.declenchee_le` (posé par
 * runAlerts à chaque déclenchement) ou `investment_theses.derniere_alerte_le`
 * (posé par runThesisAlerts quand une thèse bascule). 7 derniers jours.
 */
export interface Declenchement {
  user_id: string;
  at: string;
  source: 'alerte' | 'these';
}

export interface Abonnes {
  /** Comptes ayant coché ce canal. */
  demandeurs: number;
  /** Parmi eux, ceux dont la destination existe (conversation appairée, etc.). */
  joignables: string[];
}

/** Une ligne de `dossier_envois` (30 j, plus tout `en_cours` quel que soit son âge). */
export interface LigneDossier {
  canal: string;
  /** 'en_cours' | 'envoye' | 'echec' | 'vide' (scraper/src/dossiers/runEnvoi.ts). */
  statut: string;
  created_at: string;
}

/** Une ligne de `contact_messages` (réponses des 30 j, plus tout envoi bloqué). */
export interface LigneContact {
  canal: string;
  /** 'nouveau' | 'envoi' | 'repondu' | 'clos' | 'spam' (migration 0158). */
  statut: string;
  repondu_at: string | null;
  /** envoye < retarde < remis < rejete < spam (migration 0159), null = non suivie. */
  livraison: string | null;
  livraison_at: string | null;
  derniere_activite_at: string | null;
}

/** Une ligne de `publications_sociales` (30 j, plus tout `en_cours`). */
export interface LignePublication {
  reseau: string;
  /** 'a_valider' | 'en_cours' | 'publie' | 'echec' | 'ignore' (migration 0171). */
  statut: string;
  lance_le: string;
  termine_le: string | null;
}

/** Une ligne de `article_campagnes` (30 j, plus tout `en_cours`). */
export interface LigneCampagne {
  /** 'en_cours' | 'envoye' | 'partiel' | 'echec' (migration 0169). */
  statut: string;
  destinataires: number | null;
  envoyes: number | null;
  lance_le: string;
  termine_le: string | null;
}

/** Une relance CRM par e-mail (`crm_actions`, type relance, 30 j). */
export interface LigneRelance {
  /** 'envoi' | 'envoye' | 'echec' (migration 0174). */
  statut: string;
  livraison: string | null;
  created_at: string;
}

export interface DonneesEnvois {
  notifications: LigneNotification[];
  declenchements: Declenchement[];
  abonnesAlertes: Record<CanalPerso, Abonnes>;
  dossiers: LigneDossier[];
  abonnesDossiers: Record<CanalPerso, Abonnes>;
  contact: LigneContact[];
  social: LignePublication[];
  campagnes: LigneCampagne[];
  relances: LigneRelance[];
  /**
   * Dernier succès CONNU, toutes périodes, par identifiant de signal
   * (ex. 'envois:dossiers:email'). Les lignes ci-dessus sont bornées à 30 j ;
   * sans ceci, un flux muet depuis 40 jours afficherait « aucun succès connu »,
   * ce qui est faux et moins utile que la vraie date.
   */
  derniersSucces: Record<string, string | null>;
}

// ── Seuils ─────────────────────────────────────────────────────────────────
const H = 3_600_000;
const JOUR = 24 * H;
/** Taux d'échec à partir duquel on parle d'alerte… */
const TAUX_ALERTE = 0.5;
/** …à condition d'avoir au moins ce nombre de tentatives (sinon 1 sur 1 = 100 %). */
const MIN_TENTATIVES = 3;
/**
 * Un déclenchement plus jeune n'est pas encore exigible : runAlerts pose
 * `declenchee_le` puis journalise, runThesisAlerts journalise puis pose la
 * date. Entre les deux, la page verrait une alerte « due sans envoi » fictive.
 */
const GRACE_DECLENCHEMENT = 15 * 60_000;
/** Écart toléré entre l'envoi et la date de déclenchement (ordre d'écriture inverse selon le worker). */
const TOLERANCE_ORDRE = 10 * 60_000;
/** Une écriture `en_cours` plus vieille a été interrompue en route. */
const BLOCAGE = H;
/** Les dossiers partent le samedi : au-delà de 8 jours, un passage a manqué. */
const DOSSIERS_MAX_JOURS = 8;
/** Relances : part de rejets (adresses mortes) au-delà de laquelle la liste se dégrade. */
const TAUX_REJET_RELANCES = 0.1;
/** À partir de ce nombre de rejets sur 7 j, la qualité de distribution est « à surveiller ». */
const REJETS_A_SURVEILLER = 3;
const MIN_RELANCES_TAUX = 10;

// ── Outils de texte ────────────────────────────────────────────────────────
function pl(n: number, singulier: string, pluriel = `${singulier}s`): string {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

/** JJ/MM/AAAA en UTC (heure d'Abidjan) : déterministe, indépendant de la locale du serveur. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  const z = (x: number) => String(x).padStart(2, '0');
  return `${z(d.getUTCDate())}/${z(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function phraseSucces(iso: string | null, quoi = 'dernier envoi réussi'): string {
  return iso ? `${quoi} le ${fmtDate(iso)}` : `${quoi} : aucun connu`;
}

const t = (iso: string) => new Date(iso).getTime();

function plusRecent(...isos: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const x of isos) if (x && (!best || t(x) > t(best))) best = x;
  return best;
}

function tauxAlerte(tentatives: number, echecs: number): boolean {
  return tentatives >= MIN_TENTATIVES && echecs / tentatives >= TAUX_ALERTE;
}

function signal(id: string, titre: string, niveau: Niveau, detail: string, dernierSucces: string | null, lien: string | null = null): Signal {
  return { id, domaine: 'envois', titre, niveau, detail, dernierSucces, lien };
}

/** Ajoute la mention des comptes qui ont demandé le canal sans destination utilisable. */
const NOM_CANAL: Record<CanalPerso, string> = { email: "l'e-mail", telegram: 'Telegram', whatsapp: 'WhatsApp' };

/**
 * Personne de joignable sur ce canal (relecture du 2026-11-03) :
 *  - personne ne l'a demandé → non applicable (ne gonfle pas les « OK ») ;
 *  - quelqu'un l'a demandé sans relier sa conversation → parcours inachevé,
 *    à surveiller : ce n'est pas une panne, mais pas un état sain non plus.
 */
function sansAbonneJoignable(id: string, titre: string, canal: CanalPerso, a: Abonnes, dernier: string | null): Signal {
  if (a.demandeurs === 0) {
    return signal(id, titre, 'na', `Non applicable — aucun compte n'a demandé ${NOM_CANAL[canal]} (0 envoi sur 7 j).`, dernier);
  }
  const n = a.demandeurs;
  return signal(
    id,
    titre,
    'attention',
    `${pl(n, 'compte')} ${n > 1 ? 'ont' : 'a'} demandé ${NOM_CANAL[canal]}, mais ${n > 1 ? 'leur' : 'sa'} ${QUOI_DESTINATION[canal]} n'est pas reliée : le canal n'est pas encore utilisable (activation incomplète, 0 envoi sur 7 j).`,
    dernier,
  );
}

function sansDestination(a: Abonnes, quoi: string): string {
  const n = a.demandeurs - a.joignables.length;
  return n > 0 ? ` ; ${pl(n, 'compte')} l'${n > 1 ? 'ont' : 'a'} demandé sans relier de ${quoi}` : '';
}

// ── Alertes par canal personnel ────────────────────────────────────────────

const TITRES_ALERTE: Record<CanalPerso, string> = {
  email: "E-mails d'alerte",
  telegram: "Telegram d'alerte",
  whatsapp: "WhatsApp d'alerte",
};

/**
 * Quelle source d'alerte est routée vers quel canal personnel — relevé dans le
 * code des workers, pas supposé :
 *  - e-mail : SEULES les thèses (runThesisAlerts, `alerts_email`). Les alertes
 *    de cours appellent `dispatch` avec `to: null` et alerts.yml ne pose pas
 *    `ALERTS_EMAIL_TO` : elles n'écrivent à aucun utilisateur par e-mail.
 *  - Telegram : alertes de cours (`telegramChatId` du propriétaire).
 *  - WhatsApp : alertes de cours par la passerelle (comptes Premium appairés).
 *    Les thèses passent par l'ancien chemin Meta, dormant, non compté ici.
 */
const SOURCES_PAR_CANAL: Record<CanalPerso, Declenchement['source'][]> = {
  // Depuis le 2026-11-03, les alertes de COURS partent aussi par e-mail
  // (runAlerts passait `to: null` : aucune n'était jamais envoyée).
  email: ['alerte', 'these'],
  telegram: ['alerte'],
  whatsapp: ['alerte'],
};

const QUOI_DESTINATION: Record<CanalPerso, string> = {
  email: 'adresse',
  telegram: 'conversation',
  whatsapp: 'conversation',
};

function evaluerAlerte(canal: CanalPerso, d: DonneesEnvois, now: number): Signal {
  const id = `envois:alertes:${canal}`;
  const titre = TITRES_ALERTE[canal];
  const abonnes = d.abonnesAlertes[canal];
  const lignes = d.notifications.filter((l) => l.alerte && l.channel === canal);
  const l7 = lignes.filter((l) => now - t(l.created_at) <= 7 * JOUR);
  const echecs7 = l7.filter((l) => l.status !== 'sent').length;
  const echecs24 = l7.filter((l) => l.status !== 'sent' && now - t(l.created_at) <= JOUR).length;
  const dernier = plusRecent(d.derniersSucces[id], ...lignes.filter((l) => l.status === 'sent').map((l) => l.created_at));

  /* RÈGLE « PANNE MUETTE », affinée par rapport à « des comptes ont demandé le
     canal et rien n'est parti depuis 7 j ». Cette version-là crierait au loup
     dès aujourd'hui : quatre comptes ont coché l'e-mail, mais l'e-mail ne sert
     qu'aux thèses et aucune n'a basculé — rien à envoyer n'est pas une panne,
     et une alarme permanente finit ignorée, ce qui est le défaut même qu'on
     combat. On exige donc une PREUVE qu'un envoi était dû (déclenchement
     daté) et l'absence d'envoi réussi APRÈS lui. C'est la signature exacte de
     la panne de sept semaines : alertes déclenchées, rien de journalisé sur
     le canal, puisque `sendEmail` rendait `null` sans clé. */
  const joignables = new Set(abonnes.joignables);
  const sources = SOURCES_PAR_CANAL[canal];
  const succes = lignes.filter((l) => l.status === 'sent');
  const comptesEnSouffrance = new Set<string>();
  for (const dec of d.declenchements) {
    if (!joignables.has(dec.user_id) || !sources.includes(dec.source)) continue;
    const age = now - t(dec.at);
    if (age > 7 * JOUR || age < GRACE_DECLENCHEMENT) continue;
    const servi = succes.some((l) => l.user_id === dec.user_id && t(l.created_at) >= t(dec.at) - TOLERANCE_ORDRE);
    if (!servi) comptesEnSouffrance.add(dec.user_id);
  }

  const volume = `${pl(l7.length, 'envoi')} sur 7 j, ${pl(echecs7, 'échec')}`;

  if (abonnes.joignables.length === 0 && l7.length === 0) return sansAbonneJoignable(id, titre, canal, abonnes, dernier);
  const abonnesTxt = `${pl(abonnes.joignables.length, 'compte abonné', 'comptes abonnés')}${sansDestination(abonnes, QUOI_DESTINATION[canal])}`;

  if (tauxAlerte(l7.length, echecs7)) {
    return signal(id, titre, 'alerte', `${volume} : au moins la moitié des envois échouent ; ${phraseSucces(dernier)}.`, dernier);
  }
  if (comptesEnSouffrance.size > 0) {
    return signal(
      id,
      titre,
      'alerte',
      `${pl(comptesEnSouffrance.size, 'compte')} ${comptesEnSouffrance.size > 1 ? 'avaient' : 'avait'} une alerte déclenchée sur 7 j sans aucun envoi réussi par ce canal ensuite ; ${volume} ; ${phraseSucces(dernier)}.`,
      dernier,
    );
  }
  if (echecs24 > 0) {
    return signal(id, titre, 'attention', `${pl(echecs24, 'échec')} sur 24 h ; ${volume} ; ${phraseSucces(dernier)}.`, dernier);
  }
  // Des comptes joignables l'ont demandé et RIEN n'est jamais parti : ce n'est
  // pas un état sain mais la signature d'un canal non branché. Cas réel du
  // 2026-11-03 : 4 comptes, aucun e-mail d'alerte jamais envoyé — la page
  // affichait « ok ».
  if (abonnes.joignables.length > 0 && dernier === null) {
    return signal(
      id,
      titre,
      'attention',
      `${abonnesTxt} : aucun envoi n'a jamais réussi sur ce canal — il n'est peut-être pas branché ; ${volume}.`,
      dernier,
    );
  }
  return signal(id, titre, 'ok', `${volume} ; ${abonnesTxt} ; ${phraseSucces(dernier)}.`, dernier);
}

// ── Dossiers du samedi ─────────────────────────────────────────────────────

const TITRES_DOSSIER: Record<CanalPerso, string> = {
  email: 'Dossiers par e-mail',
  telegram: 'Dossiers par Telegram',
  whatsapp: 'Dossiers par WhatsApp',
};

function evaluerDossier(canal: CanalPerso, d: DonneesEnvois, now: number): Signal {
  const id = `envois:dossiers:${canal}`;
  const titre = TITRES_DOSSIER[canal];
  const abonnes = d.abonnesDossiers[canal];
  const lignes = d.dossiers.filter((l) => l.canal === canal);
  const l7 = lignes.filter((l) => now - t(l.created_at) <= 7 * JOUR);
  // Une tentative est un envoi TERMINÉ ; « vide » (portefeuille sans ligne) n'en
  // est pas une : aucun message n'a été tenté, et c'est voulu (runEnvoi.ts).
  const tentatives = l7.filter((l) => l.statut === 'envoye' || l.statut === 'echec');
  const echecs7 = tentatives.filter((l) => l.statut === 'echec').length;
  const bloques = lignes.filter((l) => l.statut === 'en_cours' && now - t(l.created_at) > BLOCAGE).length;
  const dernier = plusRecent(d.derniersSucces[id], ...lignes.filter((l) => l.statut === 'envoye').map((l) => l.created_at));
  // Toute ligne prouve que le job est passé pour ce canal, même « vide ».
  const derniereTrace = plusRecent(...lignes.map((l) => l.created_at));

  const volume = `${pl(tentatives.length, 'envoi')} sur 7 j, ${pl(echecs7, 'échec')}`;

  if (abonnes.joignables.length === 0 && lignes.length === 0) return sansAbonneJoignable(id, titre, canal, abonnes, dernier);
  if (tauxAlerte(tentatives.length, echecs7)) {
    return signal(id, titre, 'alerte', `${volume} : au moins la moitié des envois échouent ; ${phraseSucces(dernier)}.`, dernier);
  }
  /* Fenêtre élargie à 7 j (et non 24 h) : le flux est HEBDOMADAIRE. Un échec
     du samedi sortirait d'une fenêtre de 24 h avant le dimanche soir, c'est-à-
     dire avant que quiconque n'ouvre la page. */
  if (echecs7 > 0) {
    return signal(id, titre, 'attention', `${volume} lors du dernier passage ; ${phraseSucces(dernier)}.`, dernier);
  }
  if (bloques > 0) {
    return signal(id, titre, 'attention', `${pl(bloques, 'envoi resté', 'envois restés')} en cours plus d'une heure (job interrompu) ; ${volume}.`, dernier);
  }
  /* Abonnés présents mais aucune trace récente : le job n'est pas passé, ou
     n'a pas atteint ce canal. On juge la TRACE et non le succès : une semaine
     entière en « vide » (portefeuilles sans ligne) est légitime. */
  if (abonnes.joignables.length > 0) {
    const ageJ = derniereTrace ? Math.floor((now - t(derniereTrace)) / JOUR) : null;
    if (ageJ === null || ageJ > DOSSIERS_MAX_JOURS) {
      const quand = ageJ === null ? 'aucun passage connu' : `aucun passage depuis ${ageJ} j`;
      return signal(
        id,
        titre,
        'attention',
        `${quand} alors que ${pl(abonnes.joignables.length, 'compte abonné', 'comptes abonnés')} l'attend${abonnes.joignables.length > 1 ? 'ent' : ''} ; ${phraseSucces(dernier)}.`,
        dernier,
      );
    }
  }
  const vides = l7.filter((l) => l.statut === 'vide').length;
  const videsTxt = vides > 0 ? ` ; ${pl(vides, 'portefeuille vide', 'portefeuilles vides')}, rien à envoyer` : '';
  return signal(
    id,
    titre,
    'ok',
    `${volume}${videsTxt} ; ${pl(abonnes.joignables.length, 'compte abonné', 'comptes abonnés')}${sansDestination(abonnes, QUOI_DESTINATION[canal])} ; ${phraseSucces(dernier)}.`,
    dernier,
  );
}

// ── Réponses au formulaire de contact ──────────────────────────────────────

function evaluerContact(d: DonneesEnvois, now: number): Signal {
  const id = 'envois:contact';
  const titre = 'Réponses aux messages de contact';
  const lien = '/admin/contact';
  const reponses = d.contact.filter((l) => l.repondu_at);
  const r7 = reponses.filter((l) => now - t(l.repondu_at!) <= 7 * JOUR);
  const nonRemise = (l: LigneContact) => l.livraison === 'rejete' || l.livraison === 'spam';
  const rejets7 = r7.filter(nonRemise).length;
  const rejets30 = reponses.filter((l) => nonRemise(l) && now - t(l.repondu_at!) <= 30 * JOUR).length;
  /* Seules les réponses SUIVIES (« envoye » posé à l'envoi depuis 0159) peuvent
     être « non confirmées » : null = réponse antérieure au suivi, jamais
     confirmable (même règle que scraper/src/contact/rappel.ts). Fenêtre de
     30 j, plus large que le rappel (7 j) : le rappel relance, la page constate,
     et une remise jamais confirmée ne devient pas confirmée en vieillissant. */
  const nonConfirmees = reponses.filter((l) => {
    if (l.livraison !== 'envoye' && l.livraison !== 'retarde') return false;
    const age = now - t(l.repondu_at!);
    return age > JOUR && age <= 30 * JOUR;
  }).length;
  const bloques = d.contact.filter((l) => {
    if (l.statut !== 'envoi') return false;
    const depuis = l.derniere_activite_at ?? l.repondu_at;
    return !depuis || now - t(depuis) > BLOCAGE;
  }).length;
  const dernier = plusRecent(
    d.derniersSucces[id],
    ...reponses.filter((l) => l.livraison === 'remis' && l.livraison_at).map((l) => l.livraison_at),
  );

  const volume = `${pl(r7.length, 'réponse')} sur 7 j, ${pl(rejets7, 'non remise')}`;
  const succes = phraseSucces(dernier, 'dernière remise confirmée');

  if (rejets30 > 0) {
    return signal(
      id,
      titre,
      'alerte',
      `${pl(rejets30, 'réponse rejetée ou classée', 'réponses rejetées ou classées')} en indésirable sur 30 j : la personne n'a pas reçu la réponse ; ${volume} ; ${succes}.`,
      dernier,
      lien,
    );
  }
  if (nonConfirmees > 0) {
    return signal(
      id,
      titre,
      'attention',
      `${pl(nonConfirmees, 'réponse')} sans confirmation de remise après 24 h (suivi de livraison muet ?) ; ${volume} ; ${succes}.`,
      dernier,
      lien,
    );
  }
  if (bloques > 0) {
    return signal(id, titre, 'attention', `${pl(bloques, 'envoi resté bloqué', 'envois restés bloqués')} en cours plus d'une heure ; ${volume}.`, dernier, lien);
  }
  return signal(id, titre, 'ok', `${volume} ; ${succes}.`, dernier, lien);
}

// ── Réseaux sociaux ────────────────────────────────────────────────────────

const NOMS_RESEAUX: Record<string, string> = { linkedin: 'LinkedIn', tiktok: 'TikTok' };

function evaluerReseaux(d: DonneesEnvois, now: number): Signal[] {
  const lien = '/admin/reseaux';
  const reseaux = new Set(d.social.map((l) => l.reseau));
  for (const k of Object.keys(d.derniersSucces)) {
    if (k.startsWith('envois:reseaux:') && d.derniersSucces[k]) reseaux.add(k.slice('envois:reseaux:'.length));
  }
  if (reseaux.size === 0) {
    return [signal('envois:reseaux', 'Réseaux sociaux', 'ok', '0 publication sur 30 j sur les réseaux sociaux.', null, lien)];
  }

  return [...reseaux].sort().map((reseau) => {
    const id = `envois:reseaux:${reseau}`;
    const titre = `Réseaux sociaux — ${NOMS_RESEAUX[reseau] ?? reseau}`;
    const lignes = d.social.filter((l) => l.reseau === reseau);
    const l7 = lignes.filter((l) => now - t(l.lance_le) <= 7 * JOUR);
    // « à valider » (TikTok, publication manuelle imposée par l'audit) et
    // « ignore » ne sont pas des tentatives : rien n'a été envoyé à l'API.
    const tentatives = l7.filter((l) => l.statut === 'publie' || l.statut === 'echec');
    const echecs7 = tentatives.filter((l) => l.statut === 'echec').length;
    const echecs24 = tentatives.filter((l) => l.statut === 'echec' && now - t(l.lance_le) <= JOUR).length;
    const aValider = lignes.filter((l) => l.statut === 'a_valider').length;
    const bloques = lignes.filter((l) => l.statut === 'en_cours' && now - t(l.lance_le) > BLOCAGE).length;
    const dernier = plusRecent(
      d.derniersSucces[id],
      ...lignes.filter((l) => l.statut === 'publie').map((l) => l.termine_le ?? l.lance_le),
    );
    const volume =
      `${pl(tentatives.length, 'publication')} sur 7 j, ${pl(echecs7, 'échec')}` +
      (aValider > 0 ? `, ${aValider} en attente de validation` : '');
    const succes = phraseSucces(dernier, 'dernière publication');

    /* En cours depuis plus d'une heure = ALERTE et non attention : l'API a pu
       publier avant que le statut ne soit écrit (migration 0170). Le verrou
       interdit toute reprise automatique ; il faut aller vérifier sur le
       réseau à la main, sous peine de doublon public. */
    if (bloques > 0) {
      return signal(id, titre, 'alerte', `${pl(bloques, 'publication restée', 'publications restées')} en cours plus d'une heure : vérifier sur le réseau avant toute reprise ; ${volume}.`, dernier, lien);
    }
    if (tauxAlerte(tentatives.length, echecs7)) {
      return signal(id, titre, 'alerte', `${volume} : au moins la moitié des publications échouent ; ${succes}.`, dernier, lien);
    }
    if (echecs24 > 0) {
      return signal(id, titre, 'attention', `${pl(echecs24, 'échec')} sur 24 h ; ${volume} ; ${succes}.`, dernier, lien);
    }
    return signal(id, titre, 'ok', `${volume} ; ${succes}.`, dernier, lien);
  });
}

// ── Campagnes e-mail d'articles ────────────────────────────────────────────

function evaluerCampagnes(d: DonneesEnvois, now: number): Signal {
  const id = 'envois:campagnes';
  const titre = "Campagnes e-mail d'articles";
  const lien = '/admin/articles';
  const c7 = d.campagnes.filter((c) => now - t(c.lance_le) <= 7 * JOUR && c.statut !== 'en_cours');
  // « partiel » compte comme incomplet : des abonnés n'ont rien reçu, et le
  // verrou (0169) interdit de relancer une campagne qui a déjà écrit.
  const incompletes = c7.filter((c) => c.statut === 'partiel' || c.statut === 'echec').length;
  const bloques = d.campagnes.filter((c) => c.statut === 'en_cours' && now - t(c.lance_le) > BLOCAGE).length;
  const dest = c7.reduce((s, c) => s + (c.destinataires ?? 0), 0);
  const partis = c7.reduce((s, c) => s + (c.envoyes ?? 0), 0);
  const dernier = plusRecent(
    d.derniersSucces[id],
    ...d.campagnes.filter((c) => c.statut === 'envoye').map((c) => c.termine_le ?? c.lance_le),
  );
  const volume =
    `${pl(c7.length, 'campagne')} sur 7 j, ${pl(incompletes, 'incomplète')}` +
    (c7.length > 0 ? ` ; ${partis} e-mail${partis > 1 ? 's' : ''} parti${partis > 1 ? 's' : ''} sur ${dest} destinataire${dest > 1 ? 's' : ''}` : '');
  const succes = phraseSucces(dernier, 'dernière campagne complète');

  if (tauxAlerte(c7.length, incompletes)) {
    return signal(id, titre, 'alerte', `${volume} : au moins la moitié des campagnes sont incomplètes ; ${succes}.`, dernier, lien);
  }
  // Fenêtre de 7 j : flux manuel et rare, un échec de 24 h disparaîtrait trop vite.
  if (incompletes > 0) {
    return signal(id, titre, 'attention', `${volume} ; ${succes}.`, dernier, lien);
  }
  if (bloques > 0) {
    return signal(id, titre, 'attention', `${pl(bloques, 'campagne restée', 'campagnes restées')} en cours plus d'une heure ; ${volume}.`, dernier, lien);
  }
  return signal(id, titre, 'ok', `${volume} ; ${succes}.`, dernier, lien);
}

// ── Relances CRM par e-mail ────────────────────────────────────────────────

/**
 * Ajouté à la liste demandée : c'est le seul autre flux d'e-mails sortants
 * (relances manuelles et séquences, lib/crm/envoiRelance.ts), il journalise son
 * statut ET sa livraison, et une plainte pour spam y abîme la réputation du
 * domaine qui porte aussi support@ et les dossiers.
 */
function evaluerRelances(d: DonneesEnvois, now: number): Signal {
  const id = 'envois:relances-crm';
  const titre = 'Relances CRM par e-mail';
  const lien = '/admin/crm';
  const r7 = d.relances.filter((r) => now - t(r.created_at) <= 7 * JOUR && (r.statut === 'envoye' || r.statut === 'echec'));
  const echecs7 = r7.filter((r) => r.statut === 'echec').length;
  const echecs24 = r7.filter((r) => r.statut === 'echec' && now - t(r.created_at) <= JOUR).length;
  const rejets7 = r7.filter((r) => r.livraison === 'rejete').length;
  const spam30 = d.relances.filter((r) => r.livraison === 'spam' && now - t(r.created_at) <= 30 * JOUR).length;
  const dernier = plusRecent(d.derniersSucces[id], ...d.relances.filter((r) => r.livraison === 'remis').map((r) => r.created_at));
  // Étapes DISTINCTES (relecture du 2026-11-03) : « 0 échec, 13 rejetées »
  // mélangeait la soumission au prestataire et la remise à la boîte.
  const remis7 = r7.filter((r) => r.livraison === 'remis').length;
  const sansRetour7 = r7.filter((r) => r.statut === 'envoye' && (r.livraison === null || r.livraison === 'envoye' || r.livraison === 'retarde')).length;
  const volume = `${pl(r7.length, 'relance enregistrée', 'relances enregistrées')} sur 7 j — soumission : ${pl(echecs7, 'échec technique', 'échecs techniques')} ; remise : ${remis7} confirmée${remis7 > 1 ? 's' : ''}, ${pl(rejets7, 'adresse rejetée', 'adresses rejetées')}, ${sansRetour7} sans retour du prestataire`;
  const succes = phraseSucces(dernier, 'dernière remise confirmée');

  if (spam30 > 0) {
    return signal(id, titre, 'alerte', `${pl(spam30, 'plainte', 'plaintes')} pour courrier indésirable sur 30 j ; ${volume} ; ${succes}.`, dernier, lien);
  }
  if (tauxAlerte(r7.length, echecs7)) {
    return signal(id, titre, 'alerte', `${volume} : au moins la moitié des relances échouent à l'envoi ; ${succes}.`, dernier, lien);
  }
  if (echecs24 > 0) {
    return signal(id, titre, 'attention', `${pl(echecs24, "échec d'envoi", "échecs d'envoi")} sur 24 h ; ${volume} ; ${succes}.`, dernier, lien);
  }
  /* Un rejet isolé est normal (adresse saisie avec une faute à l'inscription).
     À partir de 10 %, c'est la liste qui se dégrade, et un fort taux de rejet
     fait suspendre un domaine expéditeur par Resend. */
  if (r7.length >= MIN_RELANCES_TAUX && rejets7 / r7.length >= TAUX_REJET_RELANCES) {
    return signal(id, titre, 'attention', `${volume} : au moins une adresse sur dix est rejetée ; ${succes}.`, dernier, lien);
  }
  // Quelques rejets ne sont pas une panne, mais la qualité de distribution doit
  // se voir : à surveiller, avec l'action à mener.
  if (rejets7 >= REJETS_A_SURVEILLER) {
    return signal(id, titre, 'attention', `${volume}. Vérifier les motifs de rejet et exclure ces adresses des prochaines relances ; ${succes}.`, dernier, lien);
  }
  return signal(id, titre, 'ok', `${volume} ; ${succes}.`, dernier, lien);
}

// ── Point d'entrée ─────────────────────────────────────────────────────────

const CANAUX: CanalPerso[] = ['email', 'telegram', 'whatsapp'];

const DEPOT = 'https://github.com/ebouak/brvm-analyst-pro';

/**
 * Ce que date le repère de chaque flux, et où agir (relecture du 2026-11-03 :
 * « dernier succès » désignait tour à tour un envoi, une remise, une campagne).
 * Liens seulement : aucun renvoi automatique — un message ne se relance
 * qu'après vérification des doublons et de sa pertinence actuelle.
 */
function enrichir(s: Signal): Signal {
  const [, flux] = s.id.split(':');
  const def: Record<string, { repere: string; actions: { libelle: string; href: string }[] }> = {
    alertes: { repere: 'Dernier envoi réussi', actions: [{ libelle: 'Workflow des alertes', href: `${DEPOT}/actions/workflows/alerts.yml` }] },
    dossiers: { repere: 'Dernier envoi réussi', actions: [{ libelle: 'Workflow des dossiers', href: `${DEPOT}/actions/workflows/dossier.yml` }] },
    contact: { repere: 'Dernière remise confirmée', actions: [{ libelle: 'Messages de contact', href: '/admin/contact' }] },
    reseaux: { repere: 'Dernière publication', actions: [{ libelle: 'Réseaux sociaux', href: '/admin/reseaux' }] },
    campagnes: { repere: 'Dernière campagne complète', actions: [{ libelle: 'Newsletter', href: '/admin/newsletter' }] },
    'relances-crm': { repere: 'Dernière remise confirmée', actions: [{ libelle: 'CRM', href: '/admin/crm' }] },
  };
  const e = def[flux];
  if (!e) return s;
  return {
    ...s,
    reperes: s.dernierSucces ? [{ libelle: e.repere, date: s.dernierSucces, nature: 'instant' }] : [],
    actions: e.actions,
  };
}

export function evaluerEnvois(d: DonneesEnvois, maintenant: Date): Signal[] {
  const now = maintenant.getTime();
  return [
    ...CANAUX.map((c) => evaluerAlerte(c, d, now)),
    ...CANAUX.map((c) => evaluerDossier(c, d, now)),
    evaluerContact(d, now),
    ...evaluerReseaux(d, now),
    evaluerCampagnes(d, now),
    evaluerRelances(d, now),
  ].map(enrichir);
}
