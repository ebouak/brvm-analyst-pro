# Dossiers valeur à l’unité Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendre chaque dossier valeur WESTBOURSE à 1 500 FCFA avec un aperçu public de deux pages et un accès complet réservé aux membres Premium ou acheteurs du code concerné.

**Architecture:** Un produit Chariow générique porte le prix et le paiement ; la transaction WESTBOURSE conserve le code société et accorde un droit `dossier:<CODE>` après webhook signé. Le catalogue et l’article de presse sont publics, tandis que la route A4 existante et le PDF privé appliquent le même contrôle serveur central.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Supabase PostgreSQL/RLS, Chariow, Vitest et Playwright.

## Global Constraints

- Aucun screenshot, texte ou design tiers copié ; les pages visibles sont produites par WESTBOURSE.
- Prix unique et imposé côté serveur : 1 500 FCFA.
- Les pages 3 à 9 ne sont jamais rendues dans le HTML public.
- Premium ou droit exact `dossier:<CODE>` : aucune extension à un autre code.
- Le worker `x-dossier-render` garde seulement son accès à la route de génération.
- Aucun accès accordé avant signature et relecture du webhook Chariow.
- Design éditorial, A4 lisible, responsive, sans faux contenu ni donnée inventée.

---

### Task 1: Ajouter le modèle de droits dossier

**Files:**
- Create: `supabase/migrations/0209_dossiers_unite.sql`
- Modify: `frontend/lib/billing/chariow/regles.ts`
- Test: `frontend/tests/chariow-dossier.test.ts`

**Interfaces:**
- Consumes: catalogue `chariow_products`, transactions `billing_transactions`, droits `user_entitlements`.
- Produces: kind `dossier`, `billing_transactions.subject_code`, produit générique `dossier:a4`.

- [ ] **Step 1: Write the failing transaction-shape tests**

Add pure tests proving:

```ts
expect(valideCodeSujet('SNTS')).toBe('SNTS');
expect(valideCodeSujet('palc')).toBe('PALC');
expect(valideCodeSujet('../SNTS')).toBeNull();
expect(valideCodeSujet('A')).toBeNull();
```

- [ ] **Step 2: Run the focused tests**

Run: `cd frontend && npm test -- --run tests/chariow-dossier.test.ts`

Expected: FAIL because the subject-code validator does not exist.

- [ ] **Step 3: Add the migration**

Migration `0209_dossiers_unite.sql` must:

```sql
alter table public.billing_transactions
  add column if not exists subject_code text;

alter table public.billing_transactions
  add constraint billing_transactions_subject_code
  check (subject_code is null or subject_code ~ '^[A-Z0-9]{2,8}$');

alter table public.chariow_products drop constraint if exists chariow_products_kind_check;
alter table public.chariow_products
  add constraint chariow_products_kind_check
  check (kind in ('module', 'upgrade', 'pass', 'formation', 'dossier'));

alter table public.chariow_products drop constraint if exists chariow_products_forme;
alter table public.chariow_products
  add constraint chariow_products_forme check (
    (kind in ('module', 'upgrade') and niveau is not null and plan_code is null and cycle is null)
    or (kind in ('formation', 'dossier') and niveau is null and plan_code is null and cycle is null)
    or (kind = 'pass' and niveau is null and plan_code is not null and cycle is not null)
  );

insert into public.chariow_products (
  product_code, kind, libelle, amount, currency, active
) values (
  'dossier:a4', 'dossier',
  'Dossier valeur WESTBOURSE — 1 société', 1500, 'XOF', false
) on conflict (product_code) do nothing;
```

Replace `accorder_achat` so a `dossier` writes:

```sql
if prod.kind = 'dossier' then
  if t.subject_code is null then return 'code_sujet_absent'; end if;
  insert into public.user_entitlements (
    user_id, product_code, niveau, source, source_ref, transaction_id
  ) values (
    t.user_id, 'dossier:' || t.subject_code, null, 'chariow',
    coalesce(t.provider_sale_id, p_sale, t.id::text), t.id
  )
  on conflict (source, source_ref) where source_ref is not null do nothing;
  return 'dossier_accorde';
end if;
```

Keep every existing branch and permission revoke explicit.

- [ ] **Step 4: Add subject-code validation**

Create or extend a Chariow pure module with:

```ts
export function codeSujetValide(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{2,8}$/.test(code) ? code : null;
}
```

- [ ] **Step 5: Run focused tests and migration syntax checks**

Run: `cd frontend && npm test -- --run tests/chariow-dossier.test.ts`

Run: `git --no-pager diff --check`

Expected: tests PASS; no whitespace errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0209_dossiers_unite.sql frontend/tests/chariow-dossier.test.ts frontend/lib/billing/chariow
git commit -m "feat: add dossier entitlement model"
```

### Task 2: Sécuriser la lecture d’un dossier

**Files:**
- Create: `frontend/lib/dossier/acces.ts`
- Create: `frontend/lib/dossier/renderSecret.ts`
- Test: `frontend/lib/dossier/acces.test.ts`
- Modify: `frontend/app/api/dossier/[code]/pdf/route.ts`
- Modify: `frontend/app/rapports/dossier/[code]/page.tsx`
- Modify: `frontend/lib/supabase/middleware.ts`

**Interfaces:**
- Consumes: `getEntitlements()`, Supabase service client, `DossierValeur`.
- Produces: `accesDossier(code, deps?)`, `autoriserDossier(authorization, code)` and
  `secretRenduDossierValide(attendu, fourni)`.

- [ ] **Step 1: Write failing access tests**

```ts
expect(await accesDossier('SNTS', { premium:true, droits:[] })).toEqual({
  complet:true, motif:'premium'
});
expect(await accesDossier('SNTS', { premium:false, droits:['dossier:SNTS'] })).toEqual({
  complet:true, motif:'achete'
});
expect(await accesDossier('PALC', { premium:false, droits:['dossier:SNTS'] })).toEqual({
  complet:false, motif:'verrouille'
});
```

- [ ] **Step 2: Run focused tests**

Run: `cd frontend && npm test -- --run lib/dossier/acces.test.ts`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement the central resolver**

The resolver reads active, non-expired, non-revoked entitlements matching
`dossier:${code}` through the service client. It never silently grants on a
read error.

Create the render-secret comparison once in `renderSecret.ts` with the same
manual constant-time loop currently used by the middleware. Import it from both
the middleware and the A4 page instead of duplicating the comparison.

- [ ] **Step 4: Gate the PDF API and the A4 page**

In the PDF route, return `403` for a connected account without access. Keep
`401` for anonymous users and `404` for an absent PDF.

In the A4 page, allow the render worker header only through
`secretRenduDossierValide`; otherwise:

```ts
const acces = await accesDossier(code);
if (!acces.complet) redirect(`/analyses/dossiers/${code}`);
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
cd frontend
npm test -- --run lib/dossier/acces.test.ts
npm run typecheck
```

Expected: tests and typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/dossier frontend/app/api/dossier frontend/app/rapports/dossier
git commit -m "feat: gate dossier reports by exact entitlement"
```

### Task 3: Étendre le checkout au dossier choisi

**Files:**
- Modify: `frontend/lib/billing/chariow/regles.ts`
- Modify: `frontend/lib/billing/chariow/checkout.ts`
- Modify: `frontend/app/api/payments/chariow/checkout/route.ts`
- Modify: `frontend/lib/billing/chariow/catalogue.ts`
- Test: `frontend/tests/chariow-checkout-dossier.test.ts`

**Interfaces:**
- Consumes: `{ productCode: 'dossier:a4', subjectCode: 'SNTS', identity... }`.
- Produces: pending transaction with `product_code`, `subject_code`, amount 1500.

- [ ] **Step 1: Write failing checkout tests**

Cover:

```ts
expect(parseCheckout({... , productCode:'dossier:a4', subjectCode:'sn'}).error).toBeNull();
expect(parseCheckout({... , productCode:'dossier:a4'}).error).toBe('code société requis');
expect(parseCheckout({... , productCode:'dossier:a4', subjectCode:'../../'}).error).not.toBeNull();
```

- [ ] **Step 2: Run focused tests**

Run: `cd frontend && npm test -- --run tests/chariow-checkout-dossier.test.ts`

Expected: FAIL.

- [ ] **Step 3: Add request validation and freshness checks**

For `kind === 'dossier'`:

1. normalize `subjectCode`;
2. verify the company exists;
3. verify `dossier:a4` costs exactly 1500 XOF;
4. verify the private PDF has an object updated within three days;
5. refuse a user who already owns the entitlement;
6. insert `subject_code` in the pending transaction.

- [ ] **Step 4: Preserve the existing checkout contract**

The optional `subjectCode` field is ignored by pass/formation products and
required only for `dossier`.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
cd frontend
npm test -- --run tests/chariow-checkout-dossier.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/billing/chariow frontend/app/api/payments/chariow tests/chariow-checkout-dossier.test.ts
git commit -m "feat: checkout a selected dossier"
```

### Task 4: Construire le catalogue éditorial

**Files:**
- Create: `frontend/lib/dossier/catalogue.ts`
- Create: `frontend/lib/dossier/catalogue.test.ts`
- Create: `frontend/components/dossier/CatalogueDossiers.tsx`
- Create: `frontend/app/analyses/dossiers/page.tsx`

**Interfaces:**
- Consumes: `brvm_instruments`, `brvm_actions_daily`, private `dossiers` metadata.
- Produces: `CatalogueDossier[]` containing code, name, sector, date, available, freshness and URL.

- [ ] **Step 1: Write failing catalogue tests**

```ts
expect(catalogueDossiers([...], [...], now)).toMatchObject({
  0:{ code:'SNTS', achetable:true },
  1:{ code:'PALC', achetable:false }
});
```

Test missing PDFs, stale PDFs and stable sorting.

- [ ] **Step 2: Run focused tests**

Run: `cd frontend && npm test -- --run lib/dossier/catalogue.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement the pure catalogue selector**

The function refuses an unavailable PDF and never fabricates a company name,
sector or update date.

- [ ] **Step 4: Build the public catalogue page**

Use the premium editorial tokens already defined in `globals.css`. Render:

```tsx
<ArticleMasthead section="Recherche & valeur" />
<CatalogueDossiers items={items} />
```

Each card contains cover, code, designation, sector, date, state and 1 500 FCFA.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
cd frontend
npm test -- --run lib/dossier/catalogue.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/dossier/catalogue* frontend/components/dossier frontend/app/analyses/dossiers/page.tsx
git commit -m "feat: add dossier editorial catalogue"
```

### Task 5: Construire l’article d’aperçu et le paywall

**Files:**
- Create: `frontend/lib/dossier/apercu.ts`
- Create: `frontend/lib/dossier/apercu.test.ts`
- Create: `frontend/components/dossier/ApercuDossier.tsx`
- Create: `frontend/components/dossier/AchatDossier.tsx`
- Create: `frontend/app/analyses/dossiers/[code]/page.tsx`

**Interfaces:**
- Consumes: `buildDossier()`, exact access resolver, `AchatChariow` interaction pattern.
- Produces: a two-page public editorial preview and purchase UI.

- [ ] **Step 1: Write failing preview-contract tests**

```ts
const preview = construireApercu(dossier);
expect(preview.pages).toHaveLength(2);
expect(JSON.stringify(preview)).not.toContain('conclusion_complete');
```

Add tests for absent values and unavailable PDF.

- [ ] **Step 2: Run focused tests**

Run: `cd frontend && npm test -- --run lib/dossier/apercu.test.ts`

Expected: FAIL.

- [ ] **Step 3: Build the strict two-page payload**

`construireApercu(dossier)` returns only cover and key metrics. It cannot take a
full dossier in the browser. The page server receives the full object but
passes only the preview to client components.

- [ ] **Step 4: Implement editorial rendering**

The article includes masthead, headline, deck, byline, date, two A4 preview
panels, a locked-section divider, benefits, Premium option and purchase form.

```tsx
<ApercuDossier pages={preview.pages} />
<AchatDossier code={code} prix={1500} acces={acces} frais={frais} />
```

Never render `corps complet`, hidden text or a blurred copy of later pages.

- [ ] **Step 5: Connect checkout**

`AchatDossier` posts:

```json
{
  "productCode": "dossier:a4",
  "subjectCode": "SNTS",
  "firstName": "...",
  "lastName": "...",
  "phone": {
    "number": "...",
    "countryCode": "CI"
  }
}
```

On success it redirects to Chariow; on return it polls the exact entitlement
once, then links to the PDF.

- [ ] **Step 6: Run focused tests, typecheck and build**

Run:

```bash
cd frontend
npm test -- --run lib/dossier/apercu.test.ts
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/dossier/apercu* frontend/components/dossier/ApercuDossier.tsx frontend/components/dossier/AchatDossier.tsx frontend/app/analyses/dossiers
git commit -m "feat: sell dossier as editorial article"
```

### Task 6: Publier le SKU Chariow et raccorder le catalogue

**Files:**
- Modify production data: Chariow product and `chariow_products`.
- No source file.

- [ ] **Step 1: Create the Chariow product**

Create one hidden digital product named
`Dossier valeur WESTBOURSE — 1 société`, price 1500 XOF, no file delivery.
Copy its `prd_…` identifier.

- [ ] **Step 2: Activate the database row**

Update `chariow_products` where `product_code = 'dossier:a4'` with the Chariow
identifier and `active = true`. Verify amount 1500 and XOF from a read-back.

- [ ] **Step 3: Test checkout in isolation**

Using an authenticated test account, start the checkout for one valid code.
Verify the pending transaction has `subject_code` and 1500 XOF, then cancel at
Chariow before payment.

- [ ] **Step 4: Test webhook contract without granting production access**

Use Chariow's signed test event and the integration fixtures. Confirm an
unsigned request remains 401 and a replay remains idempotent.

### Task 7: Protéger les entrées existantes et vérifier bout en bout

**Files:**
- Modify: `frontend/app/actions/[code]/page.tsx`
- Modify: `frontend/app/societes/[code]/page.tsx`
- Modify: `frontend/middleware.ts` if the public route needs explicit allowance
- Test: `frontend/e2e/dossiers-payants.spec.ts`

- [ ] **Step 1: Update every dossier link**

All public action and society links point first to
`/analyses/dossiers/${code}`. Premium-only controls may still link directly to
the A4 route after access is known.

- [ ] **Step 2: Write Playwright coverage**

Cover:

1. anonymous visitor sees two preview pages and purchase CTA;
2. anonymous visitor receives 401 from PDF API;
3. connected free user receives 403;
4. a purchased code opens PDF;
5. the same user cannot open another code;
6. Premium opens any available dossier;
7. missing PDF shows unavailable state without checkout.

- [ ] **Step 3: Run the complete verification**

Run:

```bash
cd frontend
npm test
npm run typecheck
npm run build
npm run e2e -- e2e/dossiers-payants.spec.ts
```

Run the scraper tests too because dossier workers consume the same data:

```bash
cd scraper
npm test
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 4: Manual production checks**

Verify with three accounts:

- anonymous: preview only;
- free purchased SNTS: SNTS opens, PALC refuses;
- Premium: all PDFs open.

Verify signed PDF URLs expire and a direct request to private storage fails.

- [ ] **Step 5: Commit**

```bash
git add frontend/app frontend/e2e frontend/middleware.ts
git commit -m "test: cover paid dossier access end to end"
```
