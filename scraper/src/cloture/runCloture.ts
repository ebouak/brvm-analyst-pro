/**
 * Worker « cloture » — point de clôture Telegram.
 *
 * Voir docs/superpowers/specs/2026-09-08-cloture-telegram-design.md.
 *
 * Passe APRÈS alerts.yml : le message annonce combien d'alertes se sont
 * déclenchées, il ne peut donc pas les précéder.
 *
 * Idempotent : notifications_log fait foi, comme pour le brief WhatsApp.
 */
import { getSupabase } from '../persistence/supabase.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import {
  composerCloture,
  type AlerteDeclenchee,
  type LignePortefeuille,
  type LigneWatchlist,
  type MarcheJour,
} from './composer.js';

const BRIEF_URL = 'https://www.westbourse.com/brief';

export interface ClotureRunResult {
  status: 'success' | 'failed' | 'mock' | 'non-publiable';
  dateMarche: string | null;
  recipients: number;
  sent: number;
  message: string | null;
}

/** Marqueur d'idempotence journalisé dans notifications_log.message. */
export function clotureMarker(dateMarche: string): string {
  return `Cloture ${dateMarche} (Telegram)`;
}

interface EnvoiResultat {
  ok: boolean;
  /** Vrai si Telegram signale que l'utilisateur a bloqué le bot. */
  bloque: boolean;
  description?: string;
}

/**
 * Envoi Telegram brut. Ne lève jamais ; distingue le blocage par l'utilisateur
 * des autres erreurs, car les deux appellent des réactions opposées : cesser
 * définitivement, ou réessayer demain.
 */
async function envoyer(
  methode: 'sendMessage' | 'sendVideo',
  corps: Record<string, unknown>,
): Promise<EnvoiResultat> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, bloque: false, description: 'TELEGRAM_BOT_TOKEN absent' };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${methode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const rep = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (rep.ok) return { ok: true, bloque: false };
    const d = rep.description ?? `HTTP ${r.status}`;
    /* « Forbidden: bot was blocked by the user », « user is deactivated » :
       le consentement n'existe plus de fait. Réessayer chaque soir serait
       relancer une conversation que personne ne lira jamais. */
    const bloque = r.status === 403 || /blocked|deactivated|chat not found/i.test(d);
    return { ok: false, bloque, description: d };
  } catch (err) {
    return {
      ok: false,
      bloque: false,
      description: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runCloture(
  opts: { mock?: boolean; date?: string } = {},
): Promise<ClotureRunResult> {
  const cfg = getConfig();
  if (opts.mock || cfg.USE_MOCK) {
    logger.warn('Mode MOCK cloture — aucun envoi');
    return { status: 'mock', dateMarche: null, recipients: 0, sent: 0, message: null };
  }

  try {
    const sb = getSupabase();

    /* 1. La séance visée.
       Par défaut la dernière connue — mais une date explicite est nécessaire
       pour rejouer une séance précise, et pour éviter un piège réel : la
       séance du JOUR existe dès la première collecte intraday, bien avant la
       consolidation de 16:00. La prendre trop tôt donnerait un point de
       clôture aux capitaux estimés, et surtout désaccordé de la vidéo, qui
       porte elle une date figée dans seance.json. */
    let dateMarche: string | null = opts.date ?? null;
    if (!dateMarche) {
      const { data: derniere } = await sb
        .from('brvm_actions_daily')
        .select('date_marche')
        .order('date_marche', { ascending: false })
        .limit(1)
        .maybeSingle();
      dateMarche = (derniere?.date_marche as string | undefined) ?? null;
    }
    if (!dateMarche) {
      return {
        status: 'non-publiable',
        dateMarche: null,
        recipients: 0,
        sent: 0,
        message: 'aucune séance',
      };
    }

    const [{ data: actions }, { data: indices }, { data: brief }] = await Promise.all([
      sb
        .from('brvm_actions_daily')
        .select('code, cours_jour, variation_pct, volume, valeur_echangee')
        .eq('date_marche', dateMarche),
      sb
        .from('brvm_indices_daily')
        .select('code, valeur, variation_pct')
        .eq('date_marche', dateMarche),
      sb
        .from('brief_daily')
        .select('date_marche, contenu')
        .eq('date_marche', dateMarche)
        .maybeSingle(),
    ]);

    const cotes = (actions ?? []).filter((a) => a.variation_pct != null);
    const capitaux = (a: {
      valeur_echangee: number | null;
      cours_jour: number | null;
      volume: number | null;
    }) => a.valeur_echangee ?? (a.cours_jour != null && a.volume != null ? a.cours_jour * a.volume : 0);
    const capitauxTotal = cotes.reduce((s, a) => s + capitaux(a), 0);
    const composite = (indices ?? []).find((i) => i.code === 'BRVMC');
    const hausses = cotes.filter((a) => (a.variation_pct as number) > 0).length;
    const baisses = cotes.filter((a) => (a.variation_pct as number) < 0).length;

    /* Mêmes contrôles que la vidéo (video/genere.mjs) : un cron publie sans
       relecture humaine, mieux vaut un soir de silence qu'un message faux. */
    const ageJours = Math.floor((Date.now() - Date.parse(`${dateMarche}T12:00:00Z`)) / 86_400_000);
    const controles = {
      seance_recente: ageJours <= 5,
      assez_de_valeurs: cotes.length >= 20,
      composite_present: !!composite,
      capitaux_non_nuls: capitauxTotal > 0,
      variations_non_plates: hausses + baisses > 0,
    };
    const manquants = Object.entries(controles)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (manquants.length > 0) {
      logger.warn({ dateMarche, manquants }, 'Clôture non publiable — aucun envoi');
      return {
        status: 'non-publiable',
        dateMarche,
        recipients: 0,
        sent: 0,
        message: manquants.join(', '),
      };
    }

    const marche: MarcheJour = {
      dateFr: new Date(`${dateMarche}T12:00:00Z`).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      compositeVariationPct: (composite?.variation_pct as number | null) ?? null,
      compositeValeur: (composite?.valeur as number | null) ?? null,
      hausses,
      baisses,
      stables: cotes.length - hausses - baisses,
      capitauxFcfa: capitauxTotal,
      capitauxEstimes: (actions ?? []).every((a) => a.valeur_echangee == null),
    };

    const variationParCode = new Map(cotes.map((a) => [a.code as string, a.variation_pct as number]));
    const coursParCode = new Map(
      (actions ?? []).map((a) => [a.code as string, a.cours_jour as number | null]),
    );

    /* Le brief est ANNONCÉ, pas cité. Son texte reprend tendance, hausses,
       baisses et BRVM-C — soit exactement ce que le message affiche déjà en
       en-tête. Le citer disait deux fois la même chose, et un extrait tronqué
       coupait en plein mot. Ce qu'il apporte en propre (actualités, volumes en
       titres) se lit mieux sur sa page. */
    const briefTexte = (brief?.contenu as string | undefined)?.trim() ? 'oui' : null;

    /* Plus forts mouvements, depuis la MEME lecture que le reste : aucune
       requete de plus, et aucun risque de desaccord avec les chiffres du haut
       du message. */
    const parVariation = [...cotes].sort(
      (a, b) => (b.variation_pct as number) - (a.variation_pct as number),
    );
    const mouvements = {
      hausses: parVariation
        .filter((a) => (a.variation_pct as number) > 0)
        .slice(0, 3)
        .map((a) => ({ code: a.code as string, variationPct: a.variation_pct as number })),
      baisses: parVariation
        .filter((a) => (a.variation_pct as number) < 0)
        .slice(-3)
        .reverse()
        .map((a) => ({ code: a.code as string, variationPct: a.variation_pct as number })),
    };

    // 2. Destinataires consentants.
    const { data: prefs } = await sb
      .from('notification_prefs')
      .select('user_id, telegram_chat_id')
      .eq('telegram_optin', true)
      .eq('brief_telegram', true)
      .not('telegram_chat_id', 'is', null);

    const destinataires = ((prefs ?? []) as { user_id: string; telegram_chat_id: number }[]).filter(
      (p) => p.telegram_chat_id != null,
    );
    if (destinataires.length === 0) {
      return { status: 'success', dateMarche, recipients: 0, sent: 0, message: null };
    }
    const userIds = destinataires.map((d) => d.user_id);

    // 3. Idempotence, niveau de plan et données personnelles, en parallèle.
    const marker = clotureMarker(dateMarche);
    const [
      { data: logs },
      { data: profils },
      { data: alertes },
      { data: positions },
      { data: watch },
    ] = await Promise.all([
      sb
        .from('notifications_log')
        .select('user_id')
        .eq('channel', 'telegram')
        .eq('message', marker)
        .in('user_id', userIds),
      sb.from('profiles').select('id, is_premium').in('id', userIds),
      sb
        .from('alerts')
        .select('user_id, code, type, seuil, declenchee_le')
        .in('user_id', userIds)
        .gte('declenchee_le', `${dateMarche}T00:00:00Z`),
      sb
        .from('portfolios_positions')
        .select('user_id, code, quantite, prix_entree')
        .in('user_id', userIds),
      sb
        .from('watchlist_items')
        .select('code, watchlists!inner(user_id)')
        .in('watchlists.user_id', userIds),
    ]);

    const dejaEnvoye = new Set(((logs ?? []) as { user_id: string }[]).map((l) => l.user_id));
    const premiumParUser = new Map(
      ((profils ?? []) as { id: string; is_premium: boolean | null }[]).map((p) => [
        p.id,
        Boolean(p.is_premium),
      ]),
    );

    const parUser = <T extends { user_id: string }>(rows: T[] | null): Map<string, T[]> => {
      const m = new Map<string, T[]>();
      for (const r of rows ?? []) {
        if (!m.has(r.user_id)) m.set(r.user_id, []);
        m.get(r.user_id)!.push(r);
      }
      return m;
    };
    const alertesParUser = parUser(
      alertes as { user_id: string; code: string; type: string; seuil: number }[] | null,
    );
    const positionsParUser = parUser(
      positions as
        | { user_id: string; code: string; quantite: number; prix_entree: number }[]
        | null,
    );
    const watchParUser = new Map<string, string[]>();
    for (const w of (watch ?? []) as unknown as { code: string; watchlists: { user_id: string } }[]) {
      const uid = w.watchlists?.user_id;
      if (!uid) continue;
      if (!watchParUser.has(uid)) watchParUser.set(uid, []);
      watchParUser.get(uid)!.push(w.code);
    }

    /* Identifiant de la vidéo déjà téléversée vers le canal public : un seul
       téléversement, N envois. Sans cela, adresser 1 Mo à chaque utilisateur
       serait autant de téléversements. */
    const videoFileId = process.env.TELEGRAM_VIDEO_FILE_ID || null;

    // 4. Composition et envoi, un utilisateur à la fois.
    let sent = 0;
    for (const d of destinataires) {
      if (dejaEnvoye.has(d.user_id)) continue;

      const premium = premiumParUser.get(d.user_id) ?? false;
      const mesAlertes: AlerteDeclenchee[] = (alertesParUser.get(d.user_id) ?? []).map((a) => ({
        code: a.code,
        texte: `${a.code} : ${a.type} (seuil ${a.seuil})`,
      }));
      const monPortefeuille: LignePortefeuille[] = (positionsParUser.get(d.user_id) ?? []).map(
        (p) => ({
          code: p.code,
          quantite: Number(p.quantite),
          prixRevient: Number(p.prix_entree),
          coursActuel: coursParCode.get(p.code) ?? null,
        }),
      );
      const maWatchlist: LigneWatchlist[] = [...new Set(watchParUser.get(d.user_id) ?? [])].map(
        (code) => ({ code, variationPct: variationParCode.get(code) ?? null }),
      );

      const texte = composerCloture({
        marche,
        mouvements,
        premium,
        alertes: mesAlertes,
        portefeuille: monPortefeuille,
        watchlist: maWatchlist,
        brief: briefTexte,
        briefUrl: BRIEF_URL,
      });

      /* DRY_RUN doit couvrir l'ENVOI, pas seulement les écritures en base.
         Un essai à sec qui expédie de vrais messages à de vrais utilisateurs
         n'est pas un essai à sec — défaut constaté au premier lancement. */
      if (cfg.DRY_RUN) {
        logger.info(
          { userId: d.user_id, premium, longueur: texte.length },
          `DRY_RUN — message composé, non envoyé :\n${texte}`,
        );
        sent++;
        continue;
      }

      const res = await envoyer('sendMessage', {
        chat_id: d.telegram_chat_id,
        text: texte,
        disable_web_page_preview: true,
      });

      if (res.bloque) {
        /* Le consentement n'existe plus de fait : on efface l'identifiant
           plutôt que de relancer chaque soir une conversation fermée. */
        if (!cfg.DRY_RUN) {
          await sb
            .from('notification_prefs')
            .update({ telegram_chat_id: null, telegram_optin: false })
            .eq('user_id', d.user_id);
        }
        logger.info({ userId: d.user_id }, 'Telegram bloqué par l’utilisateur — liaison effacée');
        continue;
      }
      if (!res.ok) {
        logger.warn({ userId: d.user_id, err: res.description }, 'Envoi clôture échoué');
        continue; // un utilisateur ne prive pas les autres de leur rendez-vous
      }
      sent++;

      /* La vidéo suit le message, jamais l'inverse : si elle échoue, le point
         de clôture est déjà parti. */
      if (videoFileId) {
        await envoyer('sendVideo', { chat_id: d.telegram_chat_id, video: videoFileId });
      }

      if (!cfg.DRY_RUN) {
        await sb.from('notifications_log').insert({
          user_id: d.user_id,
          alert_id: null,
          code: null,
          channel: 'telegram',
          message: marker,
          status: 'sent',
        });
      }
    }

    logger.info(
      {
        dateMarche,
        recipients: destinataires.length,
        sent,
        deja: dejaEnvoye.size,
        video: !!videoFileId,
      },
      'cloture terminée',
    );
    return { status: 'success', dateMarche, recipients: destinataires.length, sent, message: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, 'Clôture échouée');
    return { status: 'failed', dateMarche: null, recipients: 0, sent: 0, message };
  }
}
