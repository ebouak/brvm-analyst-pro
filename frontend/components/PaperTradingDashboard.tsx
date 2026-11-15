'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import { paperTradingService } from '@/lib/paper-trading/service';
import type {
  Account,
  PaperFill,
  PaperOrder,
  PaperOpenPosition,
  PaperPosition,
  PaperTradableAction,
  Stats,
} from '@/lib/paper-trading/types';
import type { PaperOrderSide } from '@/lib/paper-trading/orders';
import { PaperTradingJournal } from './PaperTradingJournal';
import { InfoTip } from '@/components/paper-trading/InfoTip';
import { AnimatedValue } from '@/components/AnimatedValue';
import { OrderTicket } from '@/components/paper-trading/OrderTicket';
import { OrdersTable } from '@/components/paper-trading/OrdersTable';

export function PaperTradingDashboard() {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [cashAvailable, setCashAvailable] = useState<number | null>(null);
  const [cashReserved, setCashReserved] = useState<number | null>(null);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [fills, setFills] = useState<PaperFill[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOrderTicket, setShowOrderTicket] = useState(false);
  const [tradable, setTradable] = useState<PaperTradableAction[]>([]);
  const [sessionDate, setSessionDate] = useState<string | null>(null);
  const [tradableLoaded, setTradableLoaded] = useState(false);
  const [tradableLoading, setTradableLoading] = useState(false);
  const [tradableError, setTradableError] = useState<string | null>(null);
  const [ticketPrefill, setTicketPrefill] = useState<{
    code?: string;
    side: PaperOrderSide;
    quantity?: number;
  }>({ side: 'buy' });
  const [ticketKey, setTicketKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Courbe : équité réalisée seule, ou valeur du portefeuille (latent inclus).
  const [curveWithLatent, setCurveWithLatent] = useState(false);
  // Période affichée sur la courbe : jour (7j) / mois (30j) / année (365j) / tout.
  const [curvePeriod, setCurvePeriod] = useState<'J' | 'M' | 'A' | 'Tout'>('Tout');

  async function load() {
    try {
      setError(null);
      const posData = await paperTradingService.getPositions();
      setPositions(posData.positions);
      setAccount(posData.account);
      setCashAvailable(posData.cashAvailable);
      setCashReserved(posData.cashReserved);
      const [statsData, ordersData] = await Promise.all([
        paperTradingService.getStats(),
        paperTradingService.getOrders(),
      ]);
      setStats(statsData.stats);
      setOrders(ordersData.orders);
      setFills(ordersData.fills);
    } catch (err) {
      console.error('Failed to load paper trading data:', err);
      setError(err instanceof Error ? err.message : 'Impossible de charger le portefeuille simulé.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openOrderTicket(
    intent: { code?: string; side: PaperOrderSide; quantity?: number } = { side: 'buy' },
  ) {
    setError(null);
    setShowOrderTicket(true);
    setTicketPrefill(intent);
    setTicketKey((key) => key + 1);
    if (!tradableLoaded) {
      setTradableLoading(true);
      setTradableError(null);
      try {
        const data = await paperTradingService.getTradable();
        setTradable(data.actions);
        setSessionDate(data.sessionDate);
        setTradableLoaded(true);
      } catch (loadError) {
        setTradableError(
          loadError instanceof Error ? loadError.message : 'Impossible de charger les valeurs BRVM.',
        );
      } finally {
        setTradableLoading(false);
      }
    }
  }

  async function handleOrderPlaced() {
    await load();
    setSuccess('Ordre simulé enregistré. Il sera évalué sur les séances futures.');
    window.setTimeout(() => setSuccess(null), 5000);
  }

  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-4 space-y-3">
              <div className="animate-pulse h-3 w-24 bg-border rounded" />
              <div className="animate-pulse h-7 w-32 bg-border rounded" />
            </div>
          ))}
        </div>
        <div className="animate-pulse bg-surface border border-border rounded-lg h-72" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-muted text-center py-8">
        Compte non initialisé
      </div>
    );
  }

  // Construit la courbe d'équité à partir des trades fermés, en conservant le
  // timestamp (pour le filtre de période) et un point de départ (capital initial).
  type CurvePoint = { ts: number; date: string; equity: number };
  const closedSorted = positions
    .filter((p) => p.status === 'closed')
    .sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime());

  const equityCurve: CurvePoint[] = closedSorted.reduce((acc: CurvePoint[], pos) => {
    const prevEquity = acc.length > 0 ? acc[acc.length - 1].equity : account.capital_initial;
    const d = new Date(pos.exit_date!);
    acc.push({
      ts: d.getTime(),
      date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      equity: prevEquity + pos.pnl,
    });
    return acc;
  }, []);

  // Point d'origine : capital de départ, daté du premier trade.
  const originPoint: CurvePoint | null =
    equityCurve.length > 0
      ? {
          ts: new Date(closedSorted[0].entry_date).getTime(),
          date: 'Départ',
          equity: account.capital_initial,
        }
      : null;

  // L'API enrichit les positions ouvertes (current_price/current_value, pnl = latent).
  const openPositions = positions.filter(
    (position): position is PaperOpenPosition => position.status === 'open',
  );
  const closedPositions = positions.filter((position) => position.status === 'closed');

  // P&L latent des positions ouvertes (valorisées au cours courant par l'API).
  const latentPnl = openPositions.reduce((s, p) => s + (typeof p.pnl === 'number' ? p.pnl : 0), 0);
  const equityTotal = account.capital_current + latentPnl;
  const totalPnl = account.pnl_total + latentPnl;

  // Fenêtre temporelle selon la période choisie (J=7j, M=30j, A=365j, Tout).
  const periodDays: Record<typeof curvePeriod, number | null> = { J: 7, M: 30, A: 365, Tout: null };
  const windowMs = periodDays[curvePeriod] != null ? periodDays[curvePeriod]! * 86_400_000 : null;
  const cutoff = windowMs != null ? Date.now() - windowMs : 0;

  // Courbe affichée : origine (capital de départ) + trades fermés filtrés par
  // période, puis éventuel point « Aujourd'hui » incluant le P&L latent.
  const filteredCurve = windowMs != null ? equityCurve.filter((p) => p.ts >= cutoff) : equityCurve;
  const displayedCurve: CurvePoint[] = [
    ...(originPoint && (windowMs == null || originPoint.ts >= cutoff) ? [originPoint] : []),
    ...filteredCurve,
    ...(curveWithLatent && openPositions.length > 0
      ? [{ ts: Date.now(), date: "Aujourd'hui", equity: account.capital_initial + totalPnl }]
      : []),
  ];
  // Gains cumulés sur la courbe affichée (dernier point − capital de départ).
  const curveGain =
    displayedCurve.length > 0 ? displayedCurve[displayedCurve.length - 1].equity - account.capital_initial : 0;

  return (
    <div className="space-y-8">
      {/* Bannière de confirmation */}
      {success && (
        <div role="status" className="rounded-lg border border-up/40 bg-up/5 px-4 py-2.5 text-sm font-medium text-up">
          {success}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-info">
            Marché réel · argent fictif
          </p>
          <h2 className="mt-1 text-base font-semibold text-white">Simulez des ordres BRVM</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Les ordres sont évalués sur les séances futures. Le mode BOC prudent utilise uniquement
            la meilleure limite publiée et sa quantité résiduelle, pas une file complète ni du temps réel.
          </p>
          <details className="group mt-3">
            <summary className="cursor-pointer list-none text-xs font-medium text-info marker:content-none">
              <span className="underline decoration-dotted underline-offset-4">Comment ça marche ?</span>
            </summary>
            <ol className="mt-2 max-w-2xl space-y-1.5 text-xs text-muted">
              <li>
                <span className="text-white">1.</span> Vous choisissez un achat ou une vente simulée
                et définissez la quantité, le type d&apos;ordre et sa durée de validité.
              </li>
              <li>
                <span className="text-white">2.</span> L&apos;ordre est évalué après sa création sur les
                séances BRVM futures; aucune exécution n&apos;est garantie.
              </li>
              <li>
                <span className="text-white">3.</span> Le mode BOC prudent s&apos;appuie sur la meilleure
                limite et la quantité résiduelle publiées, sans prétendre représenter le carnet complet.
              </li>
            </ol>
          </details>
        </div>
        <button
          type="button"
          onClick={() => void openOrderTicket()}
          className="shrink-0 rounded-lg bg-info px-4 py-2.5 text-sm font-semibold text-bg transition hover:bg-info/90 focus:outline-none focus:ring-2 focus:ring-info/50"
        >
          Nouvel ordre
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-down/30 bg-down/5 px-4 py-3 text-sm text-down">
          {error}
        </p>
      )}

      {showOrderTicket && (
        tradableLoading ? (
          <div className="animate-pulse rounded-xl border border-border bg-surface p-6 text-sm text-muted" aria-busy="true">
            Chargement des cours et du dernier BOC disponible…
          </div>
        ) : tradableError ? (
          <div className="rounded-xl border border-down/30 bg-down/5 p-5">
            <p role="alert" className="text-sm text-down">{tradableError}</p>
            <button
              type="button"
              onClick={() => {
                setTradableLoaded(false);
                void openOrderTicket(ticketPrefill);
              }}
              className="mt-3 rounded border border-border px-3 py-2 text-xs text-white hover:bg-elevated"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <OrderTicket
            key={ticketKey}
            actions={tradable}
            sessionDate={sessionDate}
            cashAvailable={cashAvailable ?? 0}
            openPositions={openPositions}
            initialCode={ticketPrefill.code}
            initialSide={ticketPrefill.side}
            initialQuantity={ticketPrefill.quantity}
            onClose={() => setShowOrderTicket(false)}
            onOrderPlaced={handleOrderPlaced}
          />
        )
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-muted mb-1 inline-flex items-center gap-1">
            Valeur du portefeuille
            <InfoTip label="Liquidités libres, sommes réservées aux ordres en attente et valeur actuelle des positions ouvertes." />
          </div>
          <div className="text-2xl font-semibold text-white tabular">
            <AnimatedValue value={equityTotal} format={{ maximumFractionDigits: 0 }} suffix={' FCFA'} />
          </div>
          <div className="text-xs text-muted mt-1">
            Disponible {fmtFcfa(cashAvailable ?? 0)} · réservé aux ordres {fmtFcfa(cashReserved ?? 0)}
          </div>
          <div className="text-xs text-muted">
            Valeur des positions {fmtFcfa(Math.max(0, equityTotal - (cashAvailable ?? 0) - (cashReserved ?? 0)))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-muted mb-1 inline-flex items-center gap-1">
            Performance totale
            <InfoTip label="Somme de vos gains/pertes réalisés (trades fermés) et latents (positions encore ouvertes)." />
          </div>
          <div
            className={`text-2xl font-semibold tabular ${
              totalPnl >= 0 ? 'text-up' : 'text-down'
            }`}
          >
            <AnimatedValue value={totalPnl} format={{ maximumFractionDigits: 0 }} suffix={' FCFA'} signed />
          </div>
          <div className="text-xs text-muted mt-1">
            dont réalisé {fmtFcfa(account.pnl_total)} · latent{' '}
            <span className={latentPnl >= 0 ? 'text-up' : 'text-down'}>
              {latentPnl >= 0 ? '+' : ''}
              {fmtFcfa(latentPnl)}
            </span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-muted mb-1 inline-flex items-center gap-1">
            Taux de réussite
            <InfoTip label="Part de vos trades fermés terminés en gain." />
          </div>
          <div className="text-2xl font-semibold text-info tabular">
            {stats ? fmtNumber(stats.winRate, 1) : '0'}%
          </div>
          <div className="text-xs text-muted mt-1">
            {stats ? `${stats.winningTrades}/${stats.totalTrades} trades gagnants` : 'aucun trade fermé'}
          </div>
        </div>
      </div>

      <OrdersTable
        orders={orders}
        fills={fills}
        onOrdersChanged={load}
      />

      {/* Equity Curve */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-white">Courbe de performance</h3>
            {equityCurve.length > 0 && (
              <p className="mt-0.5 text-xs text-muted">
                Capital de départ {fmtFcfa(account.capital_initial)} ·{' '}
                <span className={curveGain >= 0 ? 'text-up' : 'text-down'}>
                  {curveGain >= 0 ? 'gain' : 'perte'} {curveGain >= 0 ? '+' : ''}
                  {fmtFcfa(curveGain)}
                </span>
              </p>
            )}
          </div>
          {equityCurve.length > 0 && (
            <div className="flex flex-col items-end gap-2">
              {openPositions.length > 0 && (
                <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                  <button
                    type="button"
                    aria-pressed={!curveWithLatent}
                    onClick={() => setCurveWithLatent(false)}
                    className={`px-3 py-1.5 transition ${!curveWithLatent ? 'bg-info text-bg' : 'text-muted hover:text-white'}`}
                  >
                    Équité réalisée
                  </button>
                  <button
                    type="button"
                    aria-pressed={curveWithLatent}
                    onClick={() => setCurveWithLatent(true)}
                    className={`px-3 py-1.5 transition ${curveWithLatent ? 'bg-info text-bg' : 'text-muted hover:text-white'}`}
                  >
                    Valeur portefeuille
                  </button>
                </div>
              )}
              <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                {(['J', 'M', 'A', 'Tout'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={curvePeriod === p}
                    onClick={() => setCurvePeriod(p)}
                    className={`px-3 py-1.5 transition ${curvePeriod === p ? 'bg-info text-bg' : 'text-muted hover:text-white'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {equityCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={displayedCurve} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#56D7FD" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#56D7FD" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#232733" vertical={false} />
              <XAxis dataKey="date" stroke="#8b93a7" tick={{ fontSize: 11 }} />
              <YAxis
                stroke="#8b93a7"
                tick={{ fontSize: 11 }}
                width={72}
                domain={['auto', 'auto']}
                tickFormatter={(v) => fmtFcfa(v as number)}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#161922', border: '1px solid #232733' }}
                labelStyle={{ color: '#e6e9f0' }}
                formatter={(value) => [fmtFcfa(value as number), 'Équité']}
              />
              <ReferenceLine
                y={account.capital_initial}
                stroke="#8b93a7"
                strokeDasharray="4 4"
                label={{ value: 'Départ', position: 'insideTopLeft', fill: '#8b93a7', fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#56D7FD"
                strokeWidth={2}
                fill="url(#equityFill)"
                isAnimationActive={false}
                dot={{ r: 2, fill: '#56D7FD' }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : openPositions.length > 0 ? (
          /* Pas encore de trade fermé : on montre le P&L latent par position. */
          <ResponsiveContainer width="100%" height={Math.max(160, openPositions.length * 56)}>
            <BarChart
              layout="vertical"
              data={openPositions.map((p) => ({ code: p.code, pnl: Math.round(p.pnl) }))}
              margin={{ left: 12, right: 24, top: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#232733" horizontal={false} />
              <XAxis type="number" stroke="#8b93a7" tickFormatter={(v) => fmtFcfa(v as number)} />
              <YAxis type="category" dataKey="code" stroke="#8b93a7" width={56} />
              <Tooltip
                contentStyle={{ backgroundColor: '#161922', border: '1px solid #232733' }}
                labelStyle={{ color: '#e6e9f0' }}
                formatter={(value) => [fmtFcfa(value as number), 'P&L latent']}
              />
              <Bar dataKey="pnl" isAnimationActive={false}>
                {openPositions.map((p) => (
                  <Cell key={p.code} fill={p.pnl >= 0 ? '#3fe18b' : '#ff6b6b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted text-center py-8">Aucune position ni opération pour l’instant.</p>
        )}
        {equityCurve.length === 0 && openPositions.length > 0 && (
          <p className="mt-2 text-center text-xs text-faint">
            P&L latent des positions ouvertes. La courbe d’équité apparaîtra dès le premier trade clôturé.
          </p>
        )}
      </div>

      {/* Statistiques détaillées (repliées) */}
      {stats && stats.totalTrades > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-medium text-muted hover:text-white marker:content-none">
            <span className="underline decoration-dotted underline-offset-4">Statistiques détaillées</span>
          </summary>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-xs text-muted mb-1">Gain moyen</p>
              <p className={`text-lg font-semibold tabular ${stats.avgWin >= 0 ? 'text-up' : 'text-down'}`}>
                {fmtFcfa(stats.avgWin)}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-xs text-muted mb-1">Perte moyenne</p>
              <p className={`text-lg font-semibold tabular ${stats.avgLoss >= 0 ? 'text-up' : 'text-down'}`}>
                {fmtFcfa(stats.avgLoss)}
              </p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-xs text-muted mb-1">Meilleur trade</p>
              <p className="text-lg font-semibold text-up tabular">{fmtFcfa(stats.bestTrade)}</p>
            </div>
            <div className="bg-surface border border-border rounded-lg p-4">
              <p className="text-xs text-muted mb-1">Pire trade</p>
              <p className="text-lg font-semibold text-down tabular">{fmtFcfa(stats.worstTrade)}</p>
            </div>
          </div>
        </details>
      )}

      {/* Journal */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Journal de trades</h3>
        <PaperTradingJournal
          openPositions={openPositions}
          closedPositions={closedPositions}
          portfolioValue={equityTotal}
          onCreateSell={(code, quantity) =>
            void openOrderTicket({ code, side: 'sell', quantity })
          }
        />
      </div>
    </div>
  );
}
