import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/login/actions';
import {
  addPosition, deletePosition, addWatchItem, deleteWatchItem,
  createWatchlist, deleteWatchlist, setDefaultWatchlist,
  deleteAlert, updateAlert,
} from './actions';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import PortefeuilleModals from '@/components/PortefeuilleModals';
import PortefeuilleExport from '@/components/PortefeuilleExport';
import PortfolioTabs from '@/components/portfolio/PortfolioTabs';
import PositionRowActions from '@/components/PositionRowActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Portefeuille' };

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

interface Alert {
  id: string; code: string; type: string; seuil: number; actif: boolean; created_at: string;
}

async function getData(activeWlId?: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: positions }, { data: wls }, { data: alerts }, { data: instruments }, { data: refRows }] = await Promise.all([
    supabase.from('portfolios_positions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase
      .from('watchlists')
      .select('id, nom, is_default')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('nom'),
    supabase
      .from('alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('brvm_instruments')
      .select('code, designation')
      .eq('type', 'action')
      .eq('actif', true)
      .order('code'),
    supabase.from('brvm_reference').select('symbole, secteur'),
  ]);

  // Secteur par code (référentiel Base_BRVM du template).
  const secteurByCode: Record<string, string> = {};
  for (const r of (refRows ?? []) as { symbole: string; secteur: string }[]) {
    secteurByCode[r.symbole] = r.secteur;
  }

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
  const alertsList = (alerts ?? []) as Alert[];
  const instrumentsList = (instruments ?? []) as { code: string; designation: string | null }[];

  const codes = [...new Set([...pos.map((p) => p.code), ...items.map((i) => i.code)])];
  const lastPrice: Record<string, number | null> = {};
  const lastPriceDate: Record<string, string | null> = {};
  if (codes.length > 0) {
    const { data: quotes } = await supabase
      .from('brvm_actions_daily')
      .select('code, cours_jour, date_marche')
      .in('code', codes)
      .order('date_marche', { ascending: false });
    for (const q of (quotes ?? []) as { code: string; cours_jour: number | null; date_marche: string }[]) {
      if (!(q.code in lastPrice)) {
        lastPrice[q.code] = q.cours_jour;
        lastPriceDate[q.code] = q.date_marche;
      }
    }
  }

  // Fetch 30-day portfolio history
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const positionCodes = [...new Set(pos.map((p) => p.code))];
  let historicalByDate: Record<string, Record<string, number>> = {};

  if (positionCodes.length > 0) {
    const { data: historyData } = await supabase
      .from('brvm_actions_daily')
      .select('date_marche, code, cours_jour')
      .in('code', positionCodes)
      .gte('date_marche', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date_marche', { ascending: true });

    if (historyData) {
      for (const { date_marche, code, cours_jour } of historyData as { date_marche: string; code: string; cours_jour: number | null }[]) {
        if (!historicalByDate[date_marche]) historicalByDate[date_marche] = {};
        if (cours_jour !== null) historicalByDate[date_marche][code] = cours_jour;
      }
    }
  }

  return { email: user.email, pos, items, lastPrice, lastPriceDate, secteurByCode, watchlists, activeWl, alertsList, historicalByDate, instrumentsList };
}

export default async function PortefeuillePage({
  searchParams,
}: {
  searchParams?: { wl?: string };
}) {
  const { email, pos, items, lastPrice, lastPriceDate, secteurByCode, watchlists, activeWl, alertsList, historicalByDate, instrumentsList } = await getData(searchParams?.wl);

  let totalCost = 0;
  let totalValue = 0;
  const rows = pos.map((p) => {
    const last = lastPrice[p.code] ?? null;
    const cost = p.quantite * p.prix_entree;
    const value = last != null ? p.quantite * last : null;
    const pnl = value != null ? value - cost : null;
    const pnlPct = cost > 0 && pnl != null ? (pnl / cost) * 100 : null;
    const secteur = secteurByCode[p.code] ?? 'Autres';
    totalCost += cost;
    if (value != null) totalValue += value;
    return { ...p, last, cost, value, pnl, pnlPct, secteur };
  });
  const totalPnl = totalValue - totalCost;

  // Répartition sectorielle (valorisation au cours du marché).
  const sectorMap: Record<string, number> = {};
  for (const r of rows) {
    if (r.value != null) sectorMap[r.secteur] = (sectorMap[r.secteur] ?? 0) + r.value;
  }
  const sectorRows = Object.entries(sectorMap)
    .map(([secteur, valeur]) => ({ secteur, valeur, pct: totalValue > 0 ? (valeur / totalValue) * 100 : 0 }))
    .sort((a, b) => b.valeur - a.valeur);

  // Calculate 30-day portfolio change
  let portfolioValueChange30d: number | null = null;
  if (Object.keys(historicalByDate).length > 0) {
    const dates = Object.keys(historicalByDate).sort();
    if (dates.length > 0) {
      const oldestDate = dates[0];
      let valueOld = 0;
      for (const p of pos) {
        const oldPrice = historicalByDate[oldestDate]?.[p.code];
        if (oldPrice !== undefined) valueOld += p.quantite * oldPrice;
      }
      if (valueOld > 0) {
        portfolioValueChange30d = ((totalValue - valueOld) / valueOld) * 100;
      }
    }
  }

  return (
    <div>
      {/* Titre global + déconnexion */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-6 pt-6">
        <h1 className="text-2xl font-semibold">💼 Portefeuille</h1>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>{email}</span>
          <form action={logout}><button type="submit" className="text-up hover:underline">Déconnexion</button></form>
        </div>
      </div>

      <PortfolioTabs>
        {/* ── Onglet « Mon portefeuille » : positions, watchlist, alertes ── */}
        <div className="px-6 pb-6 space-y-6">
          {/* Synthèse */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl">
            <Card label="Coût total" value={fmtFcfa(totalCost) + ' FCFA'} />
            <Card label="Valorisation" value={fmtFcfa(totalValue) + ' FCFA'} />
            <Card label="P&L latent" value={(totalPnl >= 0 ? '+' : '') + fmtFcfa(totalPnl)} cls={totalPnl >= 0 ? 'text-up' : 'text-down'} />
            {portfolioValueChange30d !== null && (
              <Card
                label="Évolution 30j"
                value={`${portfolioValueChange30d >= 0 ? '▲+' : '▼'}${Math.abs(portfolioValueChange30d).toFixed(1)}%`}
                cls={portfolioValueChange30d >= 0 ? 'text-up' : 'text-down'}
              />
            )}
          </div>

          {/* 2-Column Layout: Positions + Watchlist */}
          <div className="grid grid-cols-3 gap-6">
            {/* Left: Positions (2/3) */}
            <div className="col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Positions</h2>
                {rows.length > 0 && <PortefeuilleExport rows={rows} />}
              </div>
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted border-b border-border bg-bg/40">
                    <tr>
                      <th className="px-3 py-2 text-left">Titre</th>
                      <th className="px-3 py-2 text-left">Secteur</th>
                      <th className="px-3 py-2 text-right">Qté</th>
                      <th className="px-3 py-2 text-right" title="Prix de Revient Unitaire — votre prix d'achat moyen">PRU</th>
                      <th className="px-3 py-2 text-right" title="Dernier cours de marché connu">Cours</th>
                      <th className="px-3 py-2 text-center" title="Date à laquelle vous avez acheté">Date entrée</th>
                      <th className="px-3 py-2 text-center" title="Date du dernier cours connu">Date cours</th>
                      <th className="px-3 py-2 text-right">Valorisation</th>
                      <th className="px-3 py-2 text-right">P&L latent</th>
                      <th className="px-3 py-2 text-center text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={10} className="px-3 py-4 text-center text-muted text-xs">Aucune position. Utilisez le bouton ci-dessous pour en ajouter.</td></tr>
                    ) : rows.map((r) => (
                      <tr key={r.id} className="border-b border-border/40 hover:bg-bg/40">
                        <td className="px-3 py-2"><Link href={`/actions/${r.code}`} className="font-medium hover:text-up">{r.code}</Link></td>
                        <td className="px-3 py-2 text-xs text-muted">{r.secteur}</td>
                        <td className="px-3 py-2 text-right tabular">{fmtNumber(r.quantite)}</td>
                        <td className="px-3 py-2 text-right tabular">{fmtNumber(r.prix_entree)}</td>
                        <td className="px-3 py-2 text-right tabular">{fmtNumber(r.last)}</td>
                        <td className="px-3 py-2 text-center tabular text-xs text-muted">{r.date_entree ?? '—'}</td>
                        <td className="px-3 py-2 text-center tabular text-xs text-muted">{lastPriceDate[r.code] ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular">{r.value != null ? fmtFcfa(r.value) : '-'}</td>
                        <td className={`px-3 py-2 text-right tabular ${r.pnl == null ? 'text-muted' : r.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                          {r.pnl != null ? `${r.pnl >= 0 ? '+' : ''}${fmtFcfa(r.pnl)} (${r.pnlPct?.toFixed(1)}%)` : '-'}
                        </td>
                        <td className="px-3 py-2">
                          <PositionRowActions position={{ id: r.id, code: r.code, quantite: r.quantite, prix_entree: r.prix_entree, date_entree: r.date_entree, note: r.note }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PortefeuilleModals
                watchlistId={activeWl?.id ?? null}
                instruments={instrumentsList}
              />
            </div>

            {/* Right: Watchlist + Notes (1/3) */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Watchlist {activeWl && <span className="text-muted font-normal">- {activeWl.nom}</span>}</h2>
              <div className="flex flex-col gap-2">
                {watchlists.map((w) => (
                  <Link
                    key={w.id}
                    href={`/portefeuille?wl=${w.id}`}
                    className={`text-xs px-2 py-1 rounded border text-center transition ${
                      w.id === activeWl?.id
                        ? 'border-up text-up bg-up/10'
                        : 'border-border text-muted hover:border-up/40'
                    }`}
                  >
                    {w.nom}{w.is_default && ' [DEFAULT]'}
                  </Link>
                ))}
                <form action={createWatchlist} className="flex gap-1">
                  <input name="nom" placeholder="Nouvelle…" className="bg-bg border border-border rounded px-2 py-1 text-xs flex-1" />
                  <button type="submit" className="text-xs text-up hover:underline">+</button>
                </form>
              </div>

              <div className="bg-surface border border-border rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                <div className="text-xs text-muted border-b border-border bg-bg/40 px-3 py-2 font-semibold">Titres ({items.length})</div>
                {items.length === 0 ? (
                  <div className="px-3 py-4 text-center text-muted text-xs">Watchlist vide</div>
                ) : (
                  <div className="space-y-1">
                    {items.map((it) => {
                      const last = lastPrice[it.code] ?? null;
                      const hit = last != null && ((it.prix_alerte_haut != null && last >= it.prix_alerte_haut) || (it.prix_alerte_bas != null && last <= it.prix_alerte_bas));
                      return (
                        <div key={it.id} className="px-3 py-2 border-b border-border/40 hover:bg-bg/40 group flex items-center justify-between">
                          <div className="flex-1">
                            <Link href={`/actions/${it.code}`} className="text-xs font-medium hover:text-up block">{it.code}</Link>
                            {hit && <span className="text-[10px] text-down">alerte</span>}
                          </div>
                          <form action={deleteWatchItem} className="inline">
                            <input type="hidden" name="id" value={it.id} />
                            <button type="submit" className="text-xs text-down hover:underline opacity-0 group-hover:opacity-100 transition">X</button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <form action={addWatchItem} className="flex flex-col gap-2 bg-surface border border-border rounded-xl p-3">
                {activeWl && <input type="hidden" name="watchlist_id" value={activeWl.id} />}
                <Field name="code" placeholder="Code" required />
                <div className="flex gap-2">
                  <Field name="prix_alerte_haut" type="number" placeholder="Alerte (haut)" step="any" cls="flex-1" />
                  <Field name="prix_alerte_bas" type="number" placeholder="Alerte (bas)" step="any" cls="flex-1" />
                </div>
                <Field name="note" placeholder="Note" />
                <button type="submit" className="bg-up/90 hover:bg-up text-black text-sm font-medium rounded px-3 py-1.5 w-full">Suivre</button>
              </form>
            </div>
          </div>

          {/* Répartition sectorielle (Base_BRVM) */}
          {sectorRows.length > 0 && (
            <section className="space-y-3 max-w-2xl">
              <h2 className="text-sm font-semibold">🏭 Répartition sectorielle</h2>
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted border-b border-border bg-bg/40">
                    <tr>
                      <th className="px-3 py-2 text-left">Secteur</th>
                      <th className="px-3 py-2 text-right">Valeur (FCFA)</th>
                      <th className="px-3 py-2 text-right">Pondération</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectorRows.map((s) => (
                      <tr key={s.secteur} className="border-b border-border/40">
                        <td className="px-3 py-2">{s.secteur}</td>
                        <td className="px-3 py-2 text-right tabular">{fmtFcfa(s.valeur)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                              <div className="h-full bg-up rounded-full" style={{ width: `${Math.min(s.pct, 100)}%` }} />
                            </div>
                            <span className="tabular text-xs w-12 text-right">{s.pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="font-semibold border-t border-border">
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-right tabular">{fmtFcfa(totalValue)}</td>
                      <td className="px-3 py-2 text-right tabular text-xs">100,0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Alertes */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Alertes ({alertsList.filter(a => a.actif).length} actives)</h2>
            </div>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted border-b border-border bg-bg/40">
                  <tr>
                    <th className="px-3 py-2 text-left">Titre</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Seuil</th>
                    <th className="px-3 py-2 text-center">Statut</th>
                    <th className="px-3 py-2 text-center text-xs">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alertsList.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-muted text-xs">Aucune alerte créée</td></tr>
                  ) : alertsList.map((a) => {
                    const typeLabel =
                      a.type === 'prix_au_dessus' ? 'Au-dessus' :
                      a.type === 'prix_en_dessous' ? 'En-dessous' :
                      'Variation';
                    return (
                      <tr key={a.id} className={`border-b border-border/40 hover:bg-bg/40 group ${!a.actif ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-2"><Link href={`/actions/${a.code}`} className="font-medium hover:text-up">{a.code}</Link></td>
                        <td className="px-3 py-2 text-xs">{typeLabel}</td>
                        <td className="px-3 py-2 text-right tabular text-xs">{fmtNumber(a.seuil)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${a.actif ? 'bg-up/20 text-up' : 'bg-border text-muted'}`}>
                            {a.actif ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <form action={deleteAlert} className="inline">
                            <input type="hidden" name="id" value={a.id} />
                            <button type="submit" className="text-xs text-down hover:underline opacity-0 group-hover:opacity-100 transition">X</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted">Les alertes sont évaluées à l'affichage (dernier cours connu). Une évaluation planifiée côté serveur pourra déclencher des notifications.</p>
          </section>
        </div>
      </PortfolioTabs>
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

function Field({ name, placeholder, type = 'text', required, step, cls }: {
  name: string; placeholder?: string; type?: string; required?: boolean; step?: string; cls?: string;
}) {
  return (
    <input name={name} type={type} placeholder={placeholder} required={required} step={step}
      className={`bg-bg border border-border rounded px-2 py-1.5 text-sm ${cls ?? ''}`} />
  );
}
