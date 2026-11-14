/**
 * Worker d'évaluation des alertes (cf. §5.5 / §6.8).
 *  - charge les alertes actives (table alerts) ;
 *  - récupère le dernier cours + variation par code ;
 *  - déclenche celles qui satisfont leur condition ;
 *  - notifie (email/telegram/console), journalise dans notifications_log,
 *    et marque alerts.declenchee_le pour éviter le spam.
 *
 * Planifiable via cron (voir docs/DEPLOYMENT.md).
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { isTriggered, isSmartTriggered, isSmartType, type AlertType, type SmartContext } from './evaluate.js';
import { dispatch, sendWhatsAppTemplate, sendWhatsAppRaw, type SendResult } from './channels.js';
import { envoyerTexteWaha, pauseEntreEnvois, wahaConfiguree } from '../whatsapp/passerelle.js';
import { chatsParUtilisateur } from '../whatsapp/liaisons.js';
import { cleMois, messageSaison, saisonADeclencher, type LigneMessage } from './saison.js';

export interface AlertRow {
  id: string;
  user_id: string;
  code: string;
  type: AlertType;
  seuil: number | null;
  actif: boolean;
  declenchee_le: string | null;
  dernier_etat_notifie?: string | null;
  dernier_mois_notifie?: string | null;
}

export interface AlertsRunResult {
  status: 'success' | 'failed' | 'mock';
  evaluated: number;
  triggered: number;
  message: string | null;
}

export async function runAlerts(opts: { mock?: boolean } = {}): Promise<AlertsRunResult> {
  const cfg = getConfig();
  if (opts.mock || cfg.USE_MOCK) {
    // Démonstration : une alerte fictive déclenchée.
    // operateur: true — en mock aucun utilisateur n'est concerné, le message
    // est une démonstration destinée à l'administrateur. DRY_RUN l'empêche
    // aussi de partir : à blanc, rien ne s'envoie, démonstration comprise.
    if (cfg.DRY_RUN) {
      logger.info('DRY_RUN — notification de démonstration composée, non envoyée');
      return { status: 'mock', evaluated: 1, triggered: 1, message: null };
    }
    await dispatch({
      subject: 'Alerte BRVM (mock)',
      body: 'SNTS a franchi 15 000 FCFA.',
      code: 'SNTS',
      to: null,
      operateur: true,
    });
    logger.warn('Mode MOCK alertes : notification de démonstration envoyée');
    return { status: 'mock', evaluated: 1, triggered: 1, message: null };
  }

  try {
    const sb = getSupabase();
    const { data: alerts, error } = await sb
      .from('alerts').select('*').eq('actif', true);
    if (error) throw new Error(error.message);
    let rows = (alerts ?? []) as AlertRow[];
    /* Alertes réservées au Premium (feature_flags.alertes, même réglage que le
       site, décision du 2026-11-13). Une alerte d'un compte non autorisé reste
       en base, intacte : elle repart si le compte passe Premium. Drapeau
       illisible = Premium, jamais une ouverture par défaut ; « disabled » coupe tout. */
    const { data: drapeau } = await sb.from('feature_flags').select('acces').eq('code', 'alertes').maybeSingle();
    const accesAlertes = (drapeau as { acces: string } | null)?.acces ?? 'premium';
    if (accesAlertes === 'disabled') rows = [];
    else if (accesAlertes !== 'free' && rows.length > 0) {
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const { data: pr, error: ePr } = await sb.from('profiles').select('id, is_premium').in('id', ids);
      if (ePr) throw new Error(`profiles : ${ePr.message}`);
      const autorises = new Set(((pr ?? []) as { id: string; is_premium: boolean | null }[]).filter((p) => p.is_premium).map((p) => p.id));
      const avant = rows.length;
      rows = rows.filter((r) => autorises.has(r.user_id));
      if (rows.length !== avant) logger.info({ ignorees: avant - rows.length }, 'alertes de comptes non Premium ignorées');
    }
    if (rows.length === 0) return { status: 'success', evaluated: 0, triggered: 0, message: null };

    // Derniers cours/variation par code.
    const codes = [...new Set(rows.map((r) => r.code))];
    const { data: lastDateRow } = await sb
      .from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1);
    const lastDate = lastDateRow?.[0]?.date_marche;
    const priceByCode: Record<string, { cours: number | null; variation: number | null }> = {};
    if (lastDate) {
      const { data: quotes } = await sb
        .from('brvm_actions_daily').select('code, cours_jour, variation_pct').eq('date_marche', lastDate).in('code', codes);
      for (const q of (quotes ?? []) as { code: string; cours_jour: number | null; variation_pct: number | null }[]) {
        priceByCode[q.code] = { cours: q.cours_jour, variation: q.variation_pct };
      }
    }

    // Contexte « intelligent » par code : signal du jour + RSI + jours avant détachement.
    const smartByCode: Record<string, SmartContext> = {};
    const hasSmart = rows.some((r) => isSmartType(r.type));
    if (hasSmart) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: sigs } = await sb
        .from('signals_daily').select('code, signal, inputs, date_marche')
        .in('code', codes).order('date_marche', { ascending: false });
      for (const s of (sigs ?? []) as { code: string; signal: SmartContext['signal']; inputs: { rsi?: number } | null }[]) {
        if (smartByCode[s.code]) continue; // garde le plus récent
        smartByCode[s.code] = { signal: s.signal, rsi: typeof s.inputs?.rsi === 'number' ? s.inputs.rsi : null, daysToExDividend: null };
      }
      const { data: divs } = await sb
        .from('dividends').select('code, ex_date').in('code', codes).not('ex_date', 'is', null).gte('ex_date', today).order('ex_date', { ascending: true });
      for (const d of (divs ?? []) as { code: string; ex_date: string }[]) {
        const days = Math.round((Date.parse(d.ex_date) - Date.parse(today)) / 86_400_000);
        if (!smartByCode[d.code]) smartByCode[d.code] = { signal: null, rsi: null, daysToExDividend: days };
        else if (smartByCode[d.code]!.daysToExDividend == null) smartByCode[d.code]!.daysToExDividend = days;
      }
    }

    // Prefs WhatsApp par propriétaire d'alerte (opt-in RGPD) — une lecture par run.
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const waByUser = new Map<string, string>(); // user_id -> téléphone E.164
    // Telegram : conversation PERSONNELLE du propriétaire de l'alerte. Sans
    // cette table de correspondance, channels.ts n'a aucun destinataire et
    // n'envoie rien — c'est délibéré, le repli vers la conversation de
    // l'exploitant ayant été le défaut corrigé par la migration 0129.
    const tgByUser = new Map<string, number>(); // user_id -> chat_id Telegram
    // WhatsApp par la passerelle (lot E) : identifiant PROUVÉ par appairage, et
    // réservé aux comptes Premium (grille validée le 2026-10-23).
    // Chaque WhatsApp lié au compte (0165, au plus 2) reçoit l'alerte.
    const waChatByUser = new Map<string, string[]>();
    const eligiblesWa: string[] = [];
    // E-mail : comptes qui ont coché « alertes par e-mail » (alerts_email). Avant
    // le 2026-11-03, dispatch recevait `to: null` et AUCUNE alerte de cours
    // n'est jamais partie par e-mail, alors que /parametres/alertes l'annonçait.
    const emailOptin = new Set<string>();
    const passerelle = wahaConfiguree();
    if (userIds.length > 0) {
      const [{ data: prefs }, { data: profils }] = await Promise.all([
        sb
          .from('notification_prefs')
          .select(
            'user_id, whatsapp_phone, whatsapp_chat_id, whatsapp_optin, alerts_whatsapp, telegram_chat_id, telegram_optin, alerts_telegram, alerts_email',
          )
          .in('user_id', userIds),
        sb.from('profiles').select('id, is_premium').in('id', userIds),
      ]);
      const premium = new Set(
        ((profils ?? []) as { id: string; is_premium: boolean | null }[]).filter((p) => p.is_premium).map((p) => p.id),
      );
      type PrefRow = {
        user_id: string;
        whatsapp_phone: string | null;
        whatsapp_chat_id: string | null;
        whatsapp_optin: boolean | null;
        alerts_whatsapp: boolean | null;
        telegram_chat_id: number | null;
        telegram_optin: boolean | null;
        alerts_telegram: boolean | null;
        alerts_email: boolean | null;
      };
      for (const p of (prefs ?? []) as PrefRow[]) {
        // Les deux opt-in sont désormais filtrés ICI et non dans la requête :
        // un `.eq()` par canal exclurait les lignes de l'autre canal.
        if (p.whatsapp_optin && p.alerts_whatsapp) {
          if (passerelle) {
            if (premium.has(p.user_id)) eligiblesWa.push(p.user_id);
          } else {
            // Ancien chemin Meta (numéro déclaré), seulement sans passerelle :
            // les deux à la fois enverraient l'alerte en double.
            const phone = p.whatsapp_phone?.trim();
            if (phone && /^\+\d{8,15}$/.test(phone)) waByUser.set(p.user_id, phone);
          }
        }
        if (p.telegram_optin && p.alerts_telegram && p.telegram_chat_id != null) {
          tgByUser.set(p.user_id, p.telegram_chat_id);
        }
        if (p.alerts_email) emailOptin.add(p.user_id);
      }
      for (const [u, chats] of await chatsParUtilisateur(sb, eligiblesWa)) waChatByUser.set(u, chats);
    }

    // Une lecture d'adresse par compte et par passage (un compte peut avoir
    // plusieurs alertes déclenchées le même jour).
    const adresses = new Map<string, { email: string | null; erreur: string }>();
    const adresseDe = async (userId: string) => {
      const connue = adresses.get(userId);
      if (connue) return connue;
      let r: { email: string | null; erreur: string };
      try {
        const { data, error } = await sb.auth.admin.getUserById(userId);
        r = error
          ? { email: null, erreur: `adresse illisible : ${error.message}` }
          : { email: data?.user?.email ?? null, erreur: 'compte sans adresse e-mail' };
      } catch (err) {
        r = { email: null, erreur: `adresse illisible : ${err instanceof Error ? err.message : String(err)}` };
      }
      adresses.set(userId, r);
      return r;
    };

    /**
     * Envoi au PROPRIÉTAIRE sur ses canaux consentis (e-mail, Telegram, WhatsApp).
     * Extrait tel quel de la boucle des alertes (lot 4 saisonnalité) pour que
     * le message groupé saisonnier passe par le même chemin, sans copie.
     */
    const envoyerA = async (userId: string, subject: string, body: string, code: string): Promise<SendResult[]> => {
      // Adresse du PROPRIÉTAIRE, lue au compte (même chemin que les thèses) et
      // seulement s'il a consenti. Introuvable → échec JOURNALISÉ, jamais un
      // silence : c'est le silence qui avait caché la panne.
      let to: string | null = null;
      let echecAdresse: SendResult | null = null;
      if (emailOptin.has(userId)) {
        const r = await adresseDe(userId);
        if (r.email) to = r.email;
        else echecAdresse = { channel: 'email', status: 'failed', error: r.erreur };
      }
      const results = await dispatch({
        subject,
        body,
        code: code,
        to,
        // Destinataire Telegram du PROPRIÉTAIRE de l'alerte. Absent = aucun
        // envoi Telegram — voir sendTelegram dans channels.ts.
        telegramChatId: tgByUser.get(userId) ?? null,
      });
      if (echecAdresse) results.push(echecAdresse);

      // Canal WhatsApp PERSONNEL du propriétaire (opt-in) — en plus des canaux
      // globaux. Template Meta d'abord (hors fenêtre 24 h), repli texte.
      for (const chatWa of waChatByUser.get(userId) ?? []) {
        await pauseEntreEnvois();
        const r = await envoyerTexteWaha(
          chatWa,
          [`🔔 *${subject}*`, '', body, '', '_Information de marché, pas un conseil en investissement._'].join('\n'),
        );
        results.push({ channel: 'whatsapp', status: r.ok ? 'sent' : 'failed', ...(r.erreur ? { error: r.erreur } : {}) });
      }
      const phone = waByUser.get(userId);
      if (phone) {
        let wa = await sendWhatsAppTemplate(phone, 'alerte_titre', [code, body]);
        if (wa?.status !== 'sent') wa = (await sendWhatsAppRaw(phone, `${subject}\n${body}`)) ?? wa;
        if (wa) results.push(wa);
      }
      return results;
    };

    let triggered = 0;
    for (const a of rows) {
      // Alerte saisonnière : traitée après la boucle, en un message groupé par compte.
      if (a.type === 'saison_hors_fourchette') continue;
      const px = priceByCode[a.code] ?? { cours: null, variation: null };
      const smart = smartByCode[a.code] ?? { signal: null, rsi: null, daysToExDividend: null };
      const fires = isSmartType(a.type)
        ? isSmartTriggered({ type: a.type, seuil: a.seuil }, smart)
        : isTriggered({ type: a.type, seuil: a.seuil }, px.cours, px.variation);
      if (!fires) continue;
      // Anti-spam : ne pas re-notifier si déjà déclenchée aujourd'hui.
      if (a.declenchee_le && a.declenchee_le.slice(0, 10) === (lastDate ?? '')) continue;

      triggered++;
      const subject = `Alerte ${a.code}`;
      const body = describeAlert(a, px, smart);
      /* DRY_RUN doit couvrir l'ENVOI, pas seulement les écritures en base
         (même règle que runCloture). Avant ce garde, un passage à blanc
         envoyait réellement emails, Telegram et WhatsApp aux propriétaires. */
      if (cfg.DRY_RUN) {
        logger.info({ code: a.code, type: a.type, body }, 'DRY_RUN — alerte composée, non envoyée');
        continue;
      }
      const results = await envoyerA(a.user_id, subject, body, a.code);

      if (!cfg.DRY_RUN) {
        await sb.from('alerts').update({ declenchee_le: new Date().toISOString() }).eq('id', a.id);
        for (const r of results) {
          await sb.from('notifications_log').insert({
            user_id: a.user_id, alert_id: a.id, code: a.code,
            channel: r.channel, message: body, status: r.status,
          });
        }
      }
    }

    // ── Alertes saisonnières (lot 4) : un message groupé par compte ──
    const saisonnieres = rows.filter((r) => r.type === 'saison_hors_fourchette');
    if (saisonnieres.length > 0 && lastDate) {
      const { data: etatsLus, error: eEt } = await sb
        .from('saisonnalite_etat')
        .select('code, date_seance, annee, mois, rang, rdt_en_cours, q10, q90, n, etat_large, verdict')
        .in('code', [...new Set(saisonnieres.map((r) => r.code))]);
      type EtatLu = { code: string; date_seance: string; annee: number; mois: number; rang: number; rdt_en_cours: number; q10: number | null; q90: number | null; n: number; etat_large: string; verdict: string };
      const etats = new Map(((etatsLus ?? []) as EtatLu[]).map((e) => [e.code, e]));
      const perimes = [...etats.values()].filter((e) => e.date_seance !== lastDate).length;
      if (eEt || perimes > 0 || etats.size === 0) {
        // Bruyant, jamais silencieux : l'état saisonnier n'est pas celui de la dernière séance.
        logger.error({ erreur: eEt?.message ?? null, perimes, lus: etats.size, derniereSeance: lastDate }, 'état saisonnier illisible ou périmé : alertes saisonnières non évaluées');
      } else {
        const parCompte = new Map<string, { alerte: AlertRow; etat: EtatLu }[]>();
        for (const a of saisonnieres) {
          const etat = etats.get(a.code);
          const d = saisonADeclencher(
            { dernier_etat_notifie: a.dernier_etat_notifie ?? null, dernier_mois_notifie: a.dernier_mois_notifie ?? null },
            etat, lastDate,
          );
          if (!d.declenche || !etat) continue;
          if (!parCompte.has(a.user_id)) parCompte.set(a.user_id, []);
          parCompte.get(a.user_id)!.push({ alerte: a, etat });
        }
        for (const [userId, lignes] of parCompte) {
          const msg = messageSaison(lignes.map(({ etat }) => ({
            code: etat.code, etat_large: etat.etat_large, rdt_en_cours: Number(etat.rdt_en_cours),
            q10: etat.q10 == null ? null : Number(etat.q10), q90: etat.q90 == null ? null : Number(etat.q90),
            n: etat.n, mois: etat.mois, rang: etat.rang,
          }) satisfies LigneMessage));
          triggered += lignes.length;
          if (cfg.DRY_RUN) {
            logger.info({ userId, valeurs: lignes.map((l) => l.etat.code), body: msg.body }, 'DRY_RUN — alerte saisonnière composée, non envoyée');
            continue;
          }
          const results = await envoyerA(userId, msg.subject, msg.body, lignes[0]!.etat.code);
          // Mémoire écrite seulement si un canal a réellement accepté l'envoi :
          // sinon la prochaine exécution retentera.
          // La console n'est pas un envoi : dispatch y retombe quand aucun canal ne part.
          const parti = results.some((r) => r.status === 'sent' && r.channel !== 'console');
          for (const { alerte, etat } of lignes) {
            if (parti) {
              await sb.from('alerts').update({
                declenchee_le: new Date().toISOString(),
                dernier_etat_notifie: etat.etat_large,
                dernier_mois_notifie: cleMois(etat.annee, etat.mois),
              }).eq('id', alerte.id);
            }
            for (const r of results) {
              await sb.from('notifications_log').insert({
                user_id: userId, alert_id: alerte.id, code: etat.code, channel: r.channel, message: msg.body, status: r.status,
              });
            }
          }
          if (!parti) logger.error({ userId, valeurs: lignes.map((l) => l.etat.code) }, 'alerte saisonnière : aucun canal n’a accepté l’envoi');
        }
      }
    }

    logger.info({ evaluated: rows.length, triggered }, 'Évaluation des alertes terminée');
    return { status: 'success', evaluated: rows.length, triggered, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Évaluation des alertes échouée');
    return { status: 'failed', evaluated: 0, triggered: 0, message };
  }
}

export function describeAlert(
  a: AlertRow,
  px: { cours: number | null; variation: number | null },
  smart: SmartContext,
): string {
  // Chiffres au format français ; une valeur absente est dite absente, pas « ? ».
  // Aucune lecture du RSI au-delà de sa zone : « rebond possible » ou
  // « prudence » étaient des pronostics, que la donnée ne fonde pas.
  const fr = (n: number | string | null | undefined, d = 0): string => {
    const v = n == null ? null : Number(n);
    return v == null || !Number.isFinite(v) ? 'non disponible' : v.toLocaleString('fr-FR', { maximumFractionDigits: d });
  };
  const jours = smart.daysToExDividend;
  switch (a.type) {
    case 'prix_au_dessus': return `${a.code} a atteint ou dépassé ${fr(a.seuil)} FCFA (cours : ${fr(px.cours)} FCFA).`;
    case 'prix_en_dessous': return `${a.code} est repassé sous ${fr(a.seuil)} FCFA (cours : ${fr(px.cours)} FCFA).`;
    case 'variation': return `${a.code} a varié de ${fr(px.variation, 2)} % sur la séance (seuil : ${fr(a.seuil, 2)} %).`;
    case 'signal_achat': return `${a.code} : le signal technique passe à « achat ».`;
    case 'signal_vente': return `${a.code} : le signal technique passe à « vente ».`;
    case 'rsi_survente': return `${a.code} : RSI à ${fr(smart.rsi)}, en zone dite de survente.`;
    case 'rsi_surachat': return `${a.code} : RSI à ${fr(smart.rsi)}, en zone dite de surachat.`;
    case 'dividende_proche': return jours == null
      ? `${a.code} : détachement de dividende prochain (date non disponible).`
      : `${a.code} : détachement de dividende dans ${jours} jour${jours > 1 ? 's' : ''}.`;
    default: return `${a.code} : alerte déclenchée.`;
  }
}
