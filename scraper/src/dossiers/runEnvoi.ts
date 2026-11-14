/**
 * Envoi hebdomadaire des dossiers valeur — orchestration des entrées/sorties.
 *
 * Toute la logique de DÉCISION est ailleurs, dans deux modules purs et testés :
 * `selection.ts` (qui reçoit quoi, dans quel ordre, combien) et `message.ts`
 * (ce qui est écrit). Ici : lire, télécharger, envoyer, journaliser.
 *
 * IDEMPOTENCE — la propriété qui compte. Une ligne `dossier_envois`
 * (user_id, semaine, canal) est écrite en `en_cours` AVANT l'envoi, puis
 * passée à `envoye` ou `echec`. Un couple déjà `envoye` cette semaine est
 * sauté. Relancer le workflow à la main — ce qui arrive — ne renvoie donc
 * rien à personne.
 *
 * FRAÎCHEUR — `selection.ts` écarte tout PDF de plus de trois jours et le
 * NOMME dans le message. Un dossier périmé livré en silence serait pire
 * qu'un dossier absent.
 *
 * TOLÉRANCE — un compte en échec n'arrête pas le lot. Le résultat compte les
 * envoyés, les vides et les échecs ; l'appelant sort en code 1 s'il en reste
 * au moins un, pour que le workflow le signale plutôt que de réussir en
 * silence.
 *
 * `--mock` : n'envoie rien, n'écrit rien, journalise ce qui serait parti.
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { sendEmail, sendTelegramDocument, sendTelegramText } from '../alerts/channels.js';
import { envoyerDocumentWaha, envoyerTexteWaha, pauseEntreEnvois, wahaConfiguree } from '../whatsapp/passerelle.js';
import { chatsParUtilisateur } from '../whatsapp/liaisons.js';
import { cleSemaine, selectionnerLignes, type LigneCandidate, type Selection } from './selection.js';
import { FENETRE_REVUES_JOURS, revuesMisesAJour, type PublicationResultats } from './revues.js';
import { composerInvitation, composerMessage, composerRectificatif } from './message.js';

const BUCKET = 'dossiers';

export interface EnvoiResult {
  semaine: string;
  comptes: number;
  envoyes: number;
  vides: number;
  echecs: number;
  sautes: number;
  /** Comptes non Premium : e-mail d'invitation à la place des PDF. */
  invitations: number;
}

interface Pref {
  user_id: string;
  dossiers_email: boolean;
  dossiers_telegram: boolean;
  telegram_chat_id: number | null;
  dossiers_whatsapp: boolean;
  whatsapp_chat_id: string | null;
}

type Canal = 'email' | 'telegram' | 'whatsapp';
type Statut = 'en_cours' | 'envoye' | 'echec' | 'vide' | 'invitation';

/** Une invitation au Premium au plus par trimestre : le journal est purgé à 90 jours (0132). */

/**
 * `rectificatif` : renvoie la version CORRIGÉE des dossiers aux seuls comptes
 * dont l'envoi de la semaine est `envoye` et pas encore rectifié
 * (`rectifie_le` nul, migration 0150), avec un message qui dit ce qui était
 * faux. Il ne touche JAMAIS au statut de l'envoi d'origine ; il pose
 * `rectifie_le` après succès — un rectificatif ne part donc qu'une fois.
 */
export async function runEnvoi(opts: { mock?: boolean; rectificatif?: boolean } = {}): Promise<EnvoiResult> {
  const mock = Boolean(opts.mock);
  const rectificatif = Boolean(opts.rectificatif);
  const sb = getSupabase();
  const maintenant = new Date();
  const semaine = cleSemaine(maintenant);
  const res: EnvoiResult = { semaine, comptes: 0, envoyes: 0, vides: 0, echecs: 0, sautes: 0, invitations: 0 };

  // ── 1. Comptes ayant explicitement demandé l'envoi ──────────────────────
  const { data: prefsRows, error: errPrefs } = await sb
    .from('notification_prefs')
    .select('user_id, dossiers_email, dossiers_telegram, telegram_chat_id, dossiers_whatsapp, whatsapp_chat_id')
    .or('dossiers_email.eq.true,dossiers_telegram.eq.true,dossiers_whatsapp.eq.true');
  if (errPrefs) throw new Error(`notification_prefs : ${errPrefs.message}`);
  const prefs = (prefsRows ?? []) as Pref[];
  res.comptes = prefs.length;
  if (prefs.length === 0) {
    logger.info(res, 'envoi des dossiers : aucun compte abonné');
    return res;
  }

  // ── 2. Tout ce qui ne dépend que de la liste des comptes, en parallèle ──
  const userIds = prefs.map((p) => p.user_id);
  const [{ data: profils }, { data: positions }, { data: instruments }, { data: derniere }] = await Promise.all([
    sb.from('profiles').select('id, email, is_premium').in('id', userIds),
    sb.from('portfolios_positions').select('user_id, code, quantite').in('user_id', userIds),
    sb.from('brvm_instruments').select('code, designation'),
    sb.from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const emailPar = new Map(
    ((profils ?? []) as { id: string; email: string | null }[]).map((p) => [p.id, p.email]),
  );
  // WhatsApp : canal réservé aux comptes Premium (grille du 2026-10-23).
  const premiumPar = new Set(
    ((profils ?? []) as { id: string; is_premium: boolean | null }[]).filter((p) => p.is_premium).map((p) => p.id),
  );
  /* Les PDF suivent le MÊME drapeau que la page du dossier (`dossiers_valeur`,
     réglable dans /admin/features). Illisible = Premium : on n'ouvre pas un
     contenu payant sur une panne de lecture. `disabled` coupe tout, invitation comprise. */
  const { data: drapeau } = await sb.from('feature_flags').select('acces').eq('code', 'dossiers_valeur').maybeSingle();
  const acces = (drapeau as { acces: string } | null)?.acces ?? 'premium';
  if (acces === 'disabled') {
    logger.info(res, 'envoi des dossiers : fonctionnalité coupée (dossiers_valeur = disabled)');
    return res;
  }
  const autorise = (userId: string) => acces === 'free' || premiumPar.has(userId);
  const { data: invRows } = await sb.from('dossier_envois').select('user_id').eq('statut', 'invitation');
  const dejaInvites = new Set(((invRows ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const passerelle = wahaConfiguree();
  // Chaque WhatsApp lié au compte (0165, au plus 2) reçoit les dossiers.
  const waPar = passerelle
    ? await chatsParUtilisateur(sb, prefs.filter((p) => p.dossiers_whatsapp).map((p) => p.user_id))
    : new Map<string, string[]>();
  const nomPar = new Map(
    ((instruments ?? []) as { code: string; designation: string | null }[]).map((i) => [i.code, i.designation ?? i.code]),
  );

  /* Derniers cours : servent UNIQUEMENT à ordonner les pièces jointes par
     valorisation. Un cours manquant ne retire donc jamais un dossier, il le
     place en fin de liste (voir selection.ts). */
  const coursPar = new Map<string, number>();
  if (derniere?.date_marche) {
    const { data: cours } = await sb
      .from('brvm_actions_daily')
      .select('code, cours_jour')
      .eq('date_marche', derniere.date_marche as string);
    for (const c of (cours ?? []) as { code: string; cours_jour: number | null }[]) {
      if (c.cours_jour != null) coursPar.set(c.code, c.cours_jour);
    }
  }

  // ── 3. Fraîcheur des PDF, un listing par code réellement détenu ─────────
  const lignesPositions = (positions ?? []) as { user_id: string; code: string; quantite: number }[];
  const codesDetenus = [...new Set(lignesPositions.map((p) => p.code))];
  const majPar = new Map<string, string | null>();
  for (const code of codesDetenus) {
    try {
      const { data: objets } = await sb.storage.from(BUCKET).list(code, { search: 'dernier.pdf' });
      majPar.set(code, (objets ?? []).find((o) => o.name === 'dernier.pdf')?.updated_at ?? null);
    } catch {
      majPar.set(code, null); // illisible = traité comme absent, donc nommé dans le message
    }
  }

  // ── 4. Déjà envoyés cette semaine (idempotence) ─────────────────────────
  const { data: dejaRows } = await sb
    .from('dossier_envois')
    .select('user_id, canal')
    .eq('semaine', semaine)
    .eq('statut', 'envoye');
  const deja = new Set(
    ((dejaRows ?? []) as { user_id: string; canal: string }[]).map((r) => `${r.user_id}:${r.canal}`),
  );

  /* Rectificatif : seules cibles = envois de la semaine, réussis, non rectifiés. */
  let aRectifier = new Set<string>();
  if (rectificatif) {
    const { data: rows, error } = await sb
      .from('dossier_envois')
      .select('user_id, canal')
      .eq('semaine', semaine)
      .eq('statut', 'envoye')
      .is('rectifie_le', null);
    if (error) throw new Error(`dossier_envois (rectificatif) : ${error.message}`);
    aRectifier = new Set(((rows ?? []) as { user_id: string; canal: string }[]).map((r) => `${r.user_id}:${r.canal}`));
    logger.info({ semaine, cibles: aRectifier.size }, 'rectificatif : envois à corriger');
  }

  /* Publications de résultats ingérées depuis le précédent envoi (lecture seule).
     Lecture impossible = liste vide : le message part sans cette rubrique, comme
     avant, ce n'est pas une panne d'envoi. */
  const publicationsRecentes: PublicationResultats[] = [];
  try {
    const depuis = new Date(maintenant.getTime() - FENETRE_REVUES_JOURS * 86_400_000).toISOString();
    const { data: evts, error } = await sb
      .from('market_events')
      .select('id, event_date, instrument_code')
      .eq('event_type', 'resultats')
      .gte('created_at', depuis)
      .limit(1000);
    if (error) throw new Error(error.message);
    const evenements = (evts ?? []) as { id: string; event_date: string; instrument_code: string | null }[];
    for (const e of evenements) {
      if (e.instrument_code) publicationsRecentes.push({ code: e.instrument_code, date_evenement: e.event_date });
    }
    if (evenements.length > 0) {
      const { data: piv, error: errPiv } = await sb
        .from('market_event_instruments')
        .select('event_id, instrument_code')
        .in('event_id', evenements.map((e) => e.id));
      if (errPiv) throw new Error(errPiv.message);
      const dateDe = new Map(evenements.map((e) => [e.id, e.event_date]));
      for (const l of (piv ?? []) as { event_id: string; instrument_code: string }[]) {
        const d = dateDe.get(l.event_id);
        if (d) publicationsRecentes.push({ code: l.instrument_code, date_evenement: d });
      }
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'revues mises à jour : lecture impossible, rubrique omise');
    publicationsRecentes.length = 0;
  }

  // Un PDF n'est téléchargé qu'une fois, même s'il est détenu par dix comptes.
  const cache = new Map<string, Buffer>();
  const telecharger = async (code: string): Promise<Buffer> => {
    const connu = cache.get(code);
    if (connu) return connu;
    const { data, error } = await sb.storage.from(BUCKET).download(`${code}/dernier.pdf`);
    if (error || !data) throw new Error(`${code}/dernier.pdf : ${error?.message ?? 'contenu vide'}`);
    const buf = Buffer.from(await data.arrayBuffer());
    cache.set(code, buf);
    return buf;
  };

  const journal = async (user_id: string, canal: Canal, statut: Statut, codes: string[], erreur?: string) => {
    if (mock) return;
    const { error } = await sb
      .from('dossier_envois')
      .upsert({ user_id, semaine, canal, codes, statut, erreur: erreur ?? null }, { onConflict: 'user_id,semaine,canal' });
    if (error) logger.warn({ user_id, canal, err: error.message }, 'dossier_envois : journal non écrit');
  };

  // ── 5. Un compte, un canal à la fois ────────────────────────────────────
  for (const p of prefs) {
    const candidates: LigneCandidate[] = lignesPositions
      .filter((x) => x.user_id === p.user_id)
      .map((x) => ({
        code: x.code,
        designation: nomPar.get(x.code) ?? x.code,
        quantite: Number(x.quantite),
        cours: coursPar.get(x.code) ?? null,
        pdf_updated_at: majPar.get(x.code) ?? null,
      }));
    const sel: Selection = selectionnerLignes(candidates, maintenant);

    /* Non Premium : aucun PDF, sur aucun canal. Un seul e-mail d'invitation à
       la place (au plus un par trimestre), jamais pendant un rectificatif. */
    if (!autorise(p.user_id)) {
      const email = emailPar.get(p.user_id);
      if (rectificatif || !p.dossiers_email || !email || dejaInvites.has(p.user_id)) {
        res.sautes += 1;
        continue;
      }
      const inv = composerInvitation(candidates.map((c) => ({ code: c.code, designation: c.designation })));
      if (mock) {
        logger.info({ user_id: p.user_id, sujet: inv.sujet }, 'mock : invitation simulée');
        res.invitations += 1;
        continue;
      }
      try {
        const r = await sendEmail({ to: email, subject: inv.sujet, body: inv.corps });
        if (!r || r.status !== 'sent') throw new Error(r?.error ?? 'canal email non configuré');
        await journal(p.user_id, 'email', 'invitation', []);
        res.invitations += 1;
      } catch (err) {
        const e = err instanceof Error ? err.message : String(err);
        await journal(p.user_id, 'email', 'echec', [], `invitation : ${e}`);
        res.echecs += 1;
        logger.error({ user_id: p.user_id, err: e }, 'invitation Premium non envoyée');
      }
      continue;
    }

    /* Un canal demandé mais inutilisable (pas d'adresse, pas d'appairage) est
       ignoré en silence : ce n'est pas un échec d'envoi, c'est un canal non
       configuré. */
    const canaux: Canal[] = [];
    if (p.dossiers_email && emailPar.get(p.user_id)) canaux.push('email');
    if (p.dossiers_telegram && p.telegram_chat_id) canaux.push('telegram');
    if (p.dossiers_whatsapp && (waPar.get(p.user_id)?.length ?? 0) > 0 && premiumPar.has(p.user_id)) canaux.push('whatsapp');

    for (const canal of canaux) {
      if (rectificatif) {
        // Rectificatif : uniquement les envois fautifs de la semaine.
        if (!aRectifier.has(`${p.user_id}:${canal}`)) {
          res.sautes += 1;
          continue;
        }
      } else if (deja.has(`${p.user_id}:${canal}`)) {
        res.sautes += 1;
        continue;
      }

      // Portefeuille vide, ou aucun dossier frais : aucun message. Un envoi
      // vide est du bruit ; la trace reste en base pour l'expliquer.
      if (sel.retenues.length === 0) {
        if (!rectificatif) await journal(p.user_id, canal, 'vide', []);
        res.vides += 1;
        continue;
      }

      const msg = rectificatif ? composerRectificatif(sel, semaine, canal) : composerMessage(sel, semaine, canal, revuesMisesAJour(candidates, publicationsRecentes));
      const envoyees = canal === 'email' ? sel.pieces_jointes_email : sel.retenues;
      const codes = envoyees.map((l) => l.code);
      // Le rectificatif ne réécrit jamais le statut de l'envoi d'origine.
      if (!rectificatif) await journal(p.user_id, canal, 'en_cours', codes);

      if (mock) {
        logger.info({ user_id: p.user_id, canal, codes, sujet: msg.sujet }, 'mock : envoi simulé');
        res.envoyes += 1;
        continue;
      }

      try {
        if (canal === 'email') {
          const attachments = [];
          for (const l of envoyees) {
            attachments.push({ filename: `westbourse-dossier-${l.code}.pdf`, content: await telecharger(l.code) });
          }
          const r = await sendEmail({
            to: emailPar.get(p.user_id)!,
            subject: msg.sujet,
            body: msg.corps,
            attachments,
          });
          if (!r || r.status !== 'sent') throw new Error(r?.error ?? 'canal email non configuré');
        } else if (canal === 'whatsapp') {
          // Rythme lent et constant : une rafale de documents ressemble à du spam.
          // Le corps commence déjà par le sujet (message.ts) : pas de titre en double.
          for (const chat of waPar.get(p.user_id) ?? []) {
            const ouverture = await envoyerTexteWaha(chat, msg.corps);
            if (!ouverture.ok) throw new Error(ouverture.erreur ?? 'passerelle WhatsApp en échec');
            for (const l of envoyees) {
              await pauseEntreEnvois();
              const r = await envoyerDocumentWaha(
                chat,
                { octets: await telecharger(l.code), nom: `westbourse-dossier-${l.code}.pdf` },
                `${l.code} — ${l.designation}`,
              );
              if (!r.ok) throw new Error(`${l.code} : ${r.erreur ?? 'envoi refusé'}`);
            }
          }
        } else {
          const ouverture = await sendTelegramText({
            subject: msg.sujet,
            body: msg.corps,
            telegramChatId: p.telegram_chat_id!,
          });
          if (!ouverture || ouverture.status !== 'sent') {
            throw new Error(ouverture?.error ?? 'canal telegram non configuré');
          }
          for (const l of envoyees) {
            const r = await sendTelegramDocument(
              p.telegram_chat_id!,
              await telecharger(l.code),
              `westbourse-dossier-${l.code}.pdf`,
              `${l.code} — ${l.designation}`,
            );
            if (!r || r.status !== 'sent') throw new Error(`${l.code} : ${r?.error ?? 'envoi refusé'}`);
          }
        }
        if (rectificatif) {
          const { error } = await sb
            .from('dossier_envois')
            .update({ rectifie_le: new Date().toISOString() })
            .eq('user_id', p.user_id)
            .eq('semaine', semaine)
            .eq('canal', canal);
          if (error) logger.warn({ user_id: p.user_id, canal, err: error.message }, 'rectificatif envoyé mais non journalisé');
        } else {
          await journal(p.user_id, canal, 'envoye', codes);
        }
        res.envoyes += 1;
      } catch (err) {
        const e = err instanceof Error ? err.message : String(err);
        // Rectificatif en échec : la ligne reste « non rectifiée », relançable.
        if (!rectificatif) await journal(p.user_id, canal, 'echec', codes, e);
        res.echecs += 1;
        logger.error({ user_id: p.user_id, canal, err: e }, 'envoi de dossiers échoué');
      }
    }
  }

  logger.info(res, 'envoi des dossiers terminé');
  return res;
}
