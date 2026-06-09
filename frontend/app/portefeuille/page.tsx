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
import { computePositions, sectorBreakdown, concentrationHHI, bestWorst, nbHoldings } from '@/lib/portfolio/metrics';
import {
  SectionHeader,
  MetricCard,
  PremiumPanel,
  EmptyStatePremium,
  StatPill,
  Eyebrow,
} from '@/components/ui/premium';

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

  // Liquidités stockées comme position spéciale ; séparées des actions.
  const liqPos = pos.find((p) => p.code === 'LIQUIDITES') ?? null;
  const liquidites = liqPos ? liqPos.prix_entree : null;
  const equityPos = pos.filter((p) => p.code !== 'LIQUIDITES');

  // Valorisation des positions actions (au cours du marché) + secteur.
  const rows = equityPos.map((p) => {
    const last = lastPrice[p.code] ?? null;
    const cost = p.quantite * p.prix_entree;
    const value = last != null ? p.quantite * last : null;
    const pnl = value != null ? value - cost : null;
    const pnlPct = cost > 0 && pnl != null ? (pnl / cost) * 100 : null;
    const secteur = secteurByCode[p.code] ?? 'Autres';
    return { ...p, last, cost, value, pnl, pnlPct, secteur };
  });

  // Métriques agrégées
  const computed = computePositions(
    equityPos.map((p) => ({ ...p, secteur: secteurByCode[p.code] ?? 'Autres', last: lastPrice[p.code] ?? null }))
  ).rows;
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const equityValue = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const totalPnl = equityValue - totalCost;
  const totalPnlPct = totalCost > 0 ? totalPnl / totalCost : null;

  // Valeur totale = actions + liquidités.
  const totalValue = equityValue + (liquidites ?? 0);

  // Répartition sectorielle
  const sectorRows = sectorBreakdown([
    ...computed,
    ...(liquidites != null
      ? [{ code: 'LIQUIDITES', quantite: 1, prix_entree: liquidites, cost: liquidites, value: liquidites, pnl: 0, pnlPct: 0, ponderation: 0, is_liquidites: true, secteur: 'Liquidités' }]
      : []),
  ]);

  // Métriques d'analyse
  const hhi = concentrationHHI(computed);
  const cashPct = totalValue > 0 ? ((liquidites ?? 0) / totalValue) * 100 : 0;
  const { best, worst } = bestWorst(computed);
  const nbLignes = nbHoldings(computed);

  // Calculate 30-day portfolio change
  let portfolioValueChange30d: number | null = null;
  if (Object.keys(historicalByDate).length > 0) {
    const dates = Object.keys(historicalByDate).sort();
    if (dates.length > 0) {
      const oldestDate = dates[0];
      let valueOld = 0;
      for (const p of equityPos) {
        const oldPrice = historicalByDate[oldestDate]?.[p.code];
        if (oldPrice !== undefined) valueOld += p.quantite * oldPrice;
      }
      if (valueOld > 0) {
        portfolioValueChange30d = ((equityValue - valueOld) / valueOld) * 100;
      }
    }
  }

  const pnlDir: 'up' | 'down' | 'flat' = totalPnl > 0 ? 'up' : totalPnl < 0 ? 'down' : 'flat';
  const change30Dir: 'up' | 'down' | 'flat' =
    portfolioValueChange30d != null
      ? portfolioValueChange30d > 0 ? 'up' : portfolioValueChange30d < 0 ? 'down' : 'flat'
      : 'flat';

  return (
    <div className="min-h-screen bg-bg">
      {/* ── En-tête page ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 pt-8 pb-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <SectionHeader
            kicker="Gestion patrimoniale"
            title="Mon portefeuille"
            subtitle="Valorisation temps réel, P&L latent et surveillance des positions BRVM."
          />
          <div className="flex items-center gap-3">
            <span className="text-xs text-faint">{email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-4 py-1.5 text-xs text-muted transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-down/40 hover:text-down"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>

        {/* Filet doré */}
        <div className="gold-rule mt-6" />
      </div>

      <PortfolioTabs>
        <div className="max-w-7xl mx-auto px-6 pb-12 space-y-8">

          {/* ── KPI principaux ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-rise-in">
            <MetricCard
              label="Valorisation totale"
              value={fmtFcfa(totalValue)}
              unit="FCFA"
              delta={liquidites != null ? `dont ${fmtFcfa(liquidites)} cash` : 'actions uniquement'}
              deltaDir="flat"
              accent="gold"
            />
            <MetricCard
              label="P&L latent"
              value={`${totalPnl >= 0 ? '+' : ''}${fmtFcfa(totalPnl)}`}
              unit="FCFA"
              delta={totalPnlPct != null ? `${totalPnlPct >= 0 ? '+' : ''}${(totalPnlPct * 100).toFixed(1)}% / coût` : undefined}
              deltaDir={pnlDir}
              accent={pnlDir === 'up' ? 'emerald' : 'neutral'}
            />
            <MetricCard
              label="Coût total (PRU)"
              value={fmtFcfa(totalCost)}
              unit="FCFA"
              delta={`${nbLignes} ligne${nbLignes > 1 ? 's' : ''}`}
              deltaDir="flat"
              accent="neutral"
            />
            {portfolioValueChange30d !== null ? (
              <MetricCard
                label="Évolution actions 30j"
                value={`${portfolioValueChange30d >= 0 ? '+' : ''}${Math.abs(portfolioValueChange30d).toFixed(1)}%`}
                deltaDir={change30Dir}
                delta={portfolioValueChange30d >= 0 ? 'Performance positive' : 'Performance négative'}
                accent={change30Dir === 'up' ? 'emerald' : 'neutral'}
              />
            ) : (
              <MetricCard
                label="Liquidités"
                value={liquidites != null ? fmtFcfa(liquidites) : '—'}
                unit={liquidites != null ? 'FCFA' : undefined}
                delta={`${cashPct.toFixed(0)}% du total`}
                deltaDir="flat"
                accent="sapphire"
              />
            )}
          </div>

          {/* ── KPI d'analyse (si positions) ─────────────────────────────── */}
          {nbLignes > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-rise-in">
              <MetricCard
                label="Concentration (HHI)"
                value={hhi.toFixed(2)}
                delta={hhi > 0.25 ? 'Portefeuille concentré' : 'Bien diversifié'}
                deltaDir={hhi > 0.25 ? 'down' : 'up'}
                accent={hhi > 0.25 ? 'neutral' : 'emerald'}
              />
              <MetricCard
                label="Part liquidités"
                value={`${cashPct.toFixed(1)}%`}
                delta="du portefeuille total"
                deltaDir="flat"
                accent="sapphire"
              />
              {best && (
                <MetricCard
                  label="Meilleure ligne"
                  value={`${best.code}`}
                  delta={best.pnlPct != null ? `${best.pnlPct >= 0 ? '+' : ''}${(best.pnlPct * 100).toFixed(1)}%` : undefined}
                  deltaDir="up"
                  accent="emerald"
                />
              )}
              {worst && (
                <MetricCard
                  label="Pire ligne"
                  value={`${worst.code}`}
                  delta={worst.pnlPct != null ? `${worst.pnlPct >= 0 ? '+' : ''}${(worst.pnlPct * 100).toFixed(1)}%` : undefined}
                  deltaDir={worst.pnlPct != null && worst.pnlPct < 0 ? 'down' : 'up'}
                  accent="neutral"
                />
              )}
            </div>
          )}

          {/* ── Positions + Watchlist ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Positions (2/3) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eyebrow>Positions ouvertes</Eyebrow>
                  {rows.length > 0 && (
                    <StatPill tone="neutral">{rows.length} ligne{rows.length > 1 ? 's' : ''}</StatPill>
                  )}
                </div>
                {rows.length > 0 && <PortefeuilleExport rows={rows} />}
              </div>

              {rows.length === 0 && liquidites == null ? (
                <EmptyStatePremium
                  icon="◈"
                  title="Portefeuille vide"
                  hint="Ajoutez vos premières positions pour suivre votre valorisation et P&L en temps réel."
                />
              ) : (
                <PremiumPanel>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/60">
                          <th className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-faint font-semibold">Titre</th>
                          <th className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-faint font-semibold">Secteur</th>
                          <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-faint font-semibold">Qté</th>
                          <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-faint font-semibold" title="Prix de Revient Unitaire">PRU</th>
                          <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-faint font-semibold" title="Dernier cours connu">Cours</th>
                          <th className="px-4 py-3 text-center text-[10px] uppercase tracking-widest text-faint font-semibold hidden md:table-cell" title="Date d'achat">Entrée</th>
                          <th className="px-4 py-3 text-center text-[10px] uppercase tracking-widest text-faint font-semibold hidden md:table-cell" title="Date du dernier cours">Date cours</th>
                          <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-faint font-semibold">Valorisation</th>
                          <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-faint font-semibold">P&L latent</th>
                          <th className="px-4 py-3 text-center text-[10px] uppercase tracking-widest text-faint font-semibold">—</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-border/30 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-elevated/60 group"
                          >
                            <td className="px-4 py-3">
                              <Link
                                href={`/actions/${r.code}`}
                                className="font-semibold text-ivory transition-colors duration-200 hover:text-gold"
                              >
                                {r.code}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-muted">{r.secteur}</span>
                            </td>
                            <td className="px-4 py-3 text-right tabular text-ivory">{fmtNumber(r.quantite)}</td>
                            <td className="px-4 py-3 text-right tabular text-muted">{fmtNumber(r.prix_entree)}</td>
                            <td className="px-4 py-3 text-right tabular text-ivory">{fmtNumber(r.last)}</td>
                            <td className="px-4 py-3 text-center tabular text-xs text-faint hidden md:table-cell">{r.date_entree ?? '—'}</td>
                            <td className="px-4 py-3 text-center tabular text-xs text-faint hidden md:table-cell">{lastPriceDate[r.code] ?? '—'}</td>
                            <td className="px-4 py-3 text-right tabular text-ivory font-medium">{r.value != null ? fmtFcfa(r.value) : '—'}</td>
                            <td className={`px-4 py-3 text-right tabular font-semibold ${r.pnl == null ? 'text-faint' : r.pnl >= 0 ? 'text-up' : 'text-down'}`}>
                              {r.pnl != null
                                ? `${r.pnl >= 0 ? '+' : ''}${fmtFcfa(r.pnl)} (${r.pnlPct?.toFixed(1)}%)`
                                : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <PositionRowActions position={{ id: r.id, code: r.code, quantite: r.quantite, prix_entree: r.prix_entree, date_entree: r.date_entree, note: r.note }} />
                            </td>
                          </tr>
                        ))}

                        {/* Ligne Liquidités */}
                        {liquidites != null && (
                          <tr className="border-b border-border/30 bg-elevated/30">
                            <td className="px-4 py-3 font-medium text-muted italic">Liquidités</td>
                            <td className="px-4 py-3 text-xs text-faint italic">Cash</td>
                            <td className="px-4 py-3 text-right text-faint">—</td>
                            <td className="px-4 py-3 text-right text-faint">—</td>
                            <td className="px-4 py-3 text-right text-faint">—</td>
                            <td className="px-4 py-3 text-center text-faint hidden md:table-cell">—</td>
                            <td className="px-4 py-3 text-center text-faint hidden md:table-cell">—</td>
                            <td className="px-4 py-3 text-right tabular text-ivory">{fmtFcfa(liquidites)}</td>
                            <td className="px-4 py-3 text-right text-faint">—</td>
                            <td className="px-4 py-3" />
                          </tr>
                        )}

                        {/* Ligne TOTAL */}
                        {(rows.length > 0 || liquidites != null) && (
                          <tr className="border-t border-border-strong bg-elevated/50">
                            <td className="px-4 py-3 text-[10px] uppercase tracking-widest text-faint font-semibold" colSpan={7}>
                              Total portefeuille
                            </td>
                            <td className="px-4 py-3 text-right tabular text-ivory font-bold">{fmtFcfa(totalValue)}</td>
                            <td className={`px-4 py-3 text-right tabular font-bold ${totalPnl >= 0 ? 'text-up' : 'text-down'}`}>
                              {totalPnl >= 0 ? '+' : ''}{fmtFcfa(totalPnl)}
                            </td>
                            <td className="px-4 py-3" />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </PremiumPanel>
              )}

              <PortefeuilleModals
                watchlistId={activeWl?.id ?? null}
                instruments={instrumentsList}
                liquidites={liquidites}
              />
            </div>

            {/* Watchlist (1/3) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Eyebrow>Watchlist</Eyebrow>
                {activeWl && (
                  <StatPill tone="gold">{activeWl.nom}</StatPill>
                )}
              </div>

              {/* Sélecteur de listes */}
              <div className="flex flex-col gap-1.5">
                {watchlists.map((w) => (
                  <Link
                    key={w.id}
                    href={`/portefeuille?wl=${w.id}`}
                    className={`flex items-center justify-between rounded-chip border px-3 py-2 text-xs transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      w.id === activeWl?.id
                        ? 'border-gold/40 bg-gold/[0.06] text-gold'
                        : 'border-border bg-surface text-muted hover:border-border-strong hover:text-ivory'
                    }`}
                  >
                    <span>{w.nom}</span>
                    {w.is_default && (
                      <span className="text-[9px] uppercase tracking-widest text-gold/60">Défaut</span>
                    )}
                  </Link>
                ))}
                <form action={createWatchlist} className="flex gap-2 mt-1">
                  <input
                    name="nom"
                    placeholder="Nouvelle liste…"
                    className="flex-1 rounded-chip border border-border bg-sunken px-3 py-1.5 text-xs text-ivory placeholder:text-faint focus:border-gold/50 outline-none transition-colors duration-200"
                  />
                  <button
                    type="submit"
                    className="rounded-chip border border-gold/30 bg-gold/[0.08] px-3 py-1.5 text-xs text-gold transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-gold/[0.14] hover:border-gold/50"
                  >
                    +
                  </button>
                </form>
              </div>

              {/* Items de la watchlist */}
              <PremiumPanel>
                <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-faint font-semibold">Titres suivis</span>
                  <StatPill tone="neutral">{items.length}</StatPill>
                </div>
                {items.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-muted">Watchlist vide</p>
                    <p className="text-xs text-faint mt-1">Ajoutez des titres à surveiller</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-border/30">
                    {items.map((it) => {
                      const last = lastPrice[it.code] ?? null;
                      const hit = last != null && ((it.prix_alerte_haut != null && last >= it.prix_alerte_haut) || (it.prix_alerte_bas != null && last <= it.prix_alerte_bas));
                      return (
                        <div key={it.id} className="px-4 py-2.5 group flex items-center justify-between transition-colors duration-200 hover:bg-elevated/50">
                          <div className="flex-1 min-w-0">
                            <Link href={`/actions/${it.code}`} className="text-xs font-semibold text-ivory hover:text-gold transition-colors duration-200">
                              {it.code}
                            </Link>
                            {hit && (
                              <span className="ml-2 inline-flex items-center rounded-full border border-down/30 bg-down/10 px-1.5 py-0.5 text-[9px] font-semibold text-down">
                                ALERTE
                              </span>
                            )}
                            {last != null && (
                              <span className="ml-2 tabular text-[10px] text-muted">{fmtNumber(last)}</span>
                            )}
                          </div>
                          <form action={deleteWatchItem} className="inline">
                            <input type="hidden" name="id" value={it.id} />
                            <button
                              type="submit"
                              className="text-[10px] text-faint hover:text-down opacity-0 group-hover:opacity-100 transition-all duration-200 px-1"
                            >
                              ×
                            </button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                )}
              </PremiumPanel>

              {/* Formulaire ajout watchlist */}
              <PremiumPanel glow>
                <div className="p-4 space-y-3">
                  <Eyebrow className="text-gold/50">Ajouter un titre</Eyebrow>
                  <form action={addWatchItem} className="flex flex-col gap-2">
                    {activeWl && <input type="hidden" name="watchlist_id" value={activeWl.id} />}
                    <PremiumField name="code" placeholder="Code BRVM (ex: SGBCI)" required />
                    <div className="grid grid-cols-2 gap-2">
                      <PremiumField name="prix_alerte_haut" type="number" placeholder="Alerte ▲" step="any" />
                      <PremiumField name="prix_alerte_bas" type="number" placeholder="Alerte ▼" step="any" />
                    </div>
                    <PremiumField name="note" placeholder="Note (optionnel)" />
                    <button
                      type="submit"
                      className="w-full rounded-chip bg-gold/90 py-2 text-xs font-semibold text-obsidian transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-gold active:scale-[0.98]"
                    >
                      Suivre ce titre
                    </button>
                  </form>
                </div>
              </PremiumPanel>
            </div>
          </div>

          {/* ── Répartition sectorielle ───────────────────────────────────── */}
          {sectorRows.length > 0 && (
            <section className="space-y-4 max-w-2xl">
              <div className="gold-rule" />
              <Eyebrow>Répartition sectorielle</Eyebrow>
              <PremiumPanel>
                <div className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-faint font-semibold">Secteur</th>
                        <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-faint font-semibold">Valeur FCFA</th>
                        <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-faint font-semibold">Poids</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectorRows.map((s) => (
                        <tr key={s.secteur} className="border-b border-border/30 transition-colors duration-200 hover:bg-elevated/40">
                          <td className="px-4 py-3 text-ivory">{s.secteur}</td>
                          <td className="px-4 py-3 text-right tabular text-muted">{fmtFcfa(s.valeur)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <div className="w-24 h-1 bg-border rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gold/60 rounded-full transition-all duration-700"
                                  style={{ width: `${Math.min(s.pct, 100)}%` }}
                                />
                              </div>
                              <span className="tabular text-xs text-ivory w-12 text-right">{s.pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-border-strong bg-elevated/40">
                        <td className="px-4 py-3 text-[10px] uppercase tracking-widest text-faint font-semibold">Total</td>
                        <td className="px-4 py-3 text-right tabular text-ivory font-semibold">{fmtFcfa(totalValue)}</td>
                        <td className="px-4 py-3 text-right tabular text-xs text-muted">100,0%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </PremiumPanel>
            </section>
          )}

          {/* ── Alertes ───────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="gold-rule" />
            <div className="flex items-center justify-between gap-2">
              <Eyebrow>Alertes de prix</Eyebrow>
              <StatPill tone={alertsList.filter(a => a.actif).length > 0 ? 'gold' : 'neutral'}>
                {alertsList.filter(a => a.actif).length} active{alertsList.filter(a => a.actif).length > 1 ? 's' : ''}
              </StatPill>
            </div>

            {alertsList.length === 0 ? (
              <EmptyStatePremium
                icon="◎"
                title="Aucune alerte configurée"
                hint="Les alertes déclenchées par le serveur envoient des notifications email ou Telegram."
              />
            ) : (
              <PremiumPanel>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-faint font-semibold">Titre</th>
                        <th className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-faint font-semibold">Type</th>
                        <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-faint font-semibold">Seuil</th>
                        <th className="px-4 py-3 text-center text-[10px] uppercase tracking-widest text-faint font-semibold">Statut</th>
                        <th className="px-4 py-3 text-center text-[10px] uppercase tracking-widest text-faint font-semibold">—</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertsList.map((a) => {
                        const typeLabel =
                          a.type === 'prix_au_dessus' ? 'Au-dessus' :
                          a.type === 'prix_en_dessous' ? 'En-dessous' :
                          'Variation';
                        return (
                          <tr
                            key={a.id}
                            className={`border-b border-border/30 transition-colors duration-200 hover:bg-elevated/40 group ${!a.actif ? 'opacity-40' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <Link href={`/actions/${a.code}`} className="font-semibold text-ivory hover:text-gold transition-colors duration-200">
                                {a.code}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted">{typeLabel}</td>
                            <td className="px-4 py-3 text-right tabular text-ivory">{fmtNumber(a.seuil)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wide ${
                                a.actif
                                  ? 'border-up/30 bg-up/10 text-up'
                                  : 'border-border bg-elevated text-faint'
                              }`}>
                                {a.actif ? 'Actif' : 'Inactif'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <form action={deleteAlert} className="inline">
                                <input type="hidden" name="id" value={a.id} />
                                <button
                                  type="submit"
                                  className="text-xs text-faint hover:text-down opacity-0 group-hover:opacity-100 transition-all duration-200 px-1"
                                >
                                  ×
                                </button>
                              </form>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </PremiumPanel>
            )}
            <p className="text-[11px] text-faint leading-relaxed">
              Les alertes sont évaluées à chaque affichage sur le dernier cours connu. Une évaluation planifiée côté serveur peut déclencher des notifications email ou Telegram.
            </p>
          </section>

        </div>
      </PortfolioTabs>
    </div>
  );
}

/* ── Champ de formulaire premium ─────────────────────────────────────────── */
function PremiumField({ name, placeholder, type = 'text', required, step, cls }: {
  name: string; placeholder?: string; type?: string; required?: boolean; step?: string; cls?: string;
}) {
  return (
    <input
      name={name}
      type={type}
      placeholder={placeholder}
      required={required}
      step={step}
      className={`w-full rounded-chip border border-border bg-sunken px-3 py-2 text-xs text-ivory placeholder:text-faint focus:border-gold/50 outline-none transition-colors duration-200 ${cls ?? ''}`}
    />
  );
}
