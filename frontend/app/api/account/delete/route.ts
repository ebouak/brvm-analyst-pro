// DELETE /api/account/delete
// Suppression DÉFINITIVE du compte et de toutes les données personnelles (RGPD,
// droit à l'effacement). Étapes :
//   1. purge explicite des tables applicatives user-scopées (belt & suspenders) ;
//   2. désabonnement newsletter (clé = email) via service_role ;
//   3. suppression du compte auth.users via service_role → cascade FK sur le
//      reste (profil, abonnements, etc.). `billing_transactions.user_id` passe à
//      NULL (justificatif conservé mais anonymisé : obligation comptable légale).
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';

export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // 1. Purge explicite (anon/RLS) des tables user-scopées. Redondant avec les
  //    cascades FK de l'étape 3, mais protège les tables sans cascade.
  //    `paper_trading_positions` avant `paper_trading_accounts` (FK).
  const tables = [
    'watchlist_items', // via watchlists
    'watchlists',
    'portfolios_positions',
    'alerts',
    'notifications_log',
    'report_snapshots',
    'backtest_runs',
    'push_subscriptions',
    'paper_trading_positions',
    'paper_trading_accounts',
    'investment_theses',
  ] as const;

  for (const t of tables) {
    if (t === 'watchlist_items') {
      const { data: wls } = await supabase
        .from('watchlists')
        .select('id')
        .eq('user_id', user.id);
      const ids = (wls ?? []).map((w) => w.id);
      if (ids.length > 0) {
        await supabase.from('watchlist_items').delete().in('watchlist_id', ids);
      }
      continue;
    }
    await supabase.from(t).delete().eq('user_id', user.id);
  }

  const admin = getServiceClient();

  // 2. Newsletter (clé naturelle = email, consentement marketing distinct).
  if (user.email) {
    await admin.from('newsletter_subscribers').delete().eq('email', user.email);
  }

  // 3. Suppression définitive du compte auth (cascade FK : profil + données ;
  //    billing_transactions.user_id → NULL = anonymisé, conservé pour la compta).
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    return NextResponse.json(
      { error: `Suppression du compte impossible : ${delErr.message}` },
      { status: 500 },
    );
  }

  // La session est désormais invalide ; signOut best-effort.
  try {
    await supabase.auth.signOut();
  } catch {
    /* session déjà invalidée par la suppression */
  }

  return NextResponse.json({
    status: 'success',
    message:
      'Votre compte et vos données personnelles ont été supprimés. Les justificatifs ' +
      'de paiement sont conservés de façon anonymisée pour obligation comptable légale.',
  });
}
