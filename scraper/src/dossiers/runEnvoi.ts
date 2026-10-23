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
import { cleSemaine, selectionnerLignes, type LigneCandidate, type Selection } from './selection.js';
import { composerMessage, composerRectificatif } from './message.js';

const BUCKET = 'dossiers';

export interface EnvoiResult {
  semaine: string;
  comptes: number;
  envoyes: number;
  vides: number;
  echecs: number;
  sautes: number;
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
type Statut = 'en_cours' | 'envoye' | 'echec' | 'vide';

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
  const res: EnvoiResult = { semaine, comptes: 0, envoyes: 0, vides: 0, echecs: 0, sautes: 0 };

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
  const passerelle = wahaConfiguree();
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

    /* Un canal demandé mais inutilisable (pas d'adresse, pas d'appairage) est
       ignoré en silence : ce n'est pas un échec d'envoi, c'est un canal non
       configuré. */
    const canaux: Canal[] = [];
    if (p.dossiers_email && emailPar.get(p.user_id)) canaux.push('email');
    if (p.dossiers_telegram && p.telegram_chat_id) canaux.push('telegram');
    if (p.dossiers_whatsapp && p.whatsapp_chat_id && premiumPar.has(p.user_id) && passerelle) canaux.push('whatsapp');

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

      const msg = rectificatif ? composerRectificatif(sel, semaine, canal) : composerMessage(sel, semaine, canal);
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
          const ouverture = await envoyerTexteWaha(p.whatsapp_chat_id!, msg.corps);
          if (!ouverture.ok) throw new Error(ouverture.erreur ?? 'passerelle WhatsApp en échec');
          for (const l of envoyees) {
            await pauseEntreEnvois();
            const r = await envoyerDocumentWaha(
              p.whatsapp_chat_id!,
              { octets: await telecharger(l.code), nom: `westbourse-dossier-${l.code}.pdf` },
              `${l.code} — ${l.designation}`,
            );
            if (!r.ok) throw new Error(`${l.code} : ${r.erreur ?? 'envoi refusé'}`);
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
