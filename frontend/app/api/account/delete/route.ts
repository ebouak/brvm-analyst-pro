// DELETE /api/account/delete
// Supprime toutes les données utilisateur (cascade RLS) puis déconnecte.
// La suppression du compte auth.users nécessite la service_role : ici on se
// contente de purger les données applicatives et de signaler la déconnexion.
// La suppression définitive du compte auth doit être déclenchée côté serveur
// admin (worker dédié) ou via le dashboard Supabase.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Les FK on delete cascade depuis auth.users feront le reste si on supprime
  // le compte ; ici on purge explicitement les tables user-scopées.
  const tables = [
    'watchlist_items', // via watchlists
    'watchlists',
    'portfolios_positions',
    'alerts',
    'notifications_log',
    'report_snapshots',
    'backtest_runs',
  ] as const;

  for (const t of tables) {
    if (t === 'watchlist_items') {
      // delete via parent watchlist user_id
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

  await supabase.auth.signOut();

  return NextResponse.json({
    status: 'success',
    message:
      'Toutes vos données applicatives ont été supprimées. Pour la suppression définitive du compte d\'authentification, contactez le support.',
  });
}
