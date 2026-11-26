import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { rapprocherVente } from '@/lib/billing/chariow/rapprochement';
import { activateSubscription } from '@/lib/billing/activate';
import { confirmerPlaceFormation } from '@/lib/formations/confirmer';
import { chargerFileRelecture } from '@/lib/admin/relectureServeur';
import { planAction } from '@/lib/admin/relecture';
import { rejouerSelectionBanque } from '@/lib/admin/rejouerSelection';
import { genererBrouillon } from '@/lib/contact/brouillon';
import { validerBrouillon, ADRESSE_SUPPORT } from '@/lib/contact/validerBrouillon';
import { renduReponse, renduReponseWhatsapp } from '@/lib/contact/rendu';
import { passerelleWhatsapp } from '@/lib/whatsapp/passerelle';
import { produitParCode } from '@/lib/billing/chariow/catalogue';
import { CODE_FORMATION } from '@/lib/billing/chariow/regles';
import { sendEmail } from '@/lib/server/email';
import { chargerDossiers } from '@/lib/crm/charger';
import { estExclu, scorer } from '@/lib/crm/score';
import type { InlineKeyboardButton } from './telegramApi';
import { echapperHtmlPur } from './formatters';

const CONFIRMATION_TTL_MS = 2 * 60_000;

async function auditOps(
  db: SupabaseClient,
  chatId: number,
  action: string,
  resourceType: string,
  resourceId: string | null,
  severity: 'info' | 'warning' | 'critical',
  metadata: Record<string, unknown> = {},
) {
  try {
    await db.from('admin_audit_logs').insert({
      actor_user_id: null,
      actor_role: 'telegram_ops',
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      severity,
      metadata: { ...metadata, telegram_chat_id: chatId },
    });
  } catch {
    /* l'audit ne doit jamais bloquer l'action */
  }
}

export async function creerConfirmationOps(
  db: SupabaseClient,
  chatId: number,
  commande: string,
  args: Record<string, unknown>,
  niveauRisque: 1 | 2,
): Promise<string | null> {
  const expireLe = new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString();
  const { data } = await db
    .from('ops_command_runs')
    .insert({
      chat_id: chatId,
      source: 'telegram',
      commande,
      args,
      statut: 'en_attente_confirmation',
      niveau_risque: niveauRisque,
      expire_le: expireLe,
    })
    .select('id')
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function annulerConfirmationOps(
  db: SupabaseClient,
  chatId: number,
  runId: string,
): Promise<boolean> {
  const { data } = await db
    .from('ops_command_runs')
    .update({ statut: 'annule', maj_le: new Date().toISOString() })
    .eq('id', runId)
    .eq('chat_id', chatId)
    .eq('statut', 'en_attente_confirmation')
    .select('id')
    .maybeSingle();
  return Boolean(data);
}

export async function executerConfirmationOps(
  db: SupabaseClient,
  chatId: number,
  runId: string,
): Promise<{ ok: boolean; html: string }> {
  const maintenant = new Date().toISOString();
  const { data: run } = await db
    .from('ops_command_runs')
    .update({ statut: 'en_cours', maj_le: maintenant })
    .eq('id', runId)
    .eq('chat_id', chatId)
    .eq('statut', 'en_attente_confirmation')
    .select('id, commande, args, expire_le')
    .maybeSingle();

  if (!run) {
    return { ok: false, html: '⚠️ Demande de confirmation introuvable ou déjà consommée.' };
  }
  if (run.expire_le && String(run.expire_le) < maintenant) {
    await db
      .from('ops_command_runs')
      .update({ statut: 'expire', maj_le: new Date().toISOString() })
      .eq('id', runId);
    return { ok: false, html: '⌛ Confirmation expirée (fenêtre de 2 minutes dépassée).' };
  }

  const args = (run.args ?? {}) as Record<string, unknown>;
  let resultat: { ok: boolean; html: string };

  switch (run.commande) {
    case 'confirm_payment':
      resultat = await confirmerPaiementOps(db, String(args.transactionId ?? ''), chatId);
      break;
    case 'feature_flag':
      resultat = await basculerFeatureFlagOps(
        db,
        String(args.code ?? ''),
        args.mode === 'revive' ? 'revive' : 'kill',
        chatId,
      );
      break;
    default:
      resultat = { ok: false, html: `Action confirmée inconnue : ${String(run.commande)}` };
  }

  await db
    .from('ops_command_runs')
    .update({
      statut: resultat.ok ? 'succes' : 'echec',
      resultat: { ok: resultat.ok },
      erreur: resultat.ok ? null : resultat.html.slice(0, 400),
      maj_le: new Date().toISOString(),
    })
    .eq('id', runId);

  return resultat;
}

/* ─── Paiements en attente ───────────────────────────────────────────────── */

export async function listerPaiementsAttente(db: SupabaseClient): Promise<{
  html: string;
  boutons: InlineKeyboardButton[][];
}> {
  const { data } = await db
    .from('billing_transactions')
    .select('id, objet, amount, currency, provider, created_at, user_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(6);

  const rows = (data ?? []) as Array<{
    id: string;
    objet: string | null;
    amount: number;
    currency: string | null;
    provider: string;
    created_at: string;
    user_id: string | null;
  }>;

  if (rows.length === 0) {
    return { html: '💳 <b>Paiements en attente</b>\n✅ Aucun paiement en attente.', boutons: [] };
  }

  const lines = [`💳 <b>Paiements en attente (${rows.length})</b>`, ''];
  const boutons: InlineKeyboardButton[][] = [];

  for (const r of rows) {
    const ref = r.id.slice(0, 8);
    lines.push(
      `• <code>${ref}</code> · ${echapperHtmlPur(r.objet ?? 'abonnement')} · <b>${Number(r.amount).toLocaleString('fr-FR')} ${echapperHtmlPur(r.currency ?? 'XOF')}</b> (${echapperHtmlPur(r.provider)}) — ${r.created_at.slice(0, 16).replace('T', ' ')}`,
    );
    boutons.push([
      {
        text: `✅ Valider ${ref} (${r.objet ?? 'abo'})`,
        callback_data: `pay_ask:${r.id}`,
      },
    ]);
  }

  return { html: lines.join('\n'), boutons };
}

export async function confirmerPaiementOps(
  db: SupabaseClient,
  transactionId: string,
  chatId: number,
): Promise<{ ok: boolean; html: string }> {
  const { data: txn } = await db
    .from('billing_transactions')
    .select('id, objet, subscription_id')
    .eq('id', transactionId)
    .maybeSingle();

  if (!txn) return { ok: false, html: '❌ Transaction introuvable.' };

  if (txn.objet === 'module' || txn.objet === 'pass') {
    // Règle Chariow stricte : rapprochement obligatoire contre l'API Chariow.
    const r = await rapprocherVente(transactionId);
    await auditOps(
      db,
      chatId,
      'payment.confirm.telegram',
      'billing_transaction',
      transactionId,
      r.ok ? 'warning' : 'info',
      { resultat: r.resultat },
    );
    return {
      ok: r.ok,
      html: r.ok
        ? `✅ Vente Chariow rapprochée et activée (<code>${transactionId.slice(0, 8)}</code>).`
        : `⚠️ Rapprochement Chariow refusé : ${echapperHtmlPur(r.resultat)}`,
    };
  }

  if (txn.objet === 'formation') {
    const r = await confirmerPlaceFormation(transactionId);
    await auditOps(db, chatId, 'payment.confirm.telegram', 'formation_inscription', transactionId, 'warning', {
      ok: r.ok,
    });
    return {
      ok: r.ok,
      html: r.ok
        ? `✅ Place formation confirmée (<code>${transactionId.slice(0, 8)}</code>).`
        : `⚠️ ${echapperHtmlPur(r.message)}`,
    };
  }

  const subId = txn.subscription_id as string | null;
  if (!subId) return { ok: false, html: '❌ Aucun abonnement rattaché à cette transaction.' };

  const r = await activateSubscription(subId);
  await auditOps(db, chatId, 'payment.confirm.telegram', 'subscription', subId, 'warning', {
    ok: r.ok,
  });
  return {
    ok: r.ok,
    html: r.ok
      ? `✅ Abonnement activé (<code>${subId.slice(0, 8)}</code>).`
      : `⚠️ ${echapperHtmlPur(r.message ?? 'Activation refusée')}`,
  };
}

/* ─── Agrégats bancaires ─────────────────────────────────────────────────── */

export async function listerAgregatsAttente(): Promise<{
  html: string;
  boutons: InlineKeyboardButton[][];
}> {
  const file = await chargerFileRelecture().catch(() => null);
  if (file === null) {
    return { html: '🏦 <b>Agrégats bancaires</b>\n🔴 File de relecture illisible.', boutons: [] };
  }
  if (file.length === 0) {
    return { html: '🏦 <b>Agrégats bancaires</b>\n✅ Aucun agrégat en attente de relecture.', boutons: [] };
  }

  const top = file.slice(0, 4);
  const lines = [`🏦 <b>Agrégats à relire (${file.length} au total)</b>`, ''];
  const boutons: InlineKeyboardButton[][] = [];

  for (const e of top) {
    const valStr = e.observations[0]
      ? `${e.observations[0].valeur ?? '—'} ${e.observations[0].unite ?? ''}`
      : 'sans obs.';
    lines.push(
      `• <b>${echapperHtmlPur(e.code)}</b> · ${echapperHtmlPur(e.indicateur)} (${echapperHtmlPur(e.periode)}) : ${echapperHtmlPur(valStr)} — <i>${echapperHtmlPur(e.detail)}</i>`,
    );
    boutons.push([
      ...(e.observations.length === 1
        ? [{ text: `✅ Valider ${e.code} ${e.indicateur}`, callback_data: `agr_ok:${e.id}` }]
        : [{ text: `🔎 Arbitrer ${e.code} ↗`, url: 'https://www.westbourse.com/admin/agregats' }]),
      { text: `❌ Rejeter`, callback_data: `agr_ko:${e.id}` },
    ]);
  }

  return { html: lines.join('\n'), boutons };
}

export async function deciderAgregatOps(
  db: SupabaseClient,
  id: string,
  action: 'valider' | 'rejeter',
  chatId: number,
): Promise<{ ok: boolean; html: string }> {
  const { data: item } = await db
    .from('indicateur_relecture')
    .select('id, code, indicateur, observations, statut')
    .eq('id', id)
    .maybeSingle();

  if (!item) return { ok: false, html: '❌ Élément introuvable.' };
  if (item.statut !== 'ouverte') return { ok: false, html: 'ℹ️ Élément déjà traité.' };

  const obsIds = (item.observations as string[] | null) ?? [];
  if (action === 'valider' && obsIds.length !== 1) {
    return {
      ok: false,
      html:
        obsIds.length === 0
          ? '⚠️ Aucune observation rattachée : seul le rejet est possible.'
          : '⚠️ Plusieurs observations contradictoires : arbitrez sur https://www.westbourse.com/admin/agregats.',
    };
  }

  let plan;
  try {
    plan = planAction(
      { observations: obsIds },
      action === 'rejeter'
        ? { action: 'rejeter' }
        : { action: 'valider', observation: obsIds[0] },
    );
  } catch (e) {
    return { ok: false, html: `⚠️ ${echapperHtmlPur((e as Error).message)}` };
  }

  const maintenant = new Date().toISOString();
  if (plan.valides.length) {
    await db
      .from('indicateur_source')
      .update({ controle: 'valide', verifie_par: 'telegram-ops', verifie_le: maintenant })
      .in('id', plan.valides);
  }
  if (plan.rejetees.length) {
    await db
      .from('indicateur_source')
      .update({ controle: 'rejete', verifie_par: 'telegram-ops', verifie_le: maintenant })
      .in('id', plan.rejetees);
  }
  await db
    .from('indicateur_relecture')
    .update({ statut: plan.statut, valeur_corrigee: plan.valeurCorrigee, traite_le: maintenant })
    .eq('id', id)
    .eq('statut', 'ouverte');

  await rejouerSelectionBanque(db, item.code as string).catch(() => null);
  await auditOps(db, chatId, `agregat.relecture.${action}`, 'indicateur_relecture', id, 'info', {
    code: item.code,
    indicateur: item.indicateur,
  });

  return {
    ok: true,
    html: `✅ Agrégat <b>${echapperHtmlPur(String(item.code))} · ${echapperHtmlPur(String(item.indicateur))}</b> ${action === 'valider' ? 'validé' : 'rejeté'} et sélection rejouée.`,
  };
}

/* ─── Messages de contact & Brouillon IA ────────────────────────────────── */

export async function listerContactsAttente(db: SupabaseClient): Promise<{
  html: string;
  boutons: InlineKeyboardButton[][];
}> {
  const { data } = await db
    .from('contact_messages')
    .select('id, prenom, canal, message, brouillon, created_at')
    .eq('statut', 'nouveau')
    .order('created_at', { ascending: true })
    .limit(3);

  const rows = (data ?? []) as Array<{
    id: string;
    prenom: string | null;
    canal: string;
    message: string;
    brouillon: string | null;
    created_at: string;
  }>;

  if (rows.length === 0) {
    return { html: '✉️ <b>Messages de contact</b>\n✅ Aucun message en attente.', boutons: [] };
  }

  const lines = [`✉️ <b>Messages de contact en attente (${rows.length})</b>`, ''];
  const boutons: InlineKeyboardButton[][] = [];

  for (const m of rows) {
    let brouillon = m.brouillon;
    if (!brouillon) {
      const r = await genererBrouillon(db, { prenom: m.prenom, page: null, message: m.message }).catch(
        () => ({ brouillon: null }),
      );
      if (r.brouillon) {
        brouillon = r.brouillon;
        await db
          .from('contact_messages')
          .update({ brouillon, brouillon_at: new Date().toISOString() })
          .eq('id', m.id);
      }
    }
    lines.push(
      `• <b>${echapperHtmlPur(m.prenom || 'Visiteur')}</b> (${echapperHtmlPur(m.canal)}) : « ${echapperHtmlPur(m.message.slice(0, 140))} »`,
    );
    if (brouillon) {
      lines.push(`  <i>Brouillon prêt :</i> ${echapperHtmlPur(brouillon.slice(0, 180))}`);
    }
    boutons.push([
      { text: `✉️ Envoyer réponse`, callback_data: `ctc_send:${m.id}` },
      { text: `🔄 Régénérer brouillon`, callback_data: `ctc_regen:${m.id}` },
    ]);
  }

  return { html: lines.join('\n'), boutons };
}

export async function regenererBrouillonContactOps(
  db: SupabaseClient,
  id: string,
): Promise<{ ok: boolean; html: string; boutons?: InlineKeyboardButton[][] }> {
  const { data: m } = await db
    .from('contact_messages')
    .select('id, prenom, page, message')
    .eq('id', id)
    .maybeSingle();
  if (!m) return { ok: false, html: '❌ Message introuvable.' };

  const r = await genererBrouillon(db, {
    prenom: m.prenom as string | null,
    page: m.page as string | null,
    message: m.message as string,
  });
  if (!r.brouillon) return { ok: false, html: '⚠️ Impossible de générer un brouillon.' };

  await db
    .from('contact_messages')
    .update({ brouillon: r.brouillon, brouillon_at: new Date().toISOString() })
    .eq('id', id);

  return {
    ok: true,
    html: `✏️ <b>Nouveau brouillon</b>\n\n${echapperHtmlPur(r.brouillon)}`,
    boutons: [[{ text: '✉️ Envoyer cette réponse', callback_data: `ctc_send:${id}` }]],
  };
}

export async function envoyerReponseContactOps(
  db: SupabaseClient,
  id: string,
  chatId: number,
): Promise<{ ok: boolean; html: string }> {
  const { data: existing } = await db
    .from('contact_messages')
    .select('brouillon')
    .eq('id', id)
    .eq('statut', 'nouveau')
    .maybeSingle();

  if (!existing?.brouillon) {
    return { ok: false, html: '⚠️ Aucun brouillon prêt pour ce message (ou déjà traité).' };
  }

  const verdict = validerBrouillon(existing.brouillon as string);
  if (!verdict.ok) {
    return { ok: false, html: `⚠️ Brouillon invalide : ${echapperHtmlPur(verdict.raison)}` };
  }

  const { data: m } = await db
    .from('contact_messages')
    .update({ statut: 'envoi' })
    .eq('id', id)
    .eq('statut', 'nouveau')
    .select('email, message, created_at, canal, whatsapp_chat_id')
    .maybeSingle();

  if (!m) return { ok: false, html: '⚠️ Ce message est déjà en cours d’envoi ou traité.' };

  const produit = await produitParCode(CODE_FORMATION).catch(() => null);
  const offre = produit ? { montant: produit.montant, devise: produit.devise } : null;

  let res: { ok: boolean; id?: string; error?: string };
  if (m.canal === 'whatsapp' && m.whatsapp_chat_id) {
    const r = await passerelleWhatsapp().envoyerTexte(
      m.whatsapp_chat_id as string,
      renduReponseWhatsapp({ reponse: verdict.texte, offre }),
    );
    res = { ok: r.ok, id: r.id, error: r.erreur };
  } else if (m.email) {
    const rendu = renduReponse({
      reponse: verdict.texte,
      messageOrigine: m.message as string,
      recuLe: m.created_at as string,
      offre,
    });
    res = await sendEmail({
      to: m.email as string,
      from: `WESTBOURSE <${ADRESSE_SUPPORT}>`,
      replyTo: ADRESSE_SUPPORT,
      subject: rendu.subject,
      html: rendu.html,
      text: rendu.text,
    });
  } else {
    res = { ok: false, error: 'Aucun destinataire enregistré' };
  }

  const maintenant = new Date().toISOString();
  if (res.ok) {
    await db
      .from('contact_messages')
      .update({
        statut: 'repondu',
        reponse: verdict.texte,
        repondu_at: maintenant,
        resend_id: res.id ?? null,
        derniere_activite_at: maintenant,
        livraison: 'envoye',
        livraison_at: maintenant,
      })
      .eq('id', id);
  } else {
    await db.from('contact_messages').update({ statut: 'nouveau' }).eq('id', id);
  }

  await auditOps(db, chatId, 'contact.reply.telegram', 'contact_message', id, res.ok ? 'info' : 'warning', {
    ok: res.ok,
  });

  return res.ok
    ? { ok: true, html: `✅ Réponse envoyée (${echapperHtmlPur(String(m.canal))}).` }
    : { ok: false, html: `❌ Envoi refusé : ${echapperHtmlPur(res.error ?? 'erreur')}` };
}

/* ─── CRM Top prospects ──────────────────────────────────────────────────── */

export async function listerCrmTop(): Promise<string> {
  try {
    const dossiers = await chargerDossiers();
    const maintenant = new Date();
    const classes = dossiers
      .filter((d) => !estExclu(d))
      .map((d) => ({ dossier: d, score: scorer(d, maintenant) }))
      .filter((x) => x.score.score > 0)
      .sort((a, b) => b.score.score - a.score.score)
      .slice(0, 5);

    if (classes.length === 0) {
      return '🎯 <b>CRM · Proches du Premium</b>\nAucun prospect chaud identifié.';
    }

    const lines = ['🎯 <b>Top 5 prospects proches du Premium</b>', ''];
    for (const { dossier, score } of classes) {
      const label = dossier.nom || dossier.emailNorm.replace(/^(..).*(@.*)$/, '$1***$2');
      const raison = score.raisons[0]?.texte ?? '';
      lines.push(
        `• <b>${score.score} pts</b> (${score.niveau}) · ${echapperHtmlPur(label)} — ${echapperHtmlPur(raison)}`,
      );
    }
    return lines.join('\n');
  } catch (e) {
    return `🔴 <b>CRM</b>\nLecture impossible : ${echapperHtmlPur(e instanceof Error ? e.message : 'erreur')}`;
  }
}

/* ─── Feature flags (Kill / Revive) ──────────────────────────────────────── */

export async function basculerFeatureFlagOps(
  db: SupabaseClient,
  code: string,
  mode: 'kill' | 'revive',
  chatId: number,
): Promise<{ ok: boolean; html: string }> {
  const { data: before } = await db
    .from('feature_flags')
    .select('code, label, acces')
    .eq('code', code)
    .maybeSingle();

  if (!before) {
    return { ok: false, html: `❌ Feature flag « ${echapperHtmlPur(code)} » introuvable.` };
  }

  const nextAcces = mode === 'kill' ? 'disabled' : 'free';
  const { error } = await db
    .from('feature_flags')
    .update({ acces: nextAcces, updated_at: new Date().toISOString() })
    .eq('code', code);

  if (error) {
    return { ok: false, html: `❌ Mise à jour impossible : ${echapperHtmlPur(error.message)}` };
  }

  await auditOps(
    db,
    chatId,
    mode === 'kill' ? 'feature.disable.telegram' : 'feature.enable.telegram',
    'feature_flag',
    code,
    'critical',
    { avant: before.acces, apres: nextAcces },
  );

  return {
    ok: true,
    html:
      mode === 'kill'
        ? `🛑 Fonctionnalité <code>${echapperHtmlPur(code)}</code> désactivée en production.`
        : `✅ Fonctionnalité <code>${echapperHtmlPur(code)}</code> réactivée (accès : ${nextAcces}).`,
  };
}

/* ─── Calendrier jours fériés ────────────────────────────────────────────── */

export async function ajouterFerieOps(
  db: SupabaseClient,
  dateIso: string,
  motif: string,
  chatId: number,
): Promise<{ ok: boolean; html: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return { ok: false, html: '⚠️ Date invalide. Format attendu : <code>/ferie 2026-12-07 Fête nationale</code>' };
  }

  const { error } = await db.from('market_calendar').upsert(
    {
      date: dateIso,
      is_trading_day: false,
      holiday_name: motif || 'Jour férié BRVM',
      notes: 'Ajouté via Telegram Ops',
    },
    { onConflict: 'date' },
  );

  if (error) {
    return { ok: false, html: `❌ Enregistrement impossible : ${echapperHtmlPur(error.message)}` };
  }

  await auditOps(db, chatId, 'calendar.holiday.telegram', 'market_calendar', dateIso, 'info', {
    motif,
  });

  return {
    ok: true,
    html: `📅 Jour férié enregistré : <b>${dateIso}</b> (${echapperHtmlPur(motif || 'Jour férié BRVM')}). Les alertes de clôture sont neutralisées pour cette date.`,
  };
}

/* ─── Réseaux sociaux (TikTok conforme) ─────────────────────────────────── */

export async function listerPostsAValider(db: SupabaseClient): Promise<{
  html: string;
  boutons: InlineKeyboardButton[][];
}> {
  const { data } = await db
    .from('publications_sociales')
    .select('cible, cible_id, reseau, statut, lance_le, contenu')
    .in('statut', ['a_valider', 'echec'])
    .order('lance_le', { ascending: false })
    .limit(5);

  const rows = (data ?? []) as Array<{
    cible: string;
    cible_id: string;
    reseau: string;
    statut: string;
    contenu: { titre?: string } | null;
  }>;

  if (rows.length === 0) {
    return { html: '🎬 <b>Publications sociales</b>\n✅ Aucune publication en attente.', boutons: [] };
  }

  const lines = [`🎬 <b>Publications en attente / échec (${rows.length})</b>`, ''];
  const boutons: InlineKeyboardButton[][] = [];

  for (const r of rows) {
    const titre = r.contenu?.titre ?? `${r.cible}:${r.cible_id}`;
    lines.push(
      `• [${echapperHtmlPur(r.reseau)}] <b>${echapperHtmlPur(titre)}</b> (${echapperHtmlPur(r.statut)})`,
    );
    boutons.push([
      {
        text: `Studio TikTok ↗`,
        url: 'https://www.westbourse.com/admin/reseaux/tiktok',
      },
      {
        text: `🗑️ Écarter`,
        callback_data: `post_ko:${r.reseau}|${r.cible}|${r.cible_id}`,
      },
    ]);
  }

  return { html: lines.join('\n'), boutons };
}

export async function ecarterPostOps(
  db: SupabaseClient,
  target: string,
  chatId: number,
): Promise<{ ok: boolean; html: string }> {
  const [reseau, cible, cibleId] = target.split('|');
  if (!reseau || !cible || !cibleId) {
    return { ok: false, html: '⚠️ Référence de publication invalide.' };
  }

  await db
    .from('publications_sociales')
    .update({
      statut: 'ignore',
      erreur: 'écartée via Telegram Ops',
      termine_le: new Date().toISOString(),
    })
    .eq('reseau', reseau)
    .eq('cible', cible)
    .eq('cible_id', cibleId)
    .in('statut', ['a_valider', 'echec']);

  await auditOps(
    db,
    chatId,
    'reseaux.ecarter.telegram',
    'publications_sociales',
    `${reseau}:${cible}:${cibleId}`,
    'info',
  );

  return { ok: true, html: `🗑️ Publication ${echapperHtmlPur(cible)} (${echapperHtmlPur(reseau)}) écartée.` };
}
