// GET /api/account/export
// Renvoie l'intégralité des données personnelles de l'utilisateur en JSON
// (droit d'accès et de portabilité — cf. spec §11.2).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const [
    profile,
    watchlists,
    items,
    positions,
    alerts,
    notifs,
    snapshots,
    backtests,
    push,
    ptAccounts,
    ptPositions,
    subscriptions,
    transactions,
    forumTopics,
    forumPosts,
    theses,
    notifPrefs,
    authEvents,
    academyProgress,
    academyNotes,
    academyExamAttempts,
    academyCertificates,
    whatsappConversations,
    whatsappPairingCodes,
    telegramConversations,
    telegramPairingCodes,
    dossierEnvois,
    formationInscriptions,
    emailsBienvenue,
    userEntitlements,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id),
    supabase.from('watchlists').select('*').eq('user_id', user.id),
    supabase
      .from('watchlist_items')
      .select('*, watchlists!inner(user_id)')
      .eq('watchlists.user_id', user.id),
    supabase.from('portfolios_positions').select('*').eq('user_id', user.id),
    supabase.from('alerts').select('*').eq('user_id', user.id),
    supabase.from('notifications_log').select('*').eq('user_id', user.id),
    supabase.from('report_snapshots').select('*').eq('user_id', user.id),
    supabase.from('backtest_runs').select('*').eq('user_id', user.id),
    supabase.from('push_subscriptions').select('*').eq('user_id', user.id),
    supabase.from('paper_trading_accounts').select('*').eq('user_id', user.id),
    supabase.from('paper_trading_positions').select('*').eq('user_id', user.id),
    supabase.from('subscriptions').select('*').eq('user_id', user.id),
    supabase.from('billing_transactions').select('*').eq('user_id', user.id),
    supabase.from('forum_topics').select('*').eq('author_id', user.id),
    supabase.from('forum_posts').select('*').eq('author_id', user.id),
    supabase.from('investment_theses').select('*').eq('user_id', user.id),
    supabase.from('notification_prefs').select('*').eq('user_id', user.id),
    supabase.from('auth_events').select('*').eq('user_id', user.id),
    supabase.from('academy_progress').select('*').eq('user_id', user.id),
    supabase.from('academy_notes').select('*').eq('user_id', user.id),
    supabase.from('academy_exam_attempts').select('*').eq('user_id', user.id),
    supabase.from('academy_certificates').select('*').eq('user_id', user.id),
    supabase.from('whatsapp_conversations').select('*').eq('user_id', user.id),
    supabase.from('whatsapp_pairing_codes').select('*').eq('user_id', user.id),
    supabase.from('telegram_conversations').select('*').eq('user_id', user.id),
    supabase.from('telegram_pairing_codes').select('*').eq('user_id', user.id),
    supabase.from('dossier_envois').select('*').eq('user_id', user.id),
    supabase.from('formation_inscriptions').select('*').eq('user_id', user.id),
    // Emails de bienvenue envoyés (migration 0145) — un par motif.
    supabase.from('emails_bienvenue').select('*').eq('user_id', user.id),
    // Accès achetés à l'unité via Chariow (migration 0146).
    supabase.from('user_entitlements').select('*').eq('user_id', user.id),
  ]);

  // Messages du formulaire de contact (migration 0158) : la table n'a aucune
  // policy, lecture service_role FILTRÉE sur l'adresse du compte. Seulement si
  // l'adresse est confirmée — sinon un compte créé avec l'adresse d'un tiers
  // exporterait ses messages.
  let contactMessages: unknown[] = [];
  if (user.email && user.email_confirmed_at) {
    const { data } = await getServiceClient()
      .from('contact_messages')
      .select('created_at, prenom, email, page, message, statut, reponse, repondu_at')
      .eq('email', user.email.trim().toLowerCase());
    contactMessages = data ?? [];
  }

  // CRM (migration 0172) : tables sans policy, lecture service_role FILTRÉE.
  // L'e-mail ne sert de clé que s'il est confirmé (même règle que contact_messages).
  // Deux requêtes plutôt qu'un `.or()` : une adresse peut légalement contenir
  // `,` ou des parenthèses, qui altéreraient le filtre PostgREST.
  // Jamais exportés : jeton d'opposition, auteur, erreur, resend_id, signaux_json.
  const sbCrm = getServiceClient();
  const emailCrm = user.email && user.email_confirmed_at ? user.email.trim().toLowerCase() : null;
  const colonnesCrm = 'id, type, canal, sujet, contenu, statut, created_at, bonus_code, bonus_at, decision, motif, echeance, livraison, livraison_at';
  const crmSignaux =
    (await sbCrm.from('crm_signaux').select('page, jour, created_at').eq('user_id', user.id)).data ?? [];
  const actionsParCompte = (await sbCrm.from('crm_actions').select(colonnesCrm).eq('user_id', user.id)).data ?? [];
  const actionsParEmail = emailCrm
    ? (await sbCrm.from('crm_actions').select(colonnesCrm).eq('email_norm', emailCrm)).data ?? []
    : [];
  const crmActions = Array.from(
    new Map([...actionsParCompte, ...actionsParEmail].map((a) => [a.id, a])).values(),
  ).map(({ id: _id, ...reste }) => reste);
  const crmOpposition = emailCrm
    ? (await sbCrm.from('crm_oppositions').select('source, created_at').eq('email_norm', emailCrm)).data ?? []
    : [];

  // Lu à part : table de 0165 ; absente, la lecture renvoie une erreur et
  // l'export reste complet pour le reste.
  const whatsappLiaisons = await supabase.from('whatsapp_liaisons').select('chat_id, telephone, lie_le').eq('user_id', user.id);

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    profile: profile.data ?? [],
    watchlists: watchlists.data ?? [],
    watchlist_items: items.data ?? [],
    portfolio_positions: positions.data ?? [],
    alerts: alerts.data ?? [],
    notifications_log: notifs.data ?? [],
    report_snapshots: snapshots.data ?? [],
    backtest_runs: backtests.data ?? [],
    push_subscriptions: push.data ?? [],
    paper_trading_accounts: ptAccounts.data ?? [],
    paper_trading_positions: ptPositions.data ?? [],
    subscriptions: subscriptions.data ?? [],
    billing_transactions: transactions.data ?? [],
    forum_topics: forumTopics.data ?? [],
    forum_posts: forumPosts.data ?? [],
    investment_theses: theses.data ?? [],
    notification_prefs: notifPrefs.data ?? [],
    // Journal de connexions (IP, appareil) — donnée personnelle : elle doit
    // figurer dans l'export au titre du droit d'accès.
    auth_events: authEvents.data ?? [],
    academy_progress: academyProgress.data ?? [],
    academy_notes: academyNotes.data ?? [],
    academy_exam_attempts: academyExamAttempts.data ?? [],
    academy_certificates: academyCertificates.data ?? [],
    // Agent conversationnel WhatsApp : contenu des messages échangés (donnée
    // perso, rétention 90 jours) et codes d'appairage du numéro.
    whatsapp_conversations: whatsappConversations.data ?? [],
    whatsapp_pairing_codes: whatsappPairingCodes.data ?? [],
    // WhatsApp liés au compte (migration 0165, au plus 2) : identifiant de
    // conversation, numéro quand WhatsApp le fournit, date de liaison.
    whatsapp_liaisons: whatsappLiaisons.data ?? [],
    // Même agent conversationnel, canal Telegram : contenu des messages
    // (donnée perso, rétention 90 jours) et codes d'appairage. Le chat_id
    // lui-même figure déjà dans notification_prefs ci-dessus.
    telegram_conversations: telegramConversations.data ?? [],
    telegram_pairing_codes: telegramPairingCodes.data ?? [],
    // Journal des envois hebdomadaires de dossiers (migration 0132) : quelles
    // valeurs ont été adressées, quand et par quel canal. Donnée personnelle
    // liée au compte, rétention 90 jours — elle relève du droit d'accès.
    dossier_envois: dossierEnvois.data ?? [],
    formation_inscriptions: formationInscriptions.data ?? [],
    emails_bienvenue: emailsBienvenue.data ?? [],
    user_entitlements: userEntitlements.data ?? [],
    // Messages envoyés via le formulaire de contact avec l'adresse du compte.
    contact_messages: contactMessages,
    // CRM : intérêt pour l'offre, relances et notes vous concernant, opposition.
    crm_signaux: crmSignaux,
    crm_actions: crmActions,
    crm_opposition: crmOpposition,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="brvm-analyst-export-${user.id}.json"`,
    },
  });
}
