'use client';

import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, X } from 'lucide-react';
import { fmtFcfa, fmtNumber } from '@/lib/format';
import { formatBookDate, formatSpread } from '@/lib/paper-trading/bookPresentation';
import { paperTradingService } from '@/lib/paper-trading/service';
import type { PaperTradableAction, PaperOpenPosition } from '@/lib/paper-trading/types';
import type { PaperOrderSide } from '@/lib/paper-trading/orders';

interface OrderTicketProps {
  actions: PaperTradableAction[];
  sessionDate: string | null;
  cashAvailable: number;
  openPositions: PaperOpenPosition[];
  initialCode?: string;
  initialSide?: PaperOrderSide;
  initialQuantity?: number;
  onClose: () => void;
  onOrderPlaced: () => Promise<void>;
}

const fieldClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-info/50';

export function OrderTicket({
  actions,
  sessionDate,
  cashAvailable,
  openPositions,
  initialCode,
  initialSide = 'buy',
  initialQuantity,
  onClose,
  onOrderPlaced,
}: OrderTicketProps) {
  const [side, setSide] = useState<PaperOrderSide>(initialSide);
  const [code, setCode] = useState(initialCode ?? actions[0]?.code ?? '');
  const [quantity, setQuantity] = useState(initialQuantity?.toString() ?? '');
  const [orderType, setOrderType] = useState<'at_best' | 'limit'>('at_best');
  const [limitPrice, setLimitPrice] = useState('');
  const initialAction = actions.find((item) => item.code === (initialCode ?? actions[0]?.code));
  const initialOpposingQuantity =
    initialSide === 'buy'
      ? initialAction?.book?.sellQuantity
      : initialAction?.book?.buyQuantity;
  const initialHasBookLiquidity =
    initialOpposingQuantity != null &&
    Number.isSafeInteger(initialOpposingQuantity) &&
    initialOpposingQuantity > 0;
  const [mode, setMode] = useState<'fixing' | 'boc_prudent'>(
    initialAction?.book && initialHasBookLiquidity ? 'boc_prudent' : 'fixing',
  );
  const [validity, setValidity] = useState('5');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const position = openPositions.find((item) => item.code === code);
  const selectableActions =
    side === 'sell'
      ? actions.filter((item) =>
          openPositions.some((openPosition) => openPosition.code === item.code && openPosition.availableShares > 0),
        )
      : actions;
  const action = selectableActions.find((item) => item.code === code) ?? null;
  const sharesAvailable = position?.availableShares ?? 0;
  const parsedQuantity = Number(quantity);
  const isValidQuantity = Number.isSafeInteger(parsedQuantity) && parsedQuantity > 0;
  const parsedLimit = Number(limitPrice);
  const isValidLimit = Number.isFinite(parsedLimit) && parsedLimit > 0;
  const referencePrice = orderType === 'limit' ? parsedLimit : action?.cours_jour ?? null;
  const estimatedAmount =
    isValidQuantity && referencePrice != null && Number.isFinite(referencePrice)
      ? parsedQuantity * referencePrice
      : null;
  const opposingQuantity =
    side === 'buy' ? action?.book?.sellQuantity : action?.book?.buyQuantity;
  const canUseBook =
    action?.book != null &&
    opposingQuantity != null &&
    Number.isSafeInteger(opposingQuantity) &&
    opposingQuantity > 0;
  const hasReferenceQuote =
    action?.cours_jour != null &&
    Number.isFinite(action.cours_jour) &&
    action.cours_jour > 0;
  const spread = action?.book ? formatSpread(action.book) : null;
  const cannotAfford =
    side === 'buy' &&
    estimatedAmount != null &&
    estimatedAmount > cashAvailable;
  const cannotSell =
    side === 'sell' &&
    isValidQuantity &&
    parsedQuantity > sharesAvailable;
  const canSubmit =
    Boolean(action) &&
    hasReferenceQuote &&
    isValidQuantity &&
    (orderType !== 'limit' || isValidLimit) &&
    (mode !== 'boc_prudent' || canUseBook) &&
    !cannotAfford &&
    !cannotSell &&
    !submitting;

  async function submitOrder() {
    if (!action || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await paperTradingService.placeOrder({
        code: action.code,
        side,
        type: orderType,
        mode,
        quantity: parsedQuantity,
        limitPrice: orderType === 'limit' ? parsedLimit : null,
        expiresAfterSessions: Number(validity),
      });
      setQuantity('');
      await onOrderPlaced();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Impossible de créer cet ordre simulé.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="paper-order-ticket-title"
      className="overflow-hidden rounded-xl border border-info/30 bg-surface shadow-lg shadow-black/10"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-info">
            Simulation d’ordre
          </p>
          <h2 id="paper-order-ticket-title" className="mt-1 text-lg font-semibold text-white">
            Nouvel ordre
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le formulaire d’ordre"
          className="rounded-md p-1.5 text-muted transition hover:bg-elevated hover:text-white focus:outline-none focus:ring-2 focus:ring-info/50"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitOrder();
        }}
        className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-bg p-1">
            <button
              type="button"
              aria-pressed={side === 'buy'}
              onClick={() => {
                setSide('buy');
                if (!actions.some((item) => item.code === code)) setCode(actions[0]?.code ?? '');
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                side === 'buy' ? 'bg-up/15 text-up' : 'text-muted hover:text-white'
              }`}
            >
              <ArrowDownLeft size={16} aria-hidden="true" />
              Acheter
            </button>
            <button
              type="button"
              aria-pressed={side === 'sell'}
              onClick={() => {
                setSide('sell');
                if (!openPositions.some((item) => item.code === code && item.availableShares > 0)) {
                  setCode(
                    openPositions.find((item) => item.availableShares > 0)?.code ?? '',
                  );
                }
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                side === 'sell' ? 'bg-down/15 text-down' : 'text-muted hover:text-white'
              }`}
            >
              <ArrowUpRight size={16} aria-hidden="true" />
              Vendre
            </button>
          </div>

          <div>
            <label htmlFor="paper-order-code" className="mb-1.5 block text-xs font-medium text-muted">
              Valeur BRVM
            </label>
            <select
              id="paper-order-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={fieldClass}
            >
              <option value="">Choisir une valeur</option>
              {selectableActions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} · {item.designation ?? item.code}
                </option>
              ))}
            </select>
            {side === 'sell' && selectableActions.length === 0 && (
              <p className="mt-1.5 text-xs text-muted">Aucun titre disponible à la vente.</p>
            )}
            {actions.length === 0 && (
              <p className="mt-1.5 text-xs text-muted">
                Aucun cours de séance n’est disponible pour créer un ordre.
              </p>
            )}
            {action?.cours_jour != null && (
              <p className="mt-1.5 text-xs text-muted">
                Dernier fixing connu · {sessionDate ? formatBookDate(sessionDate) : 'date indisponible'} ·{' '}
                <span className="tabular text-white">{fmtFcfa(action.cours_jour)}</span>
              </p>
            )}
            {action && !hasReferenceQuote && (
              <p role="alert" className="mt-1.5 text-xs text-down">
                Aucun fixing positif disponible pour réserver cet ordre.
              </p>
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Type d’ordre</span>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['at_best', 'Au mieux'],
                ['limit', 'À cours limité'],
              ] as const).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={orderType === type}
                  onClick={() => setOrderType(type)}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    orderType === type
                      ? 'border-info/50 bg-info/10 text-info'
                      : 'border-border bg-bg text-muted hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {orderType === 'limit' && (
            <div>
              <label htmlFor="paper-order-limit" className="mb-1.5 block text-xs font-medium text-muted">
                Cours limite (FCFA)
              </label>
              <input
                id="paper-order-limit"
                type="number"
                min="1"
                step="1"
                inputMode="decimal"
                value={limitPrice}
                onChange={(event) => setLimitPrice(event.target.value)}
                placeholder="Ex. 12 500"
                className={fieldClass}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="paper-order-quantity" className="mb-1.5 block text-xs font-medium text-muted">
                Quantité (titres)
              </label>
              <input
                id="paper-order-quantity"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Ex. 10"
                className={fieldClass}
              />
              {side === 'sell' && (
                <p className="mt-1.5 text-xs text-muted">
                  Disponible à la vente : <span className="tabular text-white">{fmtNumber(sharesAvailable, 0)}</span>
                </p>
              )}
            </div>
            <div>
              <label htmlFor="paper-order-validity" className="mb-1.5 block text-xs font-medium text-muted">
                Validité
              </label>
              <select
                id="paper-order-validity"
                value={validity}
                onChange={(event) => setValidity(event.target.value)}
                className={fieldClass}
              >
                <option value="1">1 séance</option>
                <option value="5">5 séances</option>
                <option value="10">10 séances</option>
                <option value="20">20 séances</option>
              </select>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">Règle de simulation</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={mode === 'fixing'}
                onClick={() => setMode('fixing')}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  mode === 'fixing'
                    ? 'border-info/50 bg-info/10 text-info'
                    : 'border-border bg-bg text-muted hover:text-white'
                }`}
              >
                Fixing futur
              </button>
              <button
                type="button"
                aria-pressed={mode === 'boc_prudent'}
                disabled={!canUseBook}
                onClick={() => setMode('boc_prudent')}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  mode === 'boc_prudent'
                    ? 'border-info/50 bg-info/10 text-info'
                    : 'border-border bg-bg text-muted hover:text-white'
                }`}
              >
                BOC prudent
              </button>
            </div>
          </div>

          {cannotAfford && (
            <p role="alert" className="text-xs text-down">
              Liquidités disponibles insuffisantes pour couvrir l’estimation de {fmtFcfa(estimatedAmount ?? 0)}.
            </p>
          )}
          {cannotSell && (
            <p role="alert" className="text-xs text-down">
              La quantité dépasse vos titres disponibles après réservation des autres ordres.
            </p>
          )}
          {mode === 'boc_prudent' && !canUseBook && (
            <p role="alert" className="text-xs text-down">
              Le BOC ne fournit pas de quantité résiduelle exploitable pour ce côté. Choisissez le fixing futur.
            </p>
          )}
          {error && <p role="alert" className="text-sm text-down">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              side === 'buy'
                ? 'bg-up text-bg hover:bg-up/90'
                : 'bg-down text-bg hover:bg-down/90'
            }`}
          >
            {submitting ? 'Enregistrement…' : `Simuler l’ordre ${side === 'buy' ? 'd’achat' : 'de vente'}`}
          </button>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-bg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Carnet publié</p>
                {action?.book ? (
                  <p className="mt-1 text-sm font-medium text-white">
                    BOC · {formatBookDate(action.book.date)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted">Aucun bulletin disponible pour cette valeur.</p>
                )}
              </div>
              {action?.book && (
                <span className="rounded border border-border px-2 py-1 text-[10px] font-medium text-muted">
                  Repère historique
                </span>
              )}
            </div>
            {action?.book && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-up/20 bg-up/5 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-up">Meilleure limite achat</p>
                    <p className="mt-1 tabular text-sm font-semibold text-white">
                      {action.book.buyAtMarket ? 'Au marché' : action.book.buyPrice == null ? '—' : fmtFcfa(action.book.buyPrice)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Qté résiduelle · {action.book.buyQuantity == null ? '—' : fmtNumber(action.book.buyQuantity, 0)}
                    </p>
                  </div>
                  <div className="rounded-md border border-down/20 bg-down/5 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-down">Meilleure limite vente</p>
                    <p className="mt-1 tabular text-sm font-semibold text-white">
                      {action.book.sellAtMarket ? 'Au marché' : action.book.sellPrice == null ? '—' : fmtFcfa(action.book.sellPrice)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Qté résiduelle · {action.book.sellQuantity == null ? '—' : fmtNumber(action.book.sellQuantity, 0)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="text-muted">Écart entre les deux limites</span>
                  {spread ? (
                    <span className="tabular text-white">
                      {fmtFcfa(spread.amount)} · {fmtNumber(spread.percent, 2)} %
                    </span>
                  ) : (
                    <span className="text-muted">Indisponible</span>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="rounded-lg border border-info/20 bg-info/5 p-4">
            <p className="text-xs font-semibold text-info">Avant de confirmer</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {mode === 'boc_prudent'
                ? 'La simulation plafonne le remplissage selon la quantité opposée du BOC daté ci-dessus, puis le volume de séance.'
                : 'L’ordre sera évalué sur les séances futures au fixing publié ; il ne s’agit pas d’une exécution BRVM.'}
            </p>
            <div className="mt-3 space-y-1.5 border-t border-info/15 pt-3 text-xs">
              {side === 'buy' ? (
                <>
                  <div className="flex items-center justify-between gap-3 text-muted">
                    <span>Liquidités disponibles</span>
                    <span className="tabular text-white">{fmtFcfa(cashAvailable)}</span>
                  </div>
                  {estimatedAmount != null && isValidQuantity && (
                    <div className="flex items-center justify-between gap-3 text-muted">
                      <span>Après réservation estimée</span>
                      <span className={`tabular ${cannotAfford ? 'text-down' : 'text-white'}`}>
                        {fmtFcfa(cashAvailable - estimatedAmount)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between gap-3 text-muted">
                  <span>Titres libres à vendre</span>
                  <span className="tabular text-white">{fmtNumber(sharesAvailable, 0)}</span>
                </div>
              )}
            </div>
            {estimatedAmount != null && isValidQuantity && (
              <p className="mt-3 text-xs text-muted">
                Montant indicatif · <span className="tabular font-semibold text-white">{fmtFcfa(estimatedAmount)}</span>
              </p>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Le BOC ne révèle que la meilleure limite et sa quantité résiduelle, pas toute la file d’ordres.
            </p>
          </div>
        </aside>
      </form>
    </section>
  );
}
