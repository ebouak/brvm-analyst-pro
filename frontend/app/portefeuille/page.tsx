import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/login/actions';
import {
  addPosition, deletePosition, addWatchItem, deleteWatchItem,
  createWatchlist, deleteWatchlist, setDefaultWatchlist,
} from './actions';
import { fmtNumber, fmtFcfa } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Portefeuille & Watchlist' };

interface Position {
  id: string; code: string; quantite: number; prix_entree: number;
  date_entree: string | null; note: string | null;
}
interface WatchItem {
  id: string; code: string; note: string | null;
  prix_alerte_haut: number | null; prix_alerte_bas: number | null;
}

interface Watchlist {
  id: string; nom: string; is_default: boolean;
}

async function getData(activeWlId?: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: positions }, { data: wls }] = await Promise.all([
    supabase.from('portfolios_positions').select('*').order('created_at', { ascending: false }),
    supabase
      .from('watchlists')
      .select('id, nom, is_default')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('nom'),
  ]);

  const watchlists = (wls ?? []) as Watchlist[];
  const activeWl =
    watchlists.find((w) => w.id === activeWlId) ??
    watchlists.find((w) => w.is_default) ??
    watchlists[0] ?? null;

  let items: WatchItem[] = [];
  if (activeWl) {
    const { data } = await supabase.from('watchlist_items').select('*').eq('watchlist_id', activeWl.id);
    items = (data ?? []) as WatchItem[];
  }

  const pos = (positions ?? []) as Position[];

  const codes = [...new Set([...pos.map((p) => p.code), ...items.map((i) => i.code)])];
  const lastPrice: Record<string, number | null> = {};
  if (codes.length > 0) {
    const { data: quotes } = await supabase
      .from('brvm_actions_daily')
      .select('code, cours_jour, date_marche')
      .in('code', codes)
      .order('date_marche', { ascending: false });
    for (const q of (quotes ?? []) as { code: string; cours_jour: number | null }[]) {
      if (!(q.code in lastPrice)) lastPrice[q.code] = q.cours_jour;
    }
  }
  return { email: user.email, pos, items, lastPrice, watchlists, activeWl };
}

export default async function PortefeuillePage({
  searchParams,
}: {
  searchParams?: { wl?: string };
}) {
  const { email, pos, items, lastPrice, watchlists, activeWl } = await getData(searchParams?.wl);

  let totalCost = 0;
  let totalValue = 0;
  const rows = pos.map((p) => {
    const last = lastPrice[p.code] ?? null;
    const cost = p.quantite * p.prix_entree;
    const value = last != null ? p.quantite * last : null;
    const pnl = value != null ? value - cost : null;
    const pnlPct = cost > 0 && pnl != null ? (pnl / cost) * 100 : null;
    totalCost += cost;
    if (value != null) totalValue += value;
    return { ...p, last, cost, value, pnl, pnlPct };
  });
  const totalPnl = totalValue - totalCost;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Portefeuille & Watchlist</h1>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>{email}</span>
          <form action={logout}><button className="text-up hover:underline">Déconnexion</button></form>
        </div>
      </div>

      {/* Synthèse */}
      <div className="grid grid-cols-3 gap-3 max-w-xl">
        <Card label="Coût total" value={fmtFcfa(totalCost) + ' FCFA'} />
        <Card label="Valorisation" value={fmtFcfa(totalValue) + ' FCFA'} />
        <Card label="P&L latent" value={(totalPnl >= 0 ? '+' : '') + fmtFcfa(totalPnl)} cls={totalPnl >= 0 ? 'text-up' : 'text-down'} />
      </div>

      {/* Positions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Positions</h2>
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b border-border bg-bg/40">
              <tr>
                <th className="px-3 py-2 text-left">Titre</th>
                <th className="px-3 py-2 text-right">Qté</th>
                <th className="px-3 py-2 text-right">PRU</th>
                <th className="px-3 py-2 text-right">Cours</th>
                <th className="px-3 py-2 text-right">Valorisation</th>
                <th className="px-3 py-2 text-right">P&L latent</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-muted text-xs">Aucune position. Ajoutez-en ci-dessous.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-bg/40">
                  <td className="px-3 py-2"><Link href={`/actions/${r.code}`} className="font-medium hover:text-up">{r.code}</Link></td>
                  <td className="px-3 py-2 text-right tabular">{fmtNumber(r.quantite)}</td>
                  <td className="px-3 py-2 text-right tabular">{fmtNumber(r.prix_entree)}</td>
                  <td className="px-3 py-2 text-right tabular">{fmtNumber(r.last)}</td>
                  <td className="px-3 py-2 text-right tabular">{r.value != null ? fmtFcfa(r.value) : '—'}</td>
                  <td className={`px-3 py-2 text-right tabular ${r.pnl == null ? 'text-muted' : r.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                    {r.pnl != null ? `${r.pnl >= 0 ? '+' : ''}${fmtFcfa(r.pnl)} (${r.pnlPct?.toFixed(1)}%)` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <form action={deletePosition}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-down hover:underline">×</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={addPosition} className="flex flex-wrap gap-2 items-end bg-surface border border-border rounded-xl p-3">
          <Field name="code" placeholder="Code (ex: SNTS)" required />
          <Field name="quantite" type="number" placeholder="Quantité" required step="any" />
          <Field name="prix_entree" type="number" placeholder="Prix d'entrée" required step="any" />
          <Field name="date_entree" type="date" />
          <Field name="note" placeholder="Note" />
          <button className="bg-up/90 hover:bg-up text-black text-sm font-medium rounded px-3 py-1.5">Ajouter</button>
        </form>
      </section>

      {/* Watchlist */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold">
            Watchlist & alertes
            {activeWl && <span className="ml-2 text-muted font-normal">— {activeWl.nom}</span>}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {watchlists.map((w) => (
              <Link
                key={w.id}
                href={`/portefeuille?wl=${w.id}`}
                className={`text-xs px-2 py-1 rounded border ${
                  w.id === activeWl?.id
                    ? 'border-up text-up bg-up/10'
                    : 'border-border text-muted hover:border-up/40'
                }`}
              >
                {w.nom}{w.is_default && ' ★'}
              </Link>
            ))}
            <form action={createWatchlist} className="flex gap-1">
              <input name="nom" placeholder="Nouvelle…" className="bg-bg border border-border rounded px-2 py-1 text-xs w-28" />
              <button className="text-xs text-up hover:underline">+</button>
            </form>
            {activeWl && !activeWl.is_default && (
              <form action={setDefaultWatchlist}>
                <input type="hidden" name="id" value={activeWl.id} />
                <button className="text-xs text-muted hover:text-up">★ défaut</button>
              </form>
            )}
            {activeWl && watchlists.length > 1 && (
              <form action={deleteWatchlist}>
                <input type="hidden" name="id" value={activeWl.id} />
                <button className="text-xs text-down hover:underline">supprimer</button>
              </form>
            )}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b border-border bg-bg/40">
              <tr>
                <th className="px-3 py-2 text-left">Titre</th>
                <th className="px-3 py-2 text-right">Cours</th>
                <th className="px-3 py-2 text-right">Alerte ↑</th>
                <th className="px-3 py-2 text-right">Alerte ↓</th>
                <th className="px-3 py-2 text-left">Note</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-muted text-xs">Watchlist vide.</td></tr>
              ) : items.map((it) => {
                const last = lastPrice[it.code] ?? null;
                const hit = last != null && ((it.prix_alerte_haut != null && last >= it.prix_alerte_haut) || (it.prix_alerte_bas != null && last <= it.prix_alerte_bas));
                return (
                  <tr key={it.id} className="border-b border-border/40 hover:bg-bg/40">
                    <td className="px-3 py-2">
                      <Link href={`/actions/${it.code}`} className="font-medium hover:text-up">{it.code}</Link>
                      {hit && <span className="ml-2 text-[10px] text-down border border-down/40 rounded px-1">alerte</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular">{fmtNumber(last)}</td>
                    <td className="px-3 py-2 text-right tabular">{fmtNumber(it.prix_alerte_haut)}</td>
                    <td className="px-3 py-2 text-right tabular">{fmtNumber(it.prix_alerte_bas)}</td>
                    <td className="px-3 py-2 text-xs text-muted truncate max-w-[160px]">{it.note ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <form action={deleteWatchItem}><input type="hidden" name="id" value={it.id} /><button className="text-xs text-down hover:underline">×</button></form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <form action={addWatchItem} className="flex flex-wrap gap-2 items-end bg-surface border border-border rounded-xl p-3">
          {activeWl && <input type="hidden" name="watchlist_id" value={activeWl.id} />}
          <Field name="code" placeholder="Code (ex: SGBC)" required />
          <Field name="prix_alerte_haut" type="number" placeholder="Alerte ↑" step="any" />
          <Field name="prix_alerte_bas" type="number" placeholder="Alerte ↓" step="any" />
          <Field name="note" placeholder="Note" />
          <button className="bg-up/90 hover:bg-up text-black text-sm font-medium rounded px-3 py-1.5">Suivre</button>
        </form>
        <p className="text-[11px] text-muted">Les alertes sont évaluées à l’affichage (dernier cours connu). Une évaluation planifiée côté serveur pourra déclencher des notifications (§6.8).</p>
      </section>
    </div>
  );
}

function Card({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`tabular text-lg mt-0.5 ${cls ?? ''}`}>{value}</div>
    </div>
  );
}

function Field({ name, placeholder, type = 'text', required, step }: {
  name: string; placeholder?: string; type?: string; required?: boolean; step?: string;
}) {
  return (
    <input name={name} type={type} placeholder={placeholder} required={required} step={step}
      className="bg-bg border border-border rounded px-2 py-1.5 text-sm" />
  );
}
