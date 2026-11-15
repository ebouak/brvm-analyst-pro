# BRVM Paper Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace immediate simulated buys/sells with auditable paper orders evaluated on future BRVM fixings, and use the dated Bulletin Officiel de la Cote (BOC) as a clearly labelled conservative liquidity input.

**Architecture:** Keep a pure TypeScript evaluator for deterministic order rules, persist orders and fills in owner-scoped tables, and perform all balance/reservation/fill mutations through service-role server routes and locked SQL functions. Evaluate lazily when the signed-in user requests the paper-trading dashboard, using only market sessions after order submission; the evaluator is idempotent and can be retried safely.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase PostgreSQL/RLS, Vitest, existing `brvm_actions_daily` and `brvm_carnet_daily` market data.

**Status (2026-11-15):** Individual order flow and UI are implemented and
rebased on `main` through migration `0243`. All 3,138 frontend tests, typecheck
and lint pass. A pre-merge review found
that settlement and reservation reads could truncate at PostgREST's 1,000-row
limit; both now paginate, with regressions for 1,001 active orders. Migration
`0244` is applied and recorded on the linked production project. RLS is enabled, owner
SELECT policies are present, anonymous REST reads/writes return 401, and the
four mutation RPCs are executable only by `service_role`; the security advisor
reports no finding for these new objects. The original implementation build
passed; CI/build and preview checks for the pagination follow-up are pending.
The migration ledger had a pre-existing gap
(`0147`–`0243` were not recorded although later schema objects exist); avoid
`supabase db push` until that history is reconciled. Teams and establishment
challenges are intentionally out of scope for this lot.

## Global Constraints

- The product does not submit real BRVM orders and never labels an estimated simulation as an actual execution.
- The BOC is dated, published after the session, and contains only the published best limits and residual quantities; it is not a full timestamped queue or live feed.
- For BOC-prudent orders, the server snapshots the latest eligible BOC and its `collecte_at` on order creation; later re-scrapes cannot rewrite what that order knew.
- The fixing mode fills at the next eligible published fixing if the order price condition is met.
- The BOC-prudent mode fills at that fixing and caps simulated quantity at the minimum of order quantity remaining, opposing residual quantity from the BOC available when the order was submitted, total traded volume for the evaluated session, and the shares or cash reserved to the order.
- A missing required quote, volume, or prior BOC quantity is an explicit waiting-for-data state; zero opposing quantity produces no fill.
- There are no invented participation percentages, commissions, taxes, tick sizes, short sales, or leverage.
- Market metrics and ownership are written only server-side; lock account rows for placement, cancellation, and fills; enforce RLS on every new user-scoped table.
- Order evaluation must never use market data from a session on or before the order's submission session.
- Preserve existing account and position data and make the new order flow compatible with the legacy tables during migration.
- Use the existing frontend commands: `npm test -- lib/paper-trading/orders.test.ts`, `npm run typecheck`, and `npm run build`.

---

## Scope and Follow-on Plans

This plan is the first independently verifiable subproject: personal paper orders,
the BOC context and the individual dashboard. It does not create teams,
institution workspaces, member invitations, coaches, or team scoring. Those are
separate subsystems requiring their own reviewed plans after the order engine
and data model are stable. Do not silently add those tables to the order
migration.

## File Structure

- Create `frontend/lib/paper-trading/orders.ts`: pure order and execution types,
  order price checks, freshness guards and deterministic fill calculation.
- Create `frontend/lib/paper-trading/orders.test.ts`: table-driven tests for
  price, volume, BOC, expiration and temporal rules.
- Create `supabase/migrations/0244_paper_trading_orders.sql`: orders/fills
  schema, owner read policies, server-only mutation grants, and transactional
  placement/cancellation/fill RPCs. Migration 0243 is the latest on `main`.
- Create `frontend/app/api/paper-trading/orders/route.ts`: authenticated order
  list/create endpoints, request validation, session-derived user ID and
  explicit errors.
- Create `frontend/app/api/paper-trading/orders/[id]/cancel/route.ts`:
  authenticated cancellation endpoint that can cancel only the caller's open
  order.
- Modify `frontend/app/api/paper-trading/tradable/route.ts`: return a fresh
  reference quote and each action's last BOC snapshot, including `collecte_at`,
  using the existing pagination helper rather than relying on PostgREST's
  1,000-row default.
- Create `frontend/lib/paper-trading/ordersServer.ts`: server-only data reads,
  order evaluation orchestration and RPC result/error mapping.
- Modify `frontend/app/api/paper-trading/positions/route.ts`: run the user's
  idempotent settlement before returning positions and include current cash and
  reservations without trusting client-supplied identity; retire its legacy
  immediate-open POST with an explicit 405.
- Modify `frontend/app/api/paper-trading/positions/[id]/close/route.ts`: retire
  the legacy immediate-close POST with an explicit 405; closing now requires a
  simulated sell order.
- Modify `frontend/lib/paper-trading/types.ts`: define paper orders, fills and
  BOC context response types; add reserved/available share quantities to the
  server-enriched open-position type.
- Modify `frontend/lib/paper-trading/service.ts`: typed methods for listing,
  submitting and cancelling orders.
- Create `frontend/components/paper-trading/OrderTicket.tsx`: accessible buy/sell
  order ticket, fixing/BOC mode, limit and quantity inputs, cash/title preview,
  dated BOC context and explicit simulation disclosure.
- Create `frontend/components/paper-trading/OrdersTable.tsx`: pending, partial,
  filled, expired and cancelled order history with dates and source labels.
- Modify `frontend/components/PaperTradingDashboard.tsx`: compose the order
  ticket and order history; refresh balances, positions and orders after
  mutations; replace the immediate-close action with a sell-order action.
- Modify `frontend/components/PaperTradingJournal.tsx`: replace immediate
  position-close affordance with a callback that opens a sell ticket for the
  selected code and available shares.
- Modify `frontend/app/premium/paper-trading/page.tsx`: retain account creation
  and show the existing account dashboard plus the new order disclosures.
- Update `docs/REPORTS.md` or the existing paper-trading documentation section
  only if it describes immediate simulated execution as equivalent to an order.

## Interfaces

The pure evaluator exports:

```ts
export type PaperOrderSide = 'buy' | 'sell';
export type PaperOrderType = 'at_best' | 'limit';
export type PaperExecutionMode = 'fixing' | 'boc_prudent';
export type PaperOrderStatus =
  | 'pending'
  | 'partial'
  | 'filled'
  | 'expired'
  | 'cancelled'
  | 'waiting_data';

export interface PaperOrderForEvaluation {
  id: string;
  side: PaperOrderSide;
  type: PaperOrderType;
  mode: PaperExecutionMode;
  limitPrice: number | null;
  quantity: number;
  filledQuantity: number;
  expiresAfterSessions: number;
  evaluatedSessions: number;
  submittedAfter: string;
  createdAt: string;
  reservedCashRemaining: number;
  reservedSharesRemaining: number;
}

export interface PaperMarketSession {
  date: string;
  close: number | null;
  volume: number | null;
}

export interface PaperBookSnapshot {
  date: string;
  buyQuantity: number | null;
  buyPrice: number | null;
  sellQuantity: number | null;
  sellPrice: number | null;
  buyAtMarket: boolean;
  sellAtMarket: boolean;
  collectedAt: string;
}

export interface PaperOrderEvaluation {
  status: PaperOrderStatus;
  fillQuantity: number;
  fillPrice: number | null;
  evaluatedSessions: number;
  reason: string;
  evaluatedDate: string | null;
  bookDate: string | null;
}

export interface PaperOrder extends PaperOrderForEvaluation {
  userId: string;
  accountId: string;
  code: string;
  status: PaperOrderStatus;
  updatedAt: string;
  reason: string | null;
  bookSnapshot: PaperBookSnapshot | null;
}

export interface PaperOpenPosition extends OpenPosition {
  reservedShares: number;
  availableShares: number;
}

export interface PaperFill {
  id: string;
  orderId: string;
  date: string;
  quantity: number;
  price: number;
  mode: PaperExecutionMode;
  bookDate: string | null;
  createdAt: string;
}

export interface PlacePaperOrderInput {
  code: string;
  side: PaperOrderSide;
  type: PaperOrderType;
  mode: PaperExecutionMode;
  quantity: number;
  limitPrice: number | null;
  expiresAfterSessions: number;
}

export function validatePlacePaperOrder(input: unknown): PlacePaperOrderInput | null;

export function evaluatePaperOrder(
  order: PaperOrderForEvaluation,
  session: PaperMarketSession,
  priorBook: PaperBookSnapshot | null,
): PaperOrderEvaluation;
```

In the BOC-prudent mode, a buy uses `priorBook.sellQuantity`, and a sell uses
`priorBook.buyQuantity`. The BOC date must be no later than `submittedAfter`,
strictly earlier than the market session date, and `collectedAt` must be no
later than `createdAt`. The fill price is the current session fixing. The
computed quantity is capped by the remaining order quantity, opposing BOC
residual, current session volume, remaining reserved cash divided by fixing for
a buy, or reserved shares for a sell. Do not substitute the BOC limit price for
the fixing. A buy with no cash left after a partial fill is cancelled with an
explicit reason rather than left pending without a reservation.

The `ordersServer.ts` interface is server-only:

```ts
export async function listPaperOrders(userId: string): Promise<{
  orders: PaperOrder[];
  fills: PaperFill[];
}>;
export async function settlePaperOrders(userId: string): Promise<void>;
export async function placePaperOrder(
  userId: string,
  input: PlacePaperOrderInput,
): Promise<PaperOrder>;
export async function cancelPaperOrder(
  userId: string,
  orderId: string,
): Promise<void>;
```

The SQL placement RPC validates code/session/quantity and locks the caller's
account. It snapshots the latest BOC row with `date_marche <= submitted_after`
and `collecte_at <= created_at`; a row dated after the known market session or
collected after order creation is ineligible. Buy orders reserve
`quantity * submitted fixing reference price` for
`at_best`, or `quantity * limit_price` for `limit`; settlement may fill fewer
shares when the reserved cash cannot cover a higher fixing. Sell orders reserve
shares from open positions and cannot exceed unreserved holdings. Every fill
debits or releases the matching reservation in the same transaction.

## Implementation Tasks

### Task 1: Implement the pure evaluator

**Files:**
- Create: `frontend/lib/paper-trading/orders.ts`
- Test: `frontend/lib/paper-trading/orders.test.ts`

**Interfaces:**
- Consumes: the exported types in the File Structure section.
- Produces: `evaluatePaperOrder(order, session, priorBook)` with no Supabase,
  browser, current-time, or network dependency.

- [x] **Step 1: Write tests for the evaluation contract**

Create tests for:

```ts
it('does not evaluate a session on or before submission', () => {
  const result = evaluatePaperOrder(order({ submittedAfter: '2026-11-12' }),
    session({ date: '2026-11-12', close: 100, volume: 1000 }), null);
  expect(result).toMatchObject({ status: 'waiting_data', fillQuantity: 0 });
});

it('fills a buy limit only when the future fixing is at or below the limit', () => {
  expect(evaluatePaperOrder(order({ side: 'buy', type: 'limit', mode: 'fixing', limitPrice: 100 }),
    session({ date: '2026-11-13', close: 99, volume: 100 }), null).fillQuantity).toBe(10);
  expect(evaluatePaperOrder(order({ side: 'buy', type: 'limit', mode: 'fixing', limitPrice: 98 }),
    session({ date: '2026-11-13', close: 99, volume: 100 }), null).fillQuantity).toBe(0);
});

it('caps a prudent buy by remaining quantity, previously available BOC sell residual and session volume', () => {
  const result = evaluatePaperOrder(
    order({ side: 'buy', mode: 'boc_prudent', quantity: 50, filledQuantity: 5, submittedAfter: '2026-11-13',
      createdAt: '2026-11-13T21:00:00Z' }),
    session({ date: '2026-11-14', close: 99, volume: 20 }),
    book({ date: '2026-11-13', collectedAt: '2026-11-13T20:00:00Z', sellQuantity: 12 }),
  );
  expect(result).toMatchObject({ status: 'partial', fillQuantity: 12, fillPrice: 99, bookDate: '2026-11-13' });
});

it('caps an au-mieux buy at the shares affordable from its cash reservation', () => {
  const result = evaluatePaperOrder(
    order({ reservedCashRemaining: 499 }),
    session({ close: 100 }),
    null,
  );
  expect(result).toMatchObject({ status: 'cancelled', fillQuantity: 4, fillPrice: 100 });
});
```

Define complete local builders in the test file:

```ts
const order = (overrides: Partial<PaperOrderForEvaluation> = {}): PaperOrderForEvaluation => ({
  id: 'order-1', side: 'buy', type: 'at_best', mode: 'fixing',
  limitPrice: null, quantity: 10, filledQuantity: 0,
  expiresAfterSessions: 5, evaluatedSessions: 0,
  submittedAfter: '2026-11-12', createdAt: '2026-11-12T20:00:00Z',
  reservedCashRemaining: 2_000, reservedSharesRemaining: 0,
  ...overrides,
});
const session = (overrides: Partial<PaperMarketSession> = {}): PaperMarketSession => ({
  date: '2026-11-13', close: 100, volume: 100, ...overrides,
});
const book = (overrides: Partial<PaperBookSnapshot> = {}): PaperBookSnapshot => ({
  date: '2026-11-12', collectedAt: '2026-11-12T19:00:00Z',
  buyQuantity: 20, buyPrice: 99, sellQuantity: 20, sellPrice: 101,
  buyAtMarket: false, sellAtMarket: false, ...overrides,
});
```

Also test that a BOC collected after order creation is rejected even when its
session date is otherwise eligible, as well as a BOC collected before order
creation on the same `submittedAfter` session. Test sell-side limit direction, au-mieux fixing execution, absent/null
volume, absent BOC, zero opposing quantity, crossed/future BOC dates, BOC on the
submission session, unfilled valid limits, prior partial fills, and expiry.
Use small local helper builders with complete default objects; do not cast
partial objects to `PaperOrderForEvaluation`.

Test `validatePlacePaperOrder` with non-object input, malformed/unknown fields,
codes outside `^[A-Z]{3,5}$`, fractional or non-positive quantities, unknown
side/type/mode, limit order without a positive limit, au-mieux with a limit,
and validity outside 1–20. Assert it returns `null` rather than a partial or
success-shaped fallback.

- [x] **Step 2: Run the targeted tests and confirm they fail**

Run from `frontend`:

```powershell
npm test -- lib/paper-trading/orders.test.ts
```

Expected: FAIL because `orders.ts` and `evaluatePaperOrder` do not yet exist.

- [x] **Step 3: Implement only the pure evaluator**

Implement exhaustive status handling and deterministic validation. Return
`waiting_data` for missing required quote, volume or eligible BOC; `pending`
when the price condition is not met; `partial` or `filled` according to the
capped quantity; `expired` when an unfilled eligible session reaches validity;
and `cancelled` when a buy's cash reservation cannot support any remaining
share. On the final eligible session, any unfilled remainder expires even if
that session produced a partial fill; retain the fill quantity and expose the
expiry reason. Return the updated `evaluatedSessions` count with each
evaluation; `waiting_data` leaves it unchanged, and each eligible session
increments it exactly once. Reject invalid non-positive prices/quantities at
the boundary rather than converting them into plausible fills.

- [x] **Step 4: Run and pass the evaluator tests**

Run:

```powershell
npm test -- lib/paper-trading/orders.test.ts
```

Expected: PASS for every order mode and edge case. Do not proceed if a test
passes only by replacing missing data with zero or the entry price.

### Task 2: Add owner-scoped order and fill storage

**Files:**
- Create: `supabase/migrations/0244_paper_trading_orders.sql`
- Create: `frontend/lib/paper-trading/ordersServer.ts`
- Test: `frontend/lib/paper-trading/orders.test.ts` (add mapping/idempotency
  tests for pure result normalization if extracted)

**Interfaces:**
- Consumes: `evaluatePaperOrder` and existing
  `paper_trading_accounts`, `paper_trading_positions`,
  `brvm_actions_daily`, and `brvm_carnet_daily`.
- Produces: order/fill tables and server-only placement, settlement and
  cancellation operations described in Interfaces.

- [x] **Step 1: Add schema and privilege assertions**

Create `paper_trading_orders` with UUID ID; owner/account/code foreign keys;
validated side/type/mode/status; positive integer quantity; nullable positive
limit; filled/remaining quantities; submission-session date; validity/
evaluation counters and last evaluated session date; reserved cash/shares;
explicit waiting reason; timestamps;
and nullable snapshot columns for BOC date, collection timestamp, buy/sell
residual quantities, best buy/sell prices and market-order flags. The snapshot
columns are written only at order creation. Create
`paper_trading_fills` with order ID, unique `(order_id, date_marche)`, positive
quantity/price, fixing date, optional earlier BOC date and a simulation method.
Enable RLS and give authenticated users SELECT only on their own order/fill
rows. Revoke client `INSERT`, `UPDATE` and `DELETE`; mutation functions are
`SECURITY DEFINER`, pin `search_path`, and revoke execute from
`public, anon, authenticated`, granting only `service_role`.

Use the existing project migration conventions and add comments that the
records are simulated and BOC values are dated indicators.

- [x] **Step 2: Add transactional RPCs**

Implement server-only RPCs for:

1. placing an order: lock `paper_trading_accounts`; check account ownership
   passed by the authenticated server route, valid instrument/current fixing,
   available cash or unreserved shares, limit/reference price and validity;
   read and copy the last eligible BOC snapshot; insert an order with a fixed
   `submitted_after` session and reserve the required amount/titles;
2. cancelling: lock account and order, require owner and a pending/partial
   state, release only the remaining reservation, then mark cancelled;
3. settling one evaluated fill: lock account, open position and order; re-read
   the market fixing, volume and the order's immutable BOC snapshot; reject any
   proposed fill whose date, price or quantity does not match server-side data;
   reject duplicate `(order_id, date_marche)`; recheck current remaining
   reservation and holdings; insert fill, update remaining quantity/status and
   positions, release surplus reservation on final state, and return a typed
   result.
4. marking a data wait: lock account and order, write an explicit waiting
   reason without consuming validity or marking the session evaluated.

Use these exact signatures (the RPCs are callable only from the service-role
server client):

```sql
public.paper_placer_ordre(
  p_user uuid, p_code text, p_side text, p_type text, p_mode text,
  p_quantity bigint, p_limit_price numeric, p_expires_after_sessions integer
) returns jsonb

public.paper_annuler_ordre(p_user uuid, p_order_id uuid) returns jsonb

public.paper_appliquer_remplissage(
  p_user uuid, p_order_id uuid, p_date_marche date,
  p_quantity bigint, p_price numeric, p_mode text
) returns jsonb

public.paper_marquer_attente_donnees(
  p_user uuid, p_order_id uuid, p_date_marche date, p_reason text
) returns jsonb
```

`paper_appliquer_remplissage` must verify `p_price` against the stored close for
`p_date_marche`, require the session date to follow `submitted_after`, cap
quantity against remaining shares/cash, the immutable BOC snapshot and that
session's volume, and enforce the stored limit before writing. It calculates
the actual accepted quantity itself instead of trusting a proposed client
quantity and verifies `p_mode` matches the order's stored mode.
`last_evaluated_date` prevents retries from consuming the same validity
session more than once, including sessions that produced no fill. If required
source data is absent, `paper_marquer_attente_donnees` records the waiting
state but advances neither the session counter nor `last_evaluated_date`. The
existing
`paper_ouvrir_position` RPC remains inaccessible to authenticated clients under
migration 0182; the legacy browser endpoints return 405 so new positions can
only be created through the order flow. Keep existing position rows readable
and sellable through the new order API.

A sell fill creates a closed position row for the filled quantity and realized
P&L, and reduces the open position by the same quantity inside the same
transaction. A buy fill increases the open position at weighted-average
purchase price and deducts its exact simulated cost from available cash. After
each sell fill, recompute `pnl_total`, `pnl_pct` and `capital_current` from all
closed positions and the original capital using the existing account
conventions; do not add P&L twice on retry.
Reject all state transitions that do not match an open/partial order.

- [x] **Step 3: Build the server-only orchestration**

`settlePaperOrders(userId)` reads the account's pending/partial orders and
market rows strictly after each order's `submitted_after` session. For every
candidate session, read its close and volume and reconstruct the BOC snapshot
stored on that order at creation. Call the pure evaluator, then pass
its proposed fill to the transactional fill RPC. Do not trust an RPC quantity
or price returned by the browser. Stop at expiry; preserve explicit waiting
states when required source rows are absent. Sort sessions ascending and orders
by their server-created timestamp then ID for deterministic retries.

- [x] **Step 4: Verify migration shape and server typecheck**

Run from `frontend`:

```powershell
npm run typecheck
```

Expected: PASS. Review the migration for grants to all three client roles,
explicit owner SELECT policies, unique fill idempotency, and locked balance
updates. Migration `0244` was applied through the linked Supabase Management
API and recorded with `supabase migration repair`; production RLS, RPC grants
and anonymous REST behavior were then checked directly.

### Task 3: Expose authenticated order APIs

**Files:**
- Create: `frontend/app/api/paper-trading/orders/route.ts`
- Create: `frontend/app/api/paper-trading/orders/[id]/cancel/route.ts`
- Modify: `frontend/app/api/paper-trading/positions/route.ts`
- Modify: `frontend/lib/paper-trading/ordersServer.ts`
- Modify: `frontend/lib/paper-trading/types.ts`
- Modify: `frontend/lib/paper-trading/service.ts`

**Interfaces:**
- Consumes: server-only operations from Task 2.
- Produces: authenticated GET/POST orders, POST cancel, typed `PaperOrder` and
  `PaperFill` responses, and positions response refreshed after settlement.

- [x] **Step 1: Validate request and response types**

Validate `code`, `side`, `type`, `mode`, `quantity`, `limit_price`, and
`expires_after_sessions` at the route boundary. Accept only the enum values in
the public types, integer share quantities greater than zero, a positive limit
only for `limit`, and a validity between 1 and 20 market sessions. For
`at_best`, require `limit_price` to be null. Reject malformed JSON and return
explicit 400 errors; resolve the owner exclusively with `createClient().auth.getUser()`.

- [x] **Step 2: Implement route tests or pure route validators**

Add pure validation tests adjacent to `orders.test.ts` covering invalid side,
market order with a price, limit order without a price, zero/fractional
quantity, unsupported mode, validity outside 1–20 and malformed data. Keep
Supabase route I/O outside the pure validator.

- [x] **Step 3: Implement create/list/cancel endpoints and retire legacy writes**

The create route calls the placement RPC with `user.id`, not a body owner ID.
The list route queries only orders/fills visible under owner RLS. The cancel
route validates the route UUID and calls the cancellation RPC after session
authentication. Return 401 unauthenticated, 404 for another user's/nonexistent
order, 409 for terminal orders, 400 for invalid orders and 500 with logged
server diagnostics for database failures; never return a success-shaped empty
fallback on failed queries. Change POST `/positions` and POST
`/positions/[id]/close` to return 405 with a JSON message directing clients to
the order endpoint. Keep GET `/positions` and all existing position records.

- [x] **Step 4: Settle before returning dashboard state**

In the positions GET route, call `settlePaperOrders(user.id)` after
authentication and before reading positions. Propagate settlement failures as
logged 500 errors. Add reserved cash and reserved shares to a dedicated
portfolio summary; do not alter the meaning of the existing
`capital_current` field or silently net reservations into it.

- [x] **Step 5: Run typecheck and targeted tests**

Run:

```powershell
npm test -- lib/paper-trading/orders.test.ts
npm run typecheck
```

Expected: both pass. Inspect every error branch to ensure failed reads and RPC
errors are surfaced.

### Task 4: Add the order ticket, BOC panel and order history

**Files:**
- Create: `frontend/components/paper-trading/OrderTicket.tsx`
- Create: `frontend/components/paper-trading/OrdersTable.tsx`
- Modify: `frontend/components/PaperTradingDashboard.tsx`
- Modify: `frontend/components/PaperTradingJournal.tsx`
- Modify: `frontend/app/premium/paper-trading/page.tsx`
- Modify: `frontend/lib/paper-trading/service.ts`
- Modify: `frontend/lib/paper-trading/types.ts`

**Interfaces:**
- Consumes: authenticated order service and dated BOC context from the
  tradable/order API response.
- Produces: an order ticket with explicit simulated-order semantics and an
  auditable table of user orders/fills; existing portfolio remains visible.

- [x] **Step 1: Add UI formatting and interaction tests**

Test pure view-model helpers for:

```ts
expect(formatBookDate('2026-11-13')).toContain('13');
expect(formatSpread({ buyPrice: 100, sellPrice: 105 })).toEqual({
  amount: 5,
  percent: expect.closeTo(5, 5),
});
expect(formatSpread({ buyPrice: null, sellPrice: 105 })).toBeNull();
```

The UI must label BOC session date, show quantities only when non-null, show a
spread only when both limit prices exist, and label simulated/estimated fills.
Do not label BOC data “temps réel”, “carnet complet” or “ordres exécutés”.

- [x] **Step 2: Implement accessible order ticket**

Provide side (achat/vente), type (au mieux/limité), simulation mode, code,
quantity, optional limit and validity. For sells, show only server-reported unreserved shares; a client preview never
replaces the locked reservation check.
Preview available cash/titles and the BOC residuals/date before submission.
Disable impossible submissions, but retain server validation. Include the
disclosure that fills are simulated at a future fixing and BOC residuals are
indicative, not a queue guarantee. Show server errors inline and preserve input
on failure.

- [x] **Step 3: Implement order history**

Group orders by pending/partial and terminal state; display order date,
evaluation date, source BOC date, requested/filled/remaining quantity, fixing
price, status and reason. Show estimated fill badges for BOC-prudent fills.
Offer cancellation only for pending/partial orders and require no extra
confirmation for a cancel request beyond the explicit button label.

- [x] **Step 4: Wire portfolio actions to orders**

Replace immediate buy submission in `PaperTradingDashboard` with
`OrderTicket`. Replace `PaperTradingJournal` immediate close with a sell-order
prefill for that security and no more than available unreserved shares. Keep
the old position rows and realized/latent P&L display intact. Refresh account,
positions, stats and orders after placement, cancellation or settlement.
Remove `openPosition` and `closePosition` from the client service once the
order flow is wired, so no page can continue to submit an immediate simulation.

- [ ] **Step 5: Run frontend validation**

Run:

```powershell
npm test -- lib/paper-trading/orders.test.ts
npm run typecheck
npm run build
```

Expected: all commands pass. Check empty portfolio, no BOC, missing quote,
waiting order, partial fill, full fill, failed submit and mobile-width ticket.

### Task 5: Update product documentation and verify migration security

**Files:**
- Modify: `docs/REPORTS.md` only if it contains paper-trading behavior that is
  now inaccurate; otherwise no documentation edit is needed because this plan
  and the design spec document the feature.
- Test: manual authenticated/anonymous API checks against a migration-applied
  local or staging Supabase project.

**Interfaces:**
- Consumes: all Tasks 1–4.
- Produces: evidence that ownership, order states, user-facing wording and
  market-data freshness match the design.

- [ ] **Step 1: Run focused unit and project validation**

Run from `frontend`:

```powershell
npm test -- lib/paper-trading/orders.test.ts
npm run typecheck
npm run build
```

Expected: all PASS.

The pagination regressions and full frontend suite (3,138 tests), typecheck,
and lint pass. Re-run the production build on the final revision before marking
this step complete.

- [x] **Step 2: Verify RLS and server-only writes**

On the production project, both tables have RLS enabled and authenticated-only
owner SELECT policies; `anon` has no table access, `authenticated` has no write
grants, and `service_role` has the server write grants. Public REST GET/POST/
PATCH/DELETE requests all returned 401. All four RPCs deny `anon` and
`authenticated` and allow `service_role`. The Supabase security advisor reported
no finding for the new orders/fills tables or RPCs; it did report pre-existing
warnings on unrelated objects. Cross-account mutation was not exercised with
production user data.

- [x] **Step 3: Verify simulation invariants**

With deterministic fixtures, verify a same-session fixing never fills a newly
submitted order; a prior BOC can only affect the next eligible session; missing
or zero volume cannot create a fill; filled cash and shares reconcile with
positions; multiple retries create one fill; invalid or terminal cancellation
is rejected; cash and holdings never become negative.

- [x] **Step 4: Check for unrelated worktree changes**

Run:

```powershell
git status --short
git --no-pager diff --check -- frontend supabase/migrations/0244_paper_trading_orders.sql docs
```

Expected: no whitespace errors in task files. Unrelated pre-existing worktree
changes may remain; do not stage or clean them.

## Self-Review

- Spec coverage: individual orders, both execution modes, BOC date/quantities,
  execution provenance, no short selling/leverage, server-only mutation,
  idempotency, user privacy, UI, empty/missing-data states and migration tests
  map to Tasks 1–5.
- The plan explicitly excludes team and establishment storage/UI; those require
  separate implementation plans and must not be implied as delivered by this
  first lot.
- No placeholder execution formula remains: BOC-prudent quantity is the minimum
  of remaining order quantity, opposing prior BOC residual and evaluated-session
  volume. It is labelled as an estimate and is not shared across virtual users.
- No fees or BRVM tick increments are invented.
- The order's submission session and BOC date checks prevent look-ahead.
- Account locks and unique fill keys provide concurrency and retry safety.
- Existing immediate close and buy flows are replaced only after the new
  equivalent UI is wired, preserving legacy positions and account data.
