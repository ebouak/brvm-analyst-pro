'use client';

import { useState } from 'react';
import { fmtDateFR, fmtFcfa, fmtNumber } from '@/lib/format';
import { paperTradingService } from '@/lib/paper-trading/service';
import type { PaperFill, PaperOrder } from '@/lib/paper-trading/types';

interface OrdersTableProps {
  orders: PaperOrder[];
  fills: PaperFill[];
  onOrdersChanged: () => Promise<void>;
}

const ACTIVE_STATUSES = new Set(['pending', 'partial', 'waiting_data']);

const STATUS_LABELS: Record<PaperOrder['status'], string> = {
  pending: 'En attente',
  partial: 'Partiellement exécuté',
  filled: 'Exécuté · simulation',
  expired: 'Expiré',
  cancelled: 'Annulé',
  waiting_data: 'En attente des données',
};

function modeLabel(mode: PaperOrder['mode']): string {
  return mode === 'boc_prudent' ? 'BOC prudent' : 'Fixing futur';
}

function reasonLabel(reason: string | null): string | null {
  if (!reason) return null;
  const labels: Record<string, string> = {
    price_limit_not_met: 'Cours limite non atteint',
    no_available_simulated_liquidity: 'Aucun volume simulable',
    validity_expired: 'Validité arrivée à terme',
    insufficient_reserved_cash: 'Liquidités réservées épuisées',
    reserved_shares_exhausted: 'Titres réservés épuisés',
    missing_or_invalid_fixing_or_volume: 'Fixing ou volume indisponible',
    missing_eligible_boc_snapshot: 'BOC admissible indisponible',
  };
  return labels[reason] ?? 'Évaluation en attente';
}

export function OrdersTable({ orders, fills, onOrdersChanged }: OrdersTableProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeOrders = orders.filter((order) => ACTIVE_STATUSES.has(order.status));
  const visibleOrders = showHistory
    ? orders.filter((order) => !ACTIVE_STATUSES.has(order.status))
    : activeOrders;

  async function cancelOrder(order: PaperOrder) {
    setCancellingId(order.id);
    setError(null);
    try {
      await paperTradingService.cancelOrder(order.id);
      await onOrdersChanged();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Impossible d’annuler cet ordre.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section aria-labelledby="paper-orders-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-info">Carnet personnel</p>
          <h2 id="paper-orders-title" className="mt-1 text-lg font-semibold text-white">Ordres simulés</h2>
        </div>
        <button
          type="button"
          aria-pressed={showHistory}
          onClick={() => setShowHistory((shown) => !shown)}
          className="rounded-md border border-border px-3 py-2 text-xs text-muted transition hover:text-white focus:outline-none focus:ring-2 focus:ring-info/50"
        >
          {showHistory ? 'Afficher les ordres actifs' : `Historique (${orders.length - activeOrders.length})`}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-down">{error}</p>}

      {visibleOrders.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center">
          <p className="font-medium text-white">
            {showHistory ? 'Aucun ordre terminé' : 'Aucun ordre en cours'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {showHistory
              ? 'Les ordres exécutés, expirés ou annulés apparaîtront ici.'
              : 'Créez un ordre pour simuler un achat ou une vente sur une séance future.'}
          </p>
        </div>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Ordres simulés, défilement horizontal"
          className="overflow-x-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
        >
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/40 text-left text-xs text-muted">
                <th className="px-3 py-3 font-semibold">Valeur / côté</th>
                <th className="px-3 py-3 font-semibold">Type / méthode</th>
                <th className="px-3 py-3 text-right font-semibold">Quantité</th>
                <th className="px-3 py-3 font-semibold">Avancement</th>
                <th className="px-3 py-3 font-semibold">Statut</th>
                <th className="px-3 py-3 font-semibold">Ordre créé</th>
                <th className="px-3 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => {
                const remaining = order.quantity - order.filledQuantity;
                const progress =
                  order.quantity > 0 ? (order.filledQuantity / order.quantity) * 100 : 0;
                const isActive = ACTIVE_STATUSES.has(order.status);
                return (
                  <tr key={order.id} className="border-b border-border/40 align-top last:border-0">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-white">{order.code}</p>
                      <p className={`mt-0.5 text-xs font-medium ${order.side === 'buy' ? 'text-up' : 'text-down'}`}>
                        {order.side === 'buy' ? 'Achat' : 'Vente'}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-white">{order.type === 'limit' ? 'Cours limité' : 'Au mieux'}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {order.limitPrice != null ? `${fmtFcfa(order.limitPrice)} · ` : ''}
                        {modeLabel(order.mode)}
                      </p>
                      {order.mode === 'boc_prudent' && order.bookSnapshot && (
                        <p className="mt-1 text-[11px] text-muted">
                          BOC du {fmtDateFR(order.bookSnapshot.date)}
                        </p>
                      )}
                      {order.lastEvaluatedDate && (
                        <p className="mt-1 text-[11px] text-muted">
                          Évalué le {fmtDateFR(order.lastEvaluatedDate)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular text-white">
                      {fmtNumber(order.quantity, 0)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-between gap-3 tabular text-xs text-muted">
                        <span>{fmtNumber(order.filledQuantity, 0)} / {fmtNumber(order.quantity, 0)} titres</span>
                        <span>{fmtNumber(remaining, 0)} restant{remaining === 1 ? '' : 's'}</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`Avancement de l’ordre ${order.code}`}
                        aria-valuemin={0}
                        aria-valuemax={order.quantity}
                        aria-valuenow={order.filledQuantity}
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
                      >
                        <div className="h-full rounded-full bg-info" style={{ width: `${progress}%` }} />
                      </div>
                      {order.side === 'buy' && isActive && (
                        <p className="mt-1.5 text-[11px] text-muted">
                          Réservé · {fmtFcfa(order.reservedCashRemaining)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${
                        order.status === 'filled'
                          ? 'border-up/30 bg-up/5 text-up'
                          : order.status === 'expired' || order.status === 'cancelled'
                            ? 'border-border text-muted'
                            : order.status === 'waiting_data'
                              ? 'border-info/30 bg-info/5 text-info'
                              : 'border-gold/30 bg-gold/5 text-gold'
                      }`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                      {order.reason && order.status === 'waiting_data' && (
                        <p className="mt-1 max-w-[190px] text-[11px] text-muted">
                          {reasonLabel(order.reason)}
                        </p>
                      )}
                      {order.reason && order.status !== 'waiting_data' && (
                        <p className="mt-1 max-w-[190px] text-[11px] text-muted">
                          {reasonLabel(order.reason)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-muted">
                      {fmtDateFR(order.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isActive && (
                        <button
                          type="button"
                          disabled={cancellingId === order.id}
                          aria-label={`Annuler l’ordre ${order.side === 'buy' ? 'd’achat' : 'de vente'} ${order.code}`}
                          onClick={() => cancelOrder(order)}
                          className="rounded border border-border px-2.5 py-1.5 text-xs text-muted transition hover:border-down/40 hover:text-down disabled:opacity-50"
                        >
                          {cancellingId === order.id ? 'Annulation…' : 'Annuler'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Exécutions simulées</h3>
          <p className="mt-0.5 text-xs text-muted">
            Remplissages estimés au fixing futur, jamais des exécutions réelles de la BRVM.
          </p>
        </div>
        {fills.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">Aucun remplissage enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-medium">Séance</th>
                  <th className="px-4 py-2.5 font-medium">Valeur</th>
                  <th className="px-4 py-2.5 text-right font-medium">Quantité</th>
                  <th className="px-4 py-2.5 text-right font-medium">Fixing simulé</th>
                  <th className="px-4 py-2.5 font-medium">Référence BOC</th>
                </tr>
              </thead>
              <tbody>
                {fills.map((fill) => (
                  <tr key={fill.id} className="border-t border-border/40">
                    <td className="px-4 py-2.5 text-xs text-muted">{fmtDateFR(fill.date)}</td>
                    <td className="px-4 py-2.5 font-semibold text-white">{fill.code}</td>
                    <td className="px-4 py-2.5 text-right tabular text-white">{fmtNumber(fill.quantity, 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular text-white">{fmtFcfa(fill.price)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      <span className="block font-medium text-info">
                        Estimation · {modeLabel(fill.mode)}
                      </span>
                      <span className="mt-1 block">
                        {fill.bookDate ? `BOC du ${fmtDateFR(fill.bookDate)}` : 'Sans BOC'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
