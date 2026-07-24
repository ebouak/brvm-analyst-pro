# Passeport de donnée — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre visible, pour chaque exercice financier publié, d'où vient le chiffre — document source, date d'extraction, extracteur, conversion de devise éventuelle — via un panneau « Preuves » gratuit sur la fiche financière.

**Architecture:** Deux tables Supabase à granularité **exercice** (`provenance_exercice`) et **champ corrigé** (`correction_champ`). L'alimentation passe par `persistRows`, point de passage unique du pipeline d'extraction. Un module pur assemble le passeport à partir de données déjà chargées par la page ; aucune requête supplémentaire n'est ajoutée au rendu.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + RLS), TypeScript strict, tests purs `.test.mjs` via `npx tsx --test`.

---

## Contraintes d'environnement (à lire avant de commencer)

- **Ne JAMAIS lancer `npm run build`** — la commande part en arrière-plan et bloque la tâche. Le garde-fou est `npx tsc --noEmit` depuis `frontend/`, qui prend **~5 minutes** : prévoir un timeout de 540000 ms.
- **Les migrations SQL sont écrites dans le dépôt mais APPLIQUÉES PAR L'UTILISATEUR** (éditeur SQL Supabase ou MCP). Ne jamais supposer qu'une migration est active : les tâches suivantes doivent rester exécutables sans elle (les tests sont purs, sans base).
- Branche `main`, pas de worktree.
- Les tests purs se lancent depuis `frontend/` : `npx tsx --test lib/chemin/fichier.test.mjs`.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/0120_passeport_donnee.sql` | Crée `provenance_exercice` et `correction_champ` + RLS |
| `supabase/migrations/0121_amorcage_corrections.sql` | Réinjecte les 5 corrections des migrations 0115→0119 |
| `frontend/lib/provenance/passport.ts` | **Pur** : assemble un passeport, décide de la promotion `verifie` |
| `frontend/lib/provenance/passport.test.mjs` | Tests du module pur |
| `frontend/lib/provenance/queries.ts` | Charge les lignes de provenance d'une société |
| `frontend/lib/import/fullPersist.ts` | `persistRows` écrit aussi la provenance |
| `frontend/app/api/import-batch/route.ts` | Appelant : fournit `publicationId` + `extracteur` |
| `frontend/scripts/reextract.ts` | Appelant : idem |
| `frontend/components/provenance/PasseportPopover.tsx` | Pastille + panneau « Preuves » |
| `frontend/app/actions/[code]/financials/page.tsx` | Branche le composant |
| `frontend/lib/provenance/corrections.ts` | Journalise une correction et applique la promotion `verifie` |
| `frontend/scripts/backfill-provenance.ts` | Rattachement rétroactif des exercices existants |
| `frontend/scripts/verify-provenance.ts` | Intégrité + rapport de couverture |

---

### Task 1 : Migration des deux tables

**Files:**
- Create: `supabase/migrations/0120_passeport_donnee.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 0120 — Passeport de donnée : traçabilité des fondamentaux publiés.
--
-- Granularité par EXERCICE et non par champ : tous les chiffres d'un exercice
-- proviennent du même PDF, extraits par la même passe, avec la même confiance.
-- Le champ par champ ne garde sa valeur que pour les corrections ponctuelles,
-- d'où la seconde table.
--
-- Voir docs/superpowers/specs/2026-07-23-passeport-donnee-design.md

create table if not exists public.provenance_exercice (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  periode         text not null,
  table_cible     text not null check (table_cible in
                    ('income_statements','balance_sheets','cash_flow_statements')),
  publication_id  uuid references public.publications(id) on delete set null,
  extrait_le      timestamptz,
  extracteur      text,
  confiance       text not null default 'non_trace'
                    check (confiance in ('verifie','extrait','non_trace')),
  created_at      timestamptz not null default now(),
  unique (code, periode, table_cible)
);

comment on table public.provenance_exercice is
  'D''où vient un exercice financier : document source, passe d''extraction, niveau de confiance. Une ligne par (code, période, table).';
comment on column public.provenance_exercice.confiance is
  'verifie = recoupé contre une source externe citée ; extrait = extraction automatique ayant passé les garde-fous ; non_trace = provenance inconnue (affiché tel quel, jamais deviné).';

create index if not exists idx_provenance_code_periode
  on public.provenance_exercice (code, periode);

-- Corrections manuelles. STOCKÉ mais NON exposé (décision de cadrage) : l'actif
-- se constitue, l'affichage pourra être ouvert plus tard sans rien reconstruire.
create table if not exists public.correction_champ (
  id             uuid primary key default gen_random_uuid(),
  table_cible    text not null check (table_cible in
                   ('income_statements','balance_sheets','cash_flow_statements')),
  code           text not null,
  periode        text not null,
  champ          text not null,
  valeur_avant   numeric,
  valeur_apres   numeric,
  motif          text not null,
  source_externe text,
  corrige_le     timestamptz not null default now(),
  corrige_par    text
);

comment on column public.correction_champ.source_externe is
  'Source externe ayant permis de trancher (Sika Finance, Madis Invest, publication émetteur). NULL = correction technique interne, qui ne promeut PAS la confiance : réparer une erreur ne vérifie rien.';

create index if not exists idx_correction_code_periode
  on public.correction_champ (code, periode);

alter table public.provenance_exercice enable row level security;
alter table public.correction_champ    enable row level security;

-- La preuve est l'argument de confiance : lecture publique, aucune donnée personnelle.
drop policy if exists "provenance lecture publique" on public.provenance_exercice;
create policy "provenance lecture publique" on public.provenance_exercice
  for select using (true);

-- Écriture réservée au service_role. Révoquer depuis anon ET authenticated :
-- révoquer PUBLIC ne retire pas les grants nominatifs posés par Supabase.
revoke insert, update, delete on public.provenance_exercice from anon, authenticated;

-- correction_champ : aucune policy de lecture -> invisible hors service_role.
revoke all on public.correction_champ from anon, authenticated;
```

- [ ] **Step 2 : Vérifier qu'aucun numéro de migration n'entre en collision**

Run: `ls supabase/migrations/ | tail -3`
Expected: la dernière est `0119_ttls_resultat_net_2025.sql`, donc `0120` est libre.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/0120_passeport_donnee.sql
git commit -m "feat(passeport): migration des tables provenance_exercice et correction_champ"
```

- [ ] **Step 4 : Signaler à l'utilisateur que la migration attend son application**

Ne pas tenter de l'appliquer soi-même. Écrire dans le rapport de tâche : « Migration 0120 écrite, à appliquer via l'éditeur SQL Supabase. Les tâches suivantes ne la requièrent pas (tests purs). »

---

### Task 2 : Module pur `passport.ts` (TDD)

**Files:**
- Create: `frontend/lib/provenance/passport.ts`
- Test: `frontend/lib/provenance/passport.test.mjs`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `frontend/lib/provenance/passport.test.mjs` :

```js
import assert from 'node:assert';
import { buildPassport, doitPromouvoir } from './passport.ts';

// --- Cas réel ETIT 2025 : société publiant en USD, convertie au taux moyen ---
const pubEtit = {
  id: 'a1537a5b-9a59-4e64-a097-487f0919f651',
  libelle: 'Etats financiers IFRS - Exercice 2025 - ETI TG',
  date_publication: '2026-04-13',
  source_url: 'https://bfin.brvm.org/0/Communiques_emetteurs/20260413.pdf',
};
const provEtit = {
  code: 'ETIT', periode: '2025', table_cible: 'cash_flow_statements',
  publication_id: pubEtit.id, extrait_le: '2026-06-08T19:09:14.779Z',
  extracteur: 'deepseek-chat', confiance: 'extrait',
};

const etit = buildPassport(provEtit, pubEtit, { devise_origine: 'USD', taux_conversion: 581.834 });
assert.equal(etit.confiance, 'extrait');
assert.equal(etit.document.libelle, 'Etats financiers IFRS - Exercice 2025 - ETI TG');
assert.equal(etit.document.datePublication, '2026-04-13');
assert.ok(etit.document.url.startsWith('https://'));
assert.equal(etit.extracteur, 'deepseek-chat');
assert.deepEqual(etit.conversion, { devise: 'USD', taux: 581.834 });

// --- Exercice sans conversion : pas de mention de devise ---
const sansConv = buildPassport(provEtit, pubEtit, { devise_origine: null, taux_conversion: null });
assert.equal(sansConv.conversion, null, 'aucune conversion -> null, jamais un objet vide');
assert.equal(buildPassport(provEtit, pubEtit, null).conversion, null);

// --- Provenance absente : non_trace, jamais devinée ---
const inconnu = buildPassport(null, null, null);
assert.equal(inconnu.confiance, 'non_trace');
assert.equal(inconnu.document, null);
assert.equal(inconnu.extraitLe, null);
assert.equal(inconnu.extracteur, null);

// --- Publication orpheline (publication_id pointe dans le vide) ---
const orphelin = buildPassport({ ...provEtit, publication_id: 'inexistant' }, null, null);
assert.equal(orphelin.document, null, 'document null, pas d’exception');
assert.equal(orphelin.confiance, 'extrait', 'la confiance reste celle de la provenance');

// --- Publication sans URL : le libellé reste affichable ---
const sansUrl = buildPassport(provEtit, { ...pubEtit, source_url: null }, null);
assert.equal(sansUrl.document.url, null);
assert.equal(sansUrl.document.libelle, pubEtit.libelle);

// --- Règle de promotion ---
assert.equal(doitPromouvoir('Sika Finance'), true);
assert.equal(doitPromouvoir('Madis Invest'), true);
assert.equal(
  doitPromouvoir(null), false,
  'une correction technique interne ne vérifie rien',
);
assert.equal(doitPromouvoir(''), false, 'chaîne vide = pas de source');
assert.equal(doitPromouvoir('   '), false, 'espaces seuls = pas de source');

console.log('✓ provenance/passport OK');
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run: `cd frontend && npx tsx --test lib/provenance/passport.test.mjs`
Expected: FAIL — « Cannot find module './passport.ts' »

- [ ] **Step 3 : Écrire le module**

Créer `frontend/lib/provenance/passport.ts` :

```ts
/**
 * Passeport de donnée — assemblage PUR.
 *
 * Ne fait aucune requête : la page charge les lignes, ce module les assemble.
 * Règle constante : une provenance absente donne `non_trace` et un document
 * `null` — on n'invente jamais une source.
 *
 * Voir docs/superpowers/specs/2026-07-23-passeport-donnee-design.md
 */

export type Confiance = 'verifie' | 'extrait' | 'non_trace';

export interface ProvenanceRow {
  code: string;
  periode: string;
  table_cible: string;
  publication_id: string | null;
  extrait_le: string | null;
  extracteur: string | null;
  confiance: Confiance;
}

export interface PublicationRow {
  id: string;
  libelle: string | null;
  date_publication: string;
  source_url: string | null;
}

export interface Passeport {
  confiance: Confiance;
  document: { libelle: string; datePublication: string; url: string | null } | null;
  extraitLe: string | null;
  extracteur: string | null;
  conversion: { devise: string; taux: number } | null;
}

/**
 * Assemble le passeport d'un exercice.
 *
 * @param prov   ligne de provenance_exercice, ou null si l'exercice n'en a pas
 * @param pub    publication référencée, ou null si absente / non résolue
 * @param devise colonnes de conversion portées par cash_flow_statements
 */
export function buildPassport(
  prov: ProvenanceRow | null,
  pub: PublicationRow | null,
  devise: { devise_origine: string | null; taux_conversion: number | null } | null,
): Passeport {
  const conversion =
    devise?.devise_origine && devise.taux_conversion != null
      ? { devise: devise.devise_origine, taux: devise.taux_conversion }
      : null;

  if (!prov) {
    return { confiance: 'non_trace', document: null, extraitLe: null, extracteur: null, conversion };
  }

  // Le document n'est rendu que si la publication a été résolue ET porte un
  // libellé : un lien sans intitulé n'apprend rien au lecteur.
  const document =
    pub && pub.libelle
      ? { libelle: pub.libelle, datePublication: pub.date_publication, url: pub.source_url }
      : null;

  return {
    confiance: prov.confiance,
    document,
    extraitLe: prov.extrait_le,
    extracteur: prov.extracteur,
    conversion,
  };
}

/**
 * Une correction promeut l'exercice à `verifie` UNIQUEMENT si elle cite une
 * source externe. Une correction technique interne — un bug d'extraction réparé —
 * ne vérifie rien et laisse la confiance inchangée.
 */
export function doitPromouvoir(sourceExterne: string | null | undefined): boolean {
  return typeof sourceExterne === 'string' && sourceExterne.trim().length > 0;
}
```

- [ ] **Step 4 : Lancer le test pour le voir passer**

Run: `cd frontend && npx tsx --test lib/provenance/passport.test.mjs`
Expected: `✓ provenance/passport OK` puis `pass 1` / `fail 0`

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/provenance/passport.ts frontend/lib/provenance/passport.test.mjs
git commit -m "feat(passeport): module pur d'assemblage + regle de promotion"
```

---

### Task 3 : `persistRows` écrit la provenance

**Files:**
- Modify: `frontend/lib/import/fullPersist.ts`
- Modify: `frontend/app/api/import-batch/route.ts`
- Modify: `frontend/scripts/reextract.ts`

- [ ] **Step 1 : Modifier `persistRows`**

Dans `frontend/lib/import/fullPersist.ts`, remplacer la fonction `persistRows` par :

```ts
/** Origine d'une passe d'extraction, écrite dans provenance_exercice. */
export interface OriginePasse {
  /** Publication source. `null` si inconnue (l'exercice restera non tracé). */
  publicationId: string | null;
  /** 'deepseek-chat' | 'mistral-large-latest' | 'ocr-mistral' | 'manuel' */
  extracteur: string;
}

const TABLES_TRACEES = ['income_statements', 'balance_sheets', 'cash_flow_statements'] as const;

/**
 * Upsert les 4 lignes, en SAUTANT toute année déjà marquée 'pdf-verified' dans fundamentals
 * (protection des données vérifiées à la main comme PALC).
 *
 * Écrit également la provenance des trois tables d'états. C'est le POINT DE
 * PASSAGE UNIQUE : toute donnée fondamentale entrant en base passe ici, donc la
 * traçabilité ne peut pas être oubliée ailleurs. `origine` est obligatoire pour
 * que l'oubli soit une erreur de compilation, pas un trou silencieux.
 */
export async function persistRows(
  admin: SupabaseClient,
  code: string,
  rows: MappedRows,
  origine: OriginePasse,
): Promise<'written' | 'skipped-verified'> {
  const year = rows.fundamentals.year as number;
  const { data: existing } = await admin
    .from('fundamentals').select('source').eq('code', code).eq('year', year).maybeSingle();
  if (existing?.source === 'pdf-verified') return 'skipped-verified';

  await admin.from('income_statements').upsert(rows.income, { onConflict: 'code,periode,type_periode' });
  await admin.from('balance_sheets').upsert(rows.balance, { onConflict: 'code,periode,type_periode' });
  await admin.from('cash_flow_statements').upsert(rows.cashflow, { onConflict: 'code,periode,type_periode' });
  await admin.from('fundamentals').upsert(rows.fundamentals, { onConflict: 'code,year' });

  // Provenance : une ligne par table tracée. Confiance 'extrait' — seule une
  // correction adossée à une source externe peut promouvoir à 'verifie'.
  const periode = rows.income.periode as string;
  await admin.from('provenance_exercice').upsert(
    TABLES_TRACEES.map((table_cible) => ({
      code, periode, table_cible,
      publication_id: origine.publicationId,
      extrait_le: new Date().toISOString(),
      extracteur: origine.extracteur,
      confiance: 'extrait',
    })),
    { onConflict: 'code,periode,table_cible' },
  );

  return 'written';
}
```

- [ ] **Step 2 : Mettre à jour l'appelant route**

Dans `frontend/app/api/import-batch/route.ts`, remplacer :

```ts
              const res = await persistRows(admin, code, toRows(code, ex, pub.libelle ?? pub.source_url!));
```

par :

```ts
              const res = await persistRows(
                admin, code, toRows(code, ex, pub.libelle ?? pub.source_url!),
                { publicationId: pub.id, extracteur: 'deepseek-chat' },
              );
```

- [ ] **Step 3 : Mettre à jour l'appelant script**

Dans `frontend/scripts/reextract.ts`, remplacer :

```ts
        const res = await persistRows(admin, code, toRows(code, ex, pub.libelle ?? pub.source_url!));
```

par :

```ts
        const res = await persistRows(
          admin, code, toRows(code, ex, pub.libelle ?? pub.source_url!),
          { publicationId: pub.id, extracteur: utiliseOcr ? 'ocr-mistral' : 'deepseek-chat' },
        );
```

Et déclarer `utiliseOcr` juste avant l'appel à `callLlm`, dans la boucle sur `selected` :

```ts
    let utiliseOcr = false;
```

puis, dans la branche de repli OCR déjà présente (`text = await ocrPdf(...)`), ajouter la ligne :

```ts
        utiliseOcr = true;
```

- [ ] **Step 4 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie (exit 0). Si une erreur signale un appel à `persistRows` avec 3 arguments, c'est un appelant oublié — le corriger.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/import/fullPersist.ts frontend/app/api/import-batch/route.ts frontend/scripts/reextract.ts
git commit -m "feat(passeport): persistRows ecrit la provenance des trois tables d'etats"
```

---

### Task 4 : Lecture de la provenance

**Files:**
- Create: `frontend/lib/provenance/queries.ts`

- [ ] **Step 1 : Écrire le module de requête**

Créer `frontend/lib/provenance/queries.ts` :

```ts
import { createPublicClient } from '@/lib/supabase/public';
import type { ProvenanceRow } from './passport';

/**
 * Charge toutes les lignes de provenance d'une société, indexées par
 * `${periode}|${table_cible}` pour un accès direct au rendu.
 *
 * Client PUBLIC (clé anon) : la provenance est en lecture publique — c'est
 * l'argument de confiance, il ne doit pas dépendre d'une session.
 */
export async function loadProvenance(code: string): Promise<Map<string, ProvenanceRow>> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('provenance_exercice')
    .select('code, periode, table_cible, publication_id, extrait_le, extracteur, confiance')
    .eq('code', code);

  const index = new Map<string, ProvenanceRow>();
  for (const r of (data ?? []) as ProvenanceRow[]) {
    index.set(`${r.periode}|${r.table_cible}`, r);
  }
  return index;
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/provenance/queries.ts
git commit -m "feat(passeport): chargement de la provenance par societe"
```

---

### Task 5 : Composant `PasseportPopover`

**Files:**
- Create: `frontend/components/provenance/PasseportPopover.tsx`

- [ ] **Step 1 : Écrire le composant**

Créer `frontend/components/provenance/PasseportPopover.tsx` :

```tsx
'use client';

import { useState } from 'react';
import type { Passeport } from '@/lib/provenance/passport';

/**
 * Pastille « Preuves » + panneau de provenance. Gratuit pour tous : les chiffres
 * restent premium, leur preuve est ouverte.
 *
 * `non_trace` n'est PAS masqué : dire qu'on ne sait pas est une information,
 * pas un échec à cacher.
 */

const ETIQUETTE: Record<Passeport['confiance'], { texte: string; classe: string }> = {
  verifie:    { texte: 'Vérifié',      classe: 'border-up/40 bg-up/10 text-up' },
  extrait:    { texte: 'Extrait',      classe: 'border-border text-muted' },
  non_trace:  { texte: 'Non tracé',    classe: 'border-warn/40 bg-warn/10 text-warn' },
};

const fmtDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

export default function PasseportPopover({ passeport, titre }: { passeport: Passeport; titre: string }) {
  const [ouvert, setOuvert] = useState(false);
  const et = ETIQUETTE[passeport.confiance];

  return (
    <span className="relative inline-block">
      <button
        type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}
        aria-label={`Provenance de ${titre}`}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition hover:opacity-80 ${et.classe}`}
      >
        ⓘ {et.texte}
      </button>

      {ouvert && (
        <div
          role="dialog" aria-label={`Provenance de ${titre}`}
          className="absolute z-30 mt-2 w-80 rounded-xl border border-border bg-elevated p-4 text-xs shadow-modal"
        >
          <p className="font-semibold text-white">{titre}</p>

          {passeport.document ? (
            <p className="mt-2 text-muted">
              Source :{' '}
              {passeport.document.url ? (
                <a href={passeport.document.url} target="_blank" rel="noopener noreferrer"
                   className="text-accent underline underline-offset-2">
                  {passeport.document.libelle}
                </a>
              ) : (
                <span className="text-white/80">{passeport.document.libelle}</span>
              )}
              {fmtDate(passeport.document.datePublication) && (
                <>, publié le {fmtDate(passeport.document.datePublication)}</>
              )}
            </p>
          ) : (
            <p className="mt-2 text-muted">
              Source non tracée : ces chiffres sont antérieurs à la mise en place du suivi de provenance.
            </p>
          )}

          {passeport.extraitLe && (
            <p className="mt-1.5 text-muted">
              Extrait le {fmtDate(passeport.extraitLe)}
              {passeport.extracteur === 'manuel'
                ? ' par saisie manuelle.'
                : ' par analyse automatique du document.'}
            </p>
          )}

          {passeport.conversion && (
            <p className="mt-1.5 text-warn">
              ⓘ Société publiant en {passeport.conversion.devise} — montants convertis en FCFA au taux moyen
              d’exercice de {passeport.conversion.taux.toLocaleString('fr-FR', { maximumFractionDigits: 3 })}.
            </p>
          )}

          <button type="button" onClick={() => setOuvert(false)}
            className="mt-3 text-[10px] text-faint hover:text-white">
            Fermer
          </button>
        </div>
      )}
    </span>
  );
}
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add frontend/components/provenance/PasseportPopover.tsx
git commit -m "feat(passeport): composant panneau Preuves"
```

---

### Task 6 : Brancher le passeport sur la fiche financière

**Files:**
- Modify: `frontend/app/actions/[code]/financials/page.tsx`

- [ ] **Step 1 : Ajouter les imports**

En tête de `frontend/app/actions/[code]/financials/page.tsx`, après les imports existants :

```ts
import PasseportPopover from '@/components/provenance/PasseportPopover';
import { buildPassport } from '@/lib/provenance/passport';
import { loadProvenance } from '@/lib/provenance/queries';
```

- [ ] **Step 2 : Charger la provenance et construire le passeport**

Juste après `const data = await loadCompanyFinancials(code);` (ou l'appel équivalent qui remplit `data`), ajouter :

```ts
  // Provenance du dernier exercice publié — celui qu'affichent les cartes de tête.
  const provenance = await loadProvenance(code);
  const periodeAffichee = data.incomeStatements[0]?.periode ?? null;
  const pubsById = new Map(data.publications.map((p) => [p.id, p]));
  const provIncome = periodeAffichee
    ? provenance.get(`${periodeAffichee}|income_statements`) ?? null
    : null;
  const passeport = buildPassport(
    provIncome,
    provIncome?.publication_id ? pubsById.get(provIncome.publication_id) ?? null : null,
    data.cashFlowStatements.find((c) => c.periode === periodeAffichee) ?? null,
  );
```

- [ ] **Step 3 : Afficher la pastille près du titre des états**

Repérer le bloc d'en-tête de la section « Ratios fondamentaux » :

```tsx
              <p className="text-xs text-muted uppercase tracking-widest mb-3 px-0.5">Ratios fondamentaux</p>
```

le remplacer par :

```tsx
              <div className="flex items-center gap-2 mb-3 px-0.5">
                <p className="text-xs text-muted uppercase tracking-widest">Ratios fondamentaux</p>
                {periodeAffichee && (
                  <PasseportPopover passeport={passeport} titre={`Exercice ${periodeAffichee}`} />
                )}
              </div>
```

- [ ] **Step 4 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

`CashFlowStatement` porte **déjà** `devise_origine?: string | null` (ligne 62) et
`taux_conversion?: number | null` (ligne 64) dans
`frontend/lib/financials/types.ts` — ajoutés avec la migration 0115. Rien à
modifier : ne pas les redéclarer.

- [ ] **Step 5 : Commit**

```bash
git add "frontend/app/actions/[code]/financials/page.tsx" frontend/lib/financials/types.ts
git commit -m "feat(passeport): pastille Preuves sur la fiche financiere"
```

---

### Task 7 : Backfill rétroactif

**Files:**
- Create: `frontend/scripts/backfill-provenance.ts`

- [ ] **Step 1 : Écrire le script**

Créer `frontend/scripts/backfill-provenance.ts` :

```ts
/**
 * Rattachement rétroactif de la provenance des exercices déjà en base.
 *
 *   npx tsx scripts/backfill-provenance.ts          # passe à blanc
 *   npx tsx scripts/backfill-provenance.ts --write  # écrit
 *
 * Méthode : `fundamentals.source_file` contient le libellé de la publication
 * (posé par toRows : `pub.libelle ?? pub.source_url`). On le rapproche de
 * `publications.libelle` pour retrouver le publication_id.
 *
 * Là où le rattachement échoue, la ligne est écrite avec confiance='non_trace'
 * et publication_id=null. On n'invente AUCUNE provenance : une source devinée
 * serait pire que pas de source.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(p: string): void {
  if (!fs.existsSync(p)) return;
  for (const ligne of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]!]) continue;
    process.env[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv(path.resolve(__dirname, '../.env.local'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('SUPABASE_URL / SERVICE_ROLE_KEY manquants'); process.exit(1); }
const admin = createClient(url, key);
const write = process.argv.includes('--write');

const TABLES = ['income_statements', 'balance_sheets', 'cash_flow_statements'] as const;

async function main(): Promise<void> {
  console.log(`\n=== Backfill provenance ${write ? '(ÉCRITURE)' : '(passe à blanc)'} ===\n`);

  const { data: pubs } = await admin
    .from('publications').select('id, code, libelle, source_url');
  // Index par code + libellé, et par code + URL (source_file peut contenir l'un ou l'autre).
  const parLibelle = new Map<string, string>();
  for (const p of pubs ?? []) {
    if (p.libelle) parLibelle.set(`${p.code}|${p.libelle}`, p.id as string);
    if (p.source_url) parLibelle.set(`${p.code}|${p.source_url}`, p.id as string);
  }

  const { data: fundamentals } = await admin
    .from('fundamentals').select('code, year, source_file, source');

  const lignes: Record<string, unknown>[] = [];
  let rattaches = 0, orphelins = 0;

  for (const f of fundamentals ?? []) {
    const periode = String(f.year);
    const pubId = f.source_file ? parLibelle.get(`${f.code}|${f.source_file}`) ?? null : null;
    if (pubId) rattaches++; else orphelins++;

    for (const table_cible of TABLES) {
      lignes.push({
        code: f.code, periode, table_cible,
        publication_id: pubId,
        extrait_le: null,               // date d'extraction inconnue rétroactivement
        extracteur: f.source === 'pdf-verified' ? 'manuel' : null,
        confiance: pubId ? 'extrait' : 'non_trace',
      });
    }
  }

  console.log(`${rattaches} exercice(s) rattaché(s) à une publication`);
  console.log(`${orphelins} exercice(s) sans rattachement -> non_trace`);
  console.log(`${lignes.length} ligne(s) de provenance à écrire`);

  if (!write) { console.log('\nRien écrit — relancer avec --write.'); return; }

  // Par lots de 500 : PostgREST plafonne les payloads volumineux.
  for (let i = 0; i < lignes.length; i += 500) {
    const lot = lignes.slice(i, i + 500);
    const { error } = await admin
      .from('provenance_exercice').upsert(lot, { onConflict: 'code,periode,table_cible' });
    if (error) { console.error(`Lot ${i} : ${error.message}`); process.exit(1); }
  }
  console.log('\nÉcrit ✓');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Lancer la passe à blanc**

Run: `cd frontend && npx tsx scripts/backfill-provenance.ts`
Expected: un décompte de rattachés / orphelins, et « Rien écrit ». **Ne pas lancer `--write`** : la migration 0120 n'est probablement pas encore appliquée. Signaler le décompte dans le rapport de tâche.

- [ ] **Step 4 : Commit**

```bash
git add frontend/scripts/backfill-provenance.ts
git commit -m "feat(passeport): script de rattachement retroactif de la provenance"
```

---

### Task 8 : Corrections — fonction d'écriture et amorçage

**Files:**
- Create: `frontend/lib/provenance/corrections.ts`
- Create: `supabase/migrations/0121_amorcage_corrections.sql`

- [ ] **Step 0 : Écrire la fonction d'enregistrement d'une correction**

Sans elle, `doitPromouvoir` serait du code mort : testé mais jamais appelé. C'est
elle qui applique la règle de promotion en TypeScript plutôt qu'en déclencheur
SQL — un déclencheur serait invisible à la relecture et impossible à tester sans
base.

Créer `frontend/lib/provenance/corrections.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { doitPromouvoir } from './passport';

export interface Correction {
  tableCible: 'income_statements' | 'balance_sheets' | 'cash_flow_statements';
  code: string;
  periode: string;
  champ: string;
  valeurAvant: number | null;
  valeurApres: number | null;
  motif: string;
  /** Source externe ayant permis de trancher. `null` = correction technique. */
  sourceExterne: string | null;
  corrigePar: string;
}

/**
 * Journalise une correction et applique la règle de promotion : une correction
 * adossée à une source externe fait passer l'exercice à `confiance = 'verifie'`.
 * Une correction technique interne ne promeut rien — réparer une erreur ne
 * vérifie rien.
 *
 * `admin` doit être un client service_role : `correction_champ` n'est lisible ni
 * écrivable par anon/authenticated.
 */
export async function enregistrerCorrection(
  admin: SupabaseClient,
  c: Correction,
): Promise<void> {
  const { error } = await admin.from('correction_champ').insert({
    table_cible: c.tableCible, code: c.code, periode: c.periode, champ: c.champ,
    valeur_avant: c.valeurAvant, valeur_apres: c.valeurApres,
    motif: c.motif, source_externe: c.sourceExterne, corrige_par: c.corrigePar,
  });
  if (error) throw new Error(`correction_champ : ${error.message}`);

  if (!doitPromouvoir(c.sourceExterne)) return;

  const { error: errPromo } = await admin
    .from('provenance_exercice')
    .update({ confiance: 'verifie' })
    .eq('code', c.code).eq('periode', c.periode).eq('table_cible', c.tableCible);
  if (errPromo) throw new Error(`promotion provenance : ${errPromo.message}`);
}
```

- [ ] **Step 0bis : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 1 : Écrire la migration**

```sql
-- 0121 — Amorçage de correction_champ avec les corrections des migrations
-- 0115 à 0119. L'historique démarre avec des cas documentés plutôt qu'une table
-- vide, et la règle de promotion (source externe -> confiance 'verifie') peut
-- s'appliquer immédiatement aux exercices concernés.
--
-- Idempotence : insertion conditionnée à l'absence d'une ligne identique.

insert into public.correction_champ
  (table_cible, code, periode, champ, valeur_avant, valeur_apres, motif, source_externe, corrige_par)
select v.* from (values
  ('income_statements','CIEC','2022','resultat_net', 10261000000::numeric, 9819000000::numeric,
   'Ré-extraction PDF ayant écrasé une valeur correcte ; restaurée après contrôle externe.',
   'Sika Finance','migration 0117'),
  ('income_statements','CIEC','2023','resultat_net', 11485000000, 10633000000,
   'Ré-extraction PDF ayant écrasé une valeur correcte ; restaurée après contrôle externe.',
   'Sika Finance','migration 0117'),
  ('income_statements','CIEC','2024','resultat_net', 10555000000, 10101000000,
   'Ré-extraction PDF ayant écrasé une valeur correcte ; restaurée après contrôle externe.',
   'Sika Finance','migration 0117'),
  ('income_statements','SHEC','2022','resultat_net', 3548638458, 3753000000,
   'Ré-extraction PDF ayant écrasé une valeur correcte ; restaurée après contrôle externe.',
   'Sika Finance','migration 0117'),
  ('income_statements','CIEC','2022','benefice_par_action', 183, 175.34,
   'BPA incohérent : le nombre d''actions implicite variait de 51,9 M à 53,7 M ; la série retenue donne 56 000 000 stable.',
   'Madis Invest','migration 0118'),
  ('income_statements','CIEC','2023','benefice_par_action', 205, 189.88,
   'BPA incohérent : le nombre d''actions implicite variait de 51,9 M à 53,7 M ; la série retenue donne 56 000 000 stable.',
   'Madis Invest','migration 0118'),
  ('income_statements','CIEC','2024','benefice_par_action', 188, 180.38,
   'BPA incohérent : le nombre d''actions implicite variait de 51,9 M à 53,7 M ; la série retenue donne 56 000 000 stable.',
   'Madis Invest','migration 0118'),
  ('income_statements','TTLS','2025','resultat_net', 6779000000, 6146000000,
   'Deux sources indépendantes concordantes contre la valeur en base ; le chiffre d''affaires concordait déjà sur les 5 exercices.',
   'Madis Invest + Sika Finance','migration 0119'),
  ('cash_flow_statements','ETIT','2025','flux_exploitation', 1172891000, 682427862094,
   'Flux extraits de la série USD du document et stockés comme des francs ; convertis au taux moyen d''exercice (IAS 21).',
   'Publication ETI + BCE','migration 0115/0116')
) as v(table_cible, code, periode, champ, valeur_avant, valeur_apres, motif, source_externe, corrige_par)
where not exists (
  select 1 from public.correction_champ c
  where c.code = v.code and c.periode = v.periode and c.champ = v.champ
    and c.table_cible = v.table_cible
);

-- Promotion : tout exercice ayant une correction adossée à une source externe
-- passe à 'verifie'. Cohérent avec doitPromouvoir() côté TypeScript.
update public.provenance_exercice p set confiance = 'verifie'
where exists (
  select 1 from public.correction_champ c
  where c.code = p.code and c.periode = p.periode and c.table_cible = p.table_cible
    and c.source_externe is not null and btrim(c.source_externe) <> ''
);
```

- [ ] **Step 2 : Commit**

```bash
git add supabase/migrations/0121_amorcage_corrections.sql
git commit -m "feat(passeport): amorcage des corrections documentees (0115-0119)"
```

- [ ] **Step 3 : Signaler l'ordre d'application**

Écrire dans le rapport : « Migrations à appliquer dans l'ordre : 0120, puis le backfill (`npx tsx scripts/backfill-provenance.ts --write`), puis 0121 — la promotion de 0121 suppose que les lignes de provenance existent. »

---

### Task 9 : Script de vérification

**Files:**
- Create: `frontend/scripts/verify-provenance.ts`

- [ ] **Step 1 : Écrire le script**

Créer `frontend/scripts/verify-provenance.ts` :

```ts
/**
 * Contrôle d'intégrité et rapport de couverture de la provenance.
 *
 *   npx tsx scripts/verify-provenance.ts
 *
 * Deux contrôles :
 *  1. Intégrité — toute ligne de provenance pointe une publication existante.
 *  2. Couverture — tout exercice d'income_statements a une ligne de provenance.
 *     Les trous doivent être VISIBLES, pas silencieux : c'est précisément le
 *     défaut que ce chantier corrige.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(p: string): void {
  if (!fs.existsSync(p)) return;
  for (const ligne of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = ligne.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]!]) continue;
    process.env[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '');
  }
}
loadEnv(path.resolve(__dirname, '../.env.local'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('SUPABASE_URL / SERVICE_ROLE_KEY manquants'); process.exit(1); }
const admin = createClient(url, key);

async function main(): Promise<void> {
  const { data: prov } = await admin
    .from('provenance_exercice').select('code, periode, table_cible, publication_id, confiance');
  const { data: pubs } = await admin.from('publications').select('id');
  const { data: income } = await admin
    .from('income_statements').select('code, periode').eq('type_periode', 'annuel');

  const idsPubs = new Set((pubs ?? []).map((p) => p.id as string));
  const lignes = prov ?? [];

  console.log(`\n=== Provenance : ${lignes.length} ligne(s) ===\n`);

  const orphelines = lignes.filter((l) => l.publication_id && !idsPubs.has(l.publication_id as string));
  console.log(`Intégrité : ${orphelines.length} référence(s) de publication cassée(s)`);
  for (const o of orphelines.slice(0, 10)) console.log(`  ${o.code} ${o.periode} ${o.table_cible}`);

  const tracees = new Set(lignes.map((l) => `${l.code}|${l.periode}|${l.table_cible}`));
  const manquants = (income ?? []).filter(
    (r) => !tracees.has(`${r.code}|${r.periode}|income_statements`),
  );
  console.log(`\nCouverture : ${(income ?? []).length - manquants.length}/${(income ?? []).length} exercices tracés`);
  for (const m of manquants.slice(0, 20)) console.log(`  SANS PROVENANCE : ${m.code} ${m.periode}`);
  if (manquants.length > 20) console.log(`  … et ${manquants.length - 20} autre(s)`);

  const parConfiance = new Map<string, number>();
  for (const l of lignes) parConfiance.set(l.confiance as string, (parConfiance.get(l.confiance as string) ?? 0) + 1);
  console.log('\nRépartition des niveaux de confiance :');
  for (const [c, n] of [...parConfiance].sort((a, b) => b[1] - a[1])) console.log(`  ${c} : ${n}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2 : Typecheck**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Commit**

```bash
git add frontend/scripts/verify-provenance.ts
git commit -m "feat(passeport): controle d'integrite et rapport de couverture"
```

---

### Task 10 : Vérification finale

- [ ] **Step 1 : Relancer tous les tests purs**

Run: `cd frontend && npx tsx --test lib/provenance/passport.test.mjs`
Expected: `pass 1` / `fail 0`

- [ ] **Step 2 : Typecheck complet**

Run: `cd frontend && npx tsc --noEmit` (timeout 540000)
Expected: aucune sortie.

- [ ] **Step 3 : Rédiger le récapitulatif d'application pour l'utilisateur**

Le rapport final doit indiquer, dans cet ordre :

1. Appliquer `supabase/migrations/0120_passeport_donnee.sql`
2. Lancer `cd frontend && npx tsx scripts/backfill-provenance.ts` (passe à blanc), vérifier le décompte, puis `--write`
3. Appliquer `supabase/migrations/0121_amorcage_corrections.sql`
4. Lancer `cd frontend && npx tsx scripts/verify-provenance.ts` et reporter la couverture obtenue
5. Tester la lecture anonyme :
   `curl -s "$SUPABASE_URL/rest/v1/provenance_exercice?select=code&limit=1" -H "apikey: $ANON"` → doit renvoyer une ligne
   `curl -s "$SUPABASE_URL/rest/v1/correction_champ?select=id&limit=1" -H "apikey: $ANON"` → doit renvoyer une erreur ou un tableau vide, **jamais** de données
