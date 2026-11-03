import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import type {
  Abonnes,
  CanalPerso,
  Declenchement,
  DonneesEnvois,
  LigneCampagne,
  LigneContact,
  LigneDossier,
  LigneNotification,
  LignePublication,
  LigneRelance,
} from './envois';

/**
 * Chargeur du domaine « envois » de la Tour de contrôle (SERVER-ONLY).
 *
 * Il LÈVE à la première requête en échec : la page transforme cette exception
 * en signal « inconnu ». Un repli silencieux sur une liste vide afficherait
 * « 0 échec » sur un journal illisible — c'est-à-dire un vert mensonger, le
 * défaut exact de la panne e-mail de sept semaines.
 *
 * Il ne fait que LIRE des lignes bornées (30 j, plus les écritures restées
 * `en_cours` quel que soit leur âge) ; toutes les fenêtres et tous les seuils
 * vivent dans `envois.ts`, pur et testé.
 *
 * Pagination systématique : PostgREST tronque à 1000 lignes EN SILENCE, ce qui
 * produirait des volumes faux et plausibles.
 */

const JOUR = 24 * 3_600_000;
const LOT = 1000;

type Reponse<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function lireTout<T>(quoi: string, construire: (de: number, a: number) => Reponse<T>): Promise<T[]> {
  const tout: T[] = [];
  for (let de = 0; ; de += LOT) {
    const { data, error } = await construire(de, de + LOT - 1);
    if (error) throw new Error(`Tour de contrôle (envois) : lecture « ${quoi} » impossible (${error.message})`);
    const lot = data ?? [];
    tout.push(...lot);
    if (lot.length < LOT) return tout;
  }
}

/** Valeur d'une colonne sur la ligne la plus récente, ou null si aucune ligne. */
async function premier<T>(quoi: string, requete: Reponse<T>, colonne: keyof T): Promise<string | null> {
  const { data, error } = await requete;
  if (error) throw new Error(`Tour de contrôle (envois) : lecture « ${quoi} » impossible (${error.message})`);
  const v = data?.[0]?.[colonne];
  return typeof v === 'string' ? v : null;
}

/** `.in()` découpé : une liste d'identifiants trop longue dépasse la taille d'URL admise. */
async function parPaquets<T>(ids: string[], lire: (paquet: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) out.push(...(await lire(ids.slice(i, i + 200))));
  return out;
}

interface Pref {
  user_id: string;
  alerts_email: boolean | null;
  telegram_optin: boolean | null;
  alerts_telegram: boolean | null;
  telegram_chat_id: number | null;
  whatsapp_optin: boolean | null;
  alerts_whatsapp: boolean | null;
  whatsapp_chat_id: string | null;
  dossiers_email: boolean | null;
  dossiers_telegram: boolean | null;
  dossiers_whatsapp: boolean | null;
}

export async function chargerEnvois(): Promise<DonneesEnvois> {
  const sb = getServiceClient();
  const maintenant = Date.now();
  const depuis30 = new Date(maintenant - 30 * JOUR).toISOString();
  const depuis7 = new Date(maintenant - 7 * JOUR).toISOString();

  // ── Abonnés : qui a DEMANDÉ quoi, et qui est réellement joignable ─────────
  const prefs = await lireTout<Pref>('préférences de notification', (de, a) =>
    sb
      .from('notification_prefs')
      .select(
        'user_id, alerts_email, telegram_optin, alerts_telegram, telegram_chat_id, whatsapp_optin, alerts_whatsapp, whatsapp_chat_id, dossiers_email, dossiers_telegram, dossiers_whatsapp',
      )
      .or('alerts_email.eq.true,alerts_telegram.eq.true,alerts_whatsapp.eq.true,dossiers_email.eq.true,dossiers_telegram.eq.true,dossiers_whatsapp.eq.true')
      .order('user_id')
      .range(de, a),
  );

  const idsWa = prefs.filter((p) => (p.whatsapp_optin && p.alerts_whatsapp) || p.dossiers_whatsapp).map((p) => p.user_id);
  const idsMail = prefs.filter((p) => p.dossiers_email).map((p) => p.user_id);

  const [premiums, liaisons, avecAdresse] = await Promise.all([
    parPaquets(idsWa, (paquet) =>
      lireTout<{ id: string }>('comptes Premium', (de, a) =>
        sb.from('profiles').select('id').in('id', paquet).eq('is_premium', true).order('id').range(de, a),
      ),
    ),
    // Liaisons WhatsApp PROUVÉES par appairage (0165). Une erreur ici lève :
    // la tolérance « table absente » de scraper/src/whatsapp/liaisons.ts ne
    // vaut plus, la migration est appliquée en production.
    parPaquets(idsWa, (paquet) =>
      lireTout<{ user_id: string }>('liaisons WhatsApp', (de, a) =>
        sb.from('whatsapp_liaisons').select('user_id').in('user_id', paquet).order('user_id').range(de, a),
      ),
    ),
    // Seule la PRÉSENCE d'une adresse est lue (filtre côté base), jamais
    // l'adresse elle-même : minimisation, la page n'en a pas besoin.
    parPaquets(idsMail, (paquet) =>
      lireTout<{ id: string }>('comptes avec adresse', (de, a) =>
        sb.from('profiles').select('id').in('id', paquet).not('email', 'is', null).order('id').range(de, a),
      ),
    ),
  ]);

  const premium = new Set(premiums.map((p) => p.id));
  const relies = new Set(liaisons.map((l) => l.user_id));
  const adresse = new Set(avecAdresse.map((p) => p.id));
  // Ancienne colonne (0162) conservée en repli, comme chatsParUtilisateur.
  const waJoignable = (p: Pref) => premium.has(p.user_id) && (relies.has(p.user_id) || Boolean(p.whatsapp_chat_id));

  const abonnes = (demande: (p: Pref) => boolean, joignable: (p: Pref) => boolean): Abonnes => {
    const dem = prefs.filter((p) => Boolean(demande(p)));
    return { demandeurs: dem.length, joignables: dem.filter(joignable).map((p) => p.user_id) };
  };

  /* Conditions recopiées des workers, pas réinventées :
     - alertes : scraper/src/alerts/runAlerts.ts et theses/runThesisAlerts.ts ;
     - dossiers : scraper/src/dossiers/runEnvoi.ts (« un canal demandé mais
       inutilisable est ignoré en silence »). */
  const abonnesAlertes: Record<CanalPerso, Abonnes> = {
    // L'adresse est celle du compte (auth), toujours présente à l'inscription.
    email: abonnes((p) => Boolean(p.alerts_email), () => true),
    telegram: abonnes((p) => Boolean(p.telegram_optin && p.alerts_telegram), (p) => p.telegram_chat_id != null),
    whatsapp: abonnes((p) => Boolean(p.whatsapp_optin && p.alerts_whatsapp), waJoignable),
  };
  const abonnesDossiers: Record<CanalPerso, Abonnes> = {
    email: abonnes((p) => Boolean(p.dossiers_email), (p) => adresse.has(p.user_id)),
    telegram: abonnes((p) => Boolean(p.dossiers_telegram), (p) => p.telegram_chat_id != null),
    whatsapp: abonnes((p) => Boolean(p.dossiers_whatsapp), waJoignable),
  };

  // ── Journaux d'envoi, bornés, en parallèle ────────────────────────────────
  const [notifsBrutes, alertesDec, thesesDec, dossiers, contact, social, campagnes, relances] = await Promise.all([
    lireTout<{ user_id: string | null; channel: string; status: string; created_at: string; alert_id: string | null; code: string | null }>(
      'journal des notifications',
      (de, a) =>
        sb
          .from('notifications_log')
          .select('user_id, channel, status, created_at, alert_id, code')
          .gte('created_at', depuis30)
          .order('created_at')
          .order('id')
          .range(de, a),
    ),
    lireTout<{ user_id: string; declenchee_le: string }>('déclenchements d’alertes', (de, a) =>
      sb.from('alerts').select('user_id, declenchee_le').gte('declenchee_le', depuis7).order('declenchee_le').order('id').range(de, a),
    ),
    lireTout<{ user_id: string; derniere_alerte_le: string }>('bascules de thèses', (de, a) =>
      sb
        .from('investment_theses')
        .select('user_id, derniere_alerte_le')
        .gte('derniere_alerte_le', depuis7)
        .order('derniere_alerte_le')
        .order('id')
        .range(de, a),
    ),
    lireTout<LigneDossier>('envois de dossiers', (de, a) =>
      sb
        .from('dossier_envois')
        .select('canal, statut, created_at')
        .or(`created_at.gte.${depuis30},statut.eq.en_cours`)
        .order('created_at')
        .order('user_id')
        .order('canal')
        .range(de, a),
    ),
    lireTout<LigneContact>('réponses de contact', (de, a) =>
      sb
        .from('contact_messages')
        .select('canal, statut, repondu_at, livraison, livraison_at, derniere_activite_at')
        .or(`repondu_at.gte.${depuis30},statut.eq.envoi`)
        .order('created_at')
        .order('id')
        .range(de, a),
    ),
    lireTout<LignePublication>('publications sociales', (de, a) =>
      sb
        .from('publications_sociales')
        .select('reseau, statut, lance_le, termine_le')
        .or(`lance_le.gte.${depuis30},statut.eq.en_cours`)
        .order('lance_le')
        .order('cible_id')
        .order('reseau')
        .range(de, a),
    ),
    lireTout<LigneCampagne>('campagnes d’articles', (de, a) =>
      sb
        .from('article_campagnes')
        .select('statut, destinataires, envoyes, lance_le, termine_le')
        .or(`lance_le.gte.${depuis30},statut.eq.en_cours`)
        .order('lance_le')
        .order('article_id')
        .range(de, a),
    ),
    lireTout<LigneRelance>('relances CRM', (de, a) =>
      sb
        .from('crm_actions')
        .select('statut, livraison, created_at')
        .eq('type', 'relance')
        .eq('canal', 'email')
        .gte('created_at', depuis30)
        .order('created_at')
        .order('id')
        .range(de, a),
    ),
  ]);

  const notifications: LigneNotification[] = notifsBrutes.map((l) => ({
    user_id: l.user_id,
    channel: l.channel,
    status: l.status,
    created_at: l.created_at,
    alerte: l.alert_id != null || l.code != null,
  }));
  const declenchements: Declenchement[] = [
    ...alertesDec.map((x) => ({ user_id: x.user_id, at: x.declenchee_le, source: 'alerte' as const })),
    ...thesesDec.map((x) => ({ user_id: x.user_id, at: x.derniere_alerte_le, source: 'these' as const })),
  ];

  // ── Derniers succès toutes périodes (une ligne chacun) ────────────────────
  const reseaux = [...new Set(['linkedin', 'tiktok', ...social.map((s) => s.reseau)])];
  const canaux: CanalPerso[] = ['email', 'telegram', 'whatsapp'];
  const [succesAlertes, succesDossiers, succesContact, succesReseaux, succesCampagne, succesRelance] = await Promise.all([
    Promise.all(
      canaux.map((c) =>
        premier<{ created_at: string }>(
          `dernière alerte ${c}`,
          sb
            .from('notifications_log')
            .select('created_at')
            .eq('channel', c)
            .eq('status', 'sent')
            .or('alert_id.not.is.null,code.not.is.null')
            .order('created_at', { ascending: false })
            .limit(1),
          'created_at',
        ),
      ),
    ),
    Promise.all(
      canaux.map((c) =>
        premier<{ created_at: string }>(
          `dernier dossier ${c}`,
          sb.from('dossier_envois').select('created_at').eq('canal', c).eq('statut', 'envoye').order('created_at', { ascending: false }).limit(1),
          'created_at',
        ),
      ),
    ),
    premier<{ livraison_at: string }>(
      'dernière remise de contact',
      sb.from('contact_messages').select('livraison_at').eq('livraison', 'remis').order('livraison_at', { ascending: false }).limit(1),
      'livraison_at',
    ),
    Promise.all(
      reseaux.map((r) =>
        premier<{ lance_le: string }>(
          `dernière publication ${r}`,
          sb.from('publications_sociales').select('lance_le').eq('reseau', r).eq('statut', 'publie').order('lance_le', { ascending: false }).limit(1),
          'lance_le',
        ),
      ),
    ),
    premier<{ lance_le: string }>(
      'dernière campagne complète',
      sb.from('article_campagnes').select('lance_le').eq('statut', 'envoye').order('lance_le', { ascending: false }).limit(1),
      'lance_le',
    ),
    premier<{ created_at: string }>(
      'dernière relance remise',
      sb
        .from('crm_actions')
        .select('created_at')
        .eq('type', 'relance')
        .eq('canal', 'email')
        .eq('livraison', 'remis')
        .order('created_at', { ascending: false })
        .limit(1),
      'created_at',
    ),
  ]);

  const derniersSucces: Record<string, string | null> = {
    'envois:contact': succesContact,
    'envois:campagnes': succesCampagne,
    'envois:relances-crm': succesRelance,
  };
  canaux.forEach((c, i) => {
    derniersSucces[`envois:alertes:${c}`] = succesAlertes[i];
    derniersSucces[`envois:dossiers:${c}`] = succesDossiers[i];
  });
  reseaux.forEach((r, i) => {
    derniersSucces[`envois:reseaux:${r}`] = succesReseaux[i];
  });

  return {
    notifications,
    declenchements,
    abonnesAlertes,
    dossiers,
    abonnesDossiers,
    contact,
    social,
    campagnes,
    relances,
    derniersSucces,
  };
}
