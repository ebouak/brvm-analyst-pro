'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fmtNumber, fmtFcfa } from '@/lib/format';
import { paperTradingService } from '@/lib/paper-trading/service';
import { Account, Position, OpenPosition, Stats } from '@/lib/paper-trading/types';
import { PaperTradingJournal } from './PaperTradingJournal';
import { AnimatedValue } from '@/components/AnimatedValue';

interface TradableAction { code: string; designation: string | null; cours_jour: number | null }

export function PaperTradingDashboard() {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tradable, setTradable] = useState<TradableAction[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    try {
      const [posData, statsData] = await Promise.all([
        paperTradingService.getPositions(),
        paperTradingService.getStats(),
      ]);
      setPositions(posData.positions);
      setAccount(posData.account);
      setStats(statsData.stats);
    } catch (err) {
      console.error('Failed to load paper trading data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Fermeture de la modale à la touche Échap
  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowModal(false); setError(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  async function openModal() {
    setError(null);
    setShowModal(true);
    if (tradable.length === 0) {
      try {
        const res = await fetch('/api/paper-trading/tradable');
        const json = await res.json();
        setTradable(json.actions ?? []);
      } catch {
        setError('Impossible de charger la liste des actions.');
      }
    }
  }

  async function handleOpen() {
    if (!selectedCode) return;
    setBusy(true);
    setError(null);
    try {
      const amt = parseFloat(amountInput);
      const code = selectedCode;
      const { reinforced } = await paperTradingService.openPosition(code, Number.isFinite(amt) && amt > 0 ? amt : undefined);
      setShowModal(false);
      setSelectedCode('');
      setAmountInput('');
      await load();
      setSuccess(reinforced ? `Position renforcée sur ${code} ✓` : `Position ouverte sur ${code} ✓`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'ouverture");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose(id: string) {
    setBusy(true);
    try {
      await paperTradingService.closePosition(id);
      await load();
    } catch (err) {
      console.error('close failed', err);
    } finally {
      setBusy(false);
    }
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

  // Build equity curve from closed positions
  const equityCurve = positions
    .filter((p) => p.status === 'closed')
    .sort(
      (a, b) =>
        new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime()
    )
    .reduce(
      (acc: any[], pos) => {
        const prevEquity =
          acc.length > 0 ? acc[acc.length - 1].equity : account.capital_initial;
        return [
          ...acc,
          {
            date: new Date(pos.exit_date!).toLocaleDateString('fr-FR'),
            equity: prevEquity + pos.pnl,
          },
        ];
      },
      []
    );

  // L'API enrichit les positions ouvertes (current_price/current_value, pnl = latent).
  const openPositions = positions.filter((p) => p.status === 'open') as OpenPosition[];
  const closedPositions = positions.filter((p) => p.status === 'closed');

  // P&L latent des positions ouvertes (valorisées au cours courant par l'API).
  const latentPnl = openPositions.reduce((s, p) => s + (typeof p.pnl === 'number' ? p.pnl : 0), 0);
  const equityTotal = account.capital_current + latentPnl;
  const totalPnl = account.pnl_total + latentPnl;

  return (
    <div className="space-y-8">
      {/* Bannière de confirmation */}
      {success && (
        <div role="status" className="rounded-lg border border-up/40 bg-up/10 px-4 py-2.5 text-sm font-medium text-up">
          {success}
        </div>
      )}

      {/* En-tête pédagogique */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <details className="group min-w-0 flex-1">
          <summary className="cursor-pointer list-none text-sm font-medium text-info marker:content-none">
            <span className="underline decoration-dotted underline-offset-4">Comment ça marche ?</span>
          </summary>
          <ol className="mt-3 max-w-2xl space-y-1.5 text-xs text-muted">
            <li>
              <span className="text-white">1.</span> Vous ouvrez une position fictive — par défaut
              10 % de votre capital simulé, converti en titres au cours du jour.
            </li>
            <li>
              <span className="text-white">2.</span> Tant qu'elle est ouverte, votre gain ou perte
              est <span className="text-info">latent</span> : il varie chaque jour avec le cours,
              rien n'est encore acquis.
            </li>
            <li>
              <span className="text-white">3.</span> Quand vous fermez la position, le gain ou la
              perte devient <span className="text-info">réalisé</span> : il s'inscrit définitivement
              dans votre performance.
            </li>
          </ol>
        </details>
        <button
          type="button"
          onClick={openModal}
          className="bg-info hover:bg-info/90 text-bg font-medium px-4 py-2 rounded-lg transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-info/50"
        >
          + Ouvrir une position fictive
        </button>
      </div>

      {/* Modale ouverture */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => { setShowModal(false); setError(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ouvrir une position"
            onClick={(e) => e.stopPropagation()}
            className="bg-elevated border border-border rounded-xl p-6 w-full max-w-md space-y-4"
          >
            <h3 className="text-lg font-semibold text-white">Ouvrir une position</h3>
            <div className="space-y-2">
              <label className="text-xs text-muted">Action</label>
              <select
                aria-label="Choisir une action à acheter"
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-info/50"
              >
                <option value="">— Choisir une action —</option>
                {tradable.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} — {a.designation ?? ''} ({fmtNumber(a.cours_jour)} FCFA)
                  </option>
                ))}
              </select>
              {account && selectedCode && (() => {
                const a = tradable.find((x) => x.code === selectedCode);
                if (!a?.cours_jour) return null;
                const parsed = parseFloat(amountInput);
                const montant = Number.isFinite(parsed) && parsed > 0 ? parsed : account.capital_current * 0.1;
                const titres = Math.floor(montant / a.cours_jour);
                const investiReel = titres * a.cours_jour;
                const dejaOuverte = openPositions.some((p) => p.code === selectedCode);
                return (
                  <div className="space-y-2">
                    <label className="block text-xs text-muted">Montant à investir (FCFA)</label>
                    <input
                      type="number" min="0" step="1000"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      placeholder={`Défaut : ${Math.round(account.capital_current * 0.1).toLocaleString('fr-FR')} (10 % du capital)`}
                      aria-label="Montant à investir en FCFA"
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-info/50"
                    />
                    <p className="text-xs text-muted">
                      <span className="text-white tabular">{titres}</span> titre{titres > 1 ? 's' : ''} au cours de{' '}
                      <span className="text-white tabular">{fmtNumber(a.cours_jour)}</span> FCFA
                      {titres > 0 && investiReel !== montant && (
                        <> · investi réel <span className="text-white tabular">{fmtFcfa(investiReel)}</span> FCFA</>
                      )}
                    </p>
                    {titres < 1 && (
                      <p className="text-xs text-down">Montant insuffisant pour acheter au moins 1 titre.</p>
                    )}
                    {dejaOuverte && (
                      <p className="text-xs text-info">ℹ️ Position déjà ouverte : cet achat la renforcera (prix moyen pondéré).</p>
                    )}
                  </div>
                );
              })()}
            </div>
            {error && <p className="text-xs text-down">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowModal(false); setError(null); }}
                className="px-4 py-2 rounded-lg border border-border text-muted hover:text-white transition text-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-border"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!selectedCode || busy}
                onClick={handleOpen}
                className="px-4 py-2 rounded-lg bg-info text-bg font-medium disabled:opacity-40 transition text-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-info/50"
              >
                {busy ? 'Ouverture…' : 'Ouvrir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-muted mb-1">Valeur du portefeuille</div>
          <div className="text-2xl font-semibold text-white tabular">
            <AnimatedValue value={equityTotal} format={{ maximumFractionDigits: 0 }} suffix={' FCFA'} />
          </div>
          <div className="text-xs text-muted mt-1">
            Liquidités {fmtFcfa(account.capital_current)} · investi {fmtFcfa(equityTotal - account.capital_current)}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-muted mb-1">Performance totale</div>
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
          <div className="text-xs text-muted mb-1">Taux de réussite</div>
          <div className="text-2xl font-semibold text-info tabular">
            {stats ? fmtNumber(stats.winRate, 1) : '0'}%
          </div>
          <div className="text-xs text-muted mt-1">
            {stats ? `${stats.winningTrades}/${stats.totalTrades} trades gagnants` : 'aucun trade fermé'}
          </div>
        </div>
      </div>

      {/* Equity Curve */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Courbe de performance
        </h3>
        {equityCurve.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232733" />
              <XAxis dataKey="date" stroke="#8b93a7" />
              <YAxis stroke="#8b93a7" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161922',
                  border: '1px solid #232733',
                }}
                labelStyle={{ color: '#e6e9f0' }}
                formatter={(value) => fmtFcfa(value as number)}
              />
              <Line
                type="monotone"
                dataKey="equity"
                stroke="#56D7FD"
                isAnimationActive={false}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : openPositions.length > 0 ? (
          /* Pas encore de trade fermé : on montre le P&L latent par position. */
          <ResponsiveContainer width="100%" height={Math.max(160, openPositions.length * 56)}>
            <BarChart
              layout="vertical"
              data={openPositions.map((p) => ({ code: p.code, pnl: Math.round((p as { pnl?: number }).pnl ?? 0) }))}
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
                  <Cell key={p.code} fill={((p as { pnl?: number }).pnl ?? 0) >= 0 ? '#3fe18b' : '#ff6b6b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted text-center py-8">Aucune position ni trade pour l’instant.</p>
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
          onClose={handleClose}
          busy={busy}
        />
      </div>
    </div>
  );
}
