# Passeport de donnée — design

**Date** : 2026-07-23
**Statut** : approuvé, prêt pour plan d'implémentation
**Fonctionnalité** : #1 du catalogue produit (score 4,6/5 — le mieux noté)

## 1. Pourquoi

Chaque chiffre fondamental affiché par WESTBOURSE provient d'un document, extrait
par une passe automatique, parfois converti, parfois corrigé à la main. Rien de
tout cela n'est visible. Un utilisateur qui doute d'un chiffre n'a aucun moyen de
le vérifier, et nous n'avons aucun moyen de lui répondre autrement qu'en relisant
le code.

La session du 2026-07-23 en a fait la démonstration : cinq migrations correctives
(`0115` → `0119`) ont modifié des valeurs en base — devise ETIT libellée en
dollars, résultat net TTLS, BPA et dividendes CIEC, restauration de valeurs
écrasées par une ré-extraction — **sans qu'aucune trace n'en subsiste dans
l'application**. Deux régressions ont même été introduites puis rattrapées par un
contrôle externe improvisé.

Le passeport de donnée répond à cela : il rend visible, pour chaque exercice
financier publié, d'où vient le chiffre et comment il a été obtenu.

## 2. Décisions de cadrage

Prises en brainstorming, elles bornent le périmètre :

| Question | Décision |
|---|---|
| Destinataire | **Utilisateur final** — argument de confiance, pas outil interne |
| Couverture | **Fondamentaux publiés** (CA, résultat net, BPA, dividende, capitaux propres, flux) |
| Historique des corrections | **Stocké mais non affiché** — seul l'état courant est visible |
| Offre | **Gratuit pour tous** — les chiffres restent premium, leur preuve est ouverte |

Le choix de ne pas afficher l'historique retire le moat identifié au catalogue
(« historique de corrections propriétaire »). Le stocker quand même préserve
l'option de l'ouvrir plus tard sans rien reconstruire.

Le choix de la gratuité répond à une tension : verrouiller la preuve derrière un
abonnement reviendrait à faire payer pour vérifier qu'on ne ment pas. Bénéfice
secondaire : des pages sourcées, donc citables et indexables.

## 3. Granularité : par exercice, pas par champ

Le catalogue proposait une table `data_lineage` générique, une ligne par champ.
Rejeté au profit d'une granularité par exercice, pour une raison factuelle :
**tous les chiffres d'un exercice proviennent du même PDF, extraits par la même
passe, avec la même confiance**. Le champ par champ est redondant à 95 %.

Chiffrage : 48 sociétés × 5 exercices × ~30 champs ≈ **7 000 lignes par passe**
en modèle générique, contre ~700 en modèle par exercice. Surtout, le modèle
générique doit être alimenté partout — un seul point d'oubli et la traçabilité
ment par omission, ce qui est pire que pas de traçabilité du tout.

Le champ par champ garde sa valeur pour un seul cas : les **corrections
ponctuelles**. D'où la seconde table, qui ne stocke que celles-là.

## 4. Modèle de données — migration `0120`

```sql
create table if not exists public.provenance_exercice (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  periode         text not null,
  table_cible     text not null check (table_cible in
                    ('income_statements','balance_sheets','cash_flow_statements')),
  publication_id  uuid references public.publications(id) on delete set null,
  extrait_le      timestamptz,
  extracteur      text,     -- 'deepseek-chat' | 'ocr-mistral' | 'manuel' | null
  confiance       text not null default 'non_trace'
                    check (confiance in ('verifie','extrait','non_trace')),
  created_at      timestamptz not null default now(),
  unique (code, periode, table_cible)
);

create table if not exists public.correction_champ (
  id            uuid primary key default gen_random_uuid(),
  table_cible   text not null check (table_cible in
                  ('income_statements','balance_sheets','cash_flow_statements')),
  code          text not null,
  periode       text not null,
  champ         text not null,
  valeur_avant  numeric,
  valeur_apres  numeric,
  motif         text not null,
  source_externe text,      -- 'Sika Finance' | 'Madis Invest' | 'publication émetteur'
  corrige_le    timestamptz not null default now(),
  corrige_par   text
);
```

**Sémantique de `confiance`** :

- `verifie` — valeur recoupée contre une source externe citée (Sika, Madis,
  publication de l'émetteur) ou marquée `pdf-verified`
- `extrait` — issue d'une extraction automatique ayant passé les garde-fous
- `non_trace` — provenance inconnue (données antérieures non rattachables)

**Règle de promotion** : enregistrer une ligne dans `correction_champ` avec un
`source_externe` non nul fait passer le `provenance_exercice` correspondant
(`code` + `periode` + `table_cible`) à `confiance = 'verifie'`. C'est la seule
manière d'atteindre cet état. Une correction sans source externe — un bug
d'extraction réparé — laisse la confiance inchangée : réparer une erreur ne
vérifie rien. La promotion est appliquée par la fonction d'écriture des
corrections, pas par un déclencheur SQL, pour rester lisible et testable.

La devise **n'est pas dupliquée** : `cash_flow_statements.devise_origine` et
`taux_conversion` existent déjà (migrations `0115`/`0116`). Le passeport les lit.

### RLS

```sql
alter table public.provenance_exercice enable row level security;
alter table public.correction_champ    enable row level security;

-- Lecture publique : aucune donnée personnelle, c'est l'argument de confiance.
create policy "provenance lecture publique" on public.provenance_exercice
  for select using (true);

-- correction_champ : stocké, NON exposé (décision de cadrage). Aucune policy
-- de lecture -> seul le service_role y accède.
revoke insert, update, delete on public.provenance_exercice from anon, authenticated;
revoke all on public.correction_champ from anon, authenticated;
```

## 5. Alimentation

### Flux courant

`frontend/lib/import/fullPersist.ts` → `persistRows` est le **point de passage
unique** : il écrit déjà les quatre tables ensemble. On y ajoute l'écriture des
trois lignes `provenance_exercice` (une par table cible), avec `publication_id`,
`extrait_le = now()`, `extracteur` et `confiance = 'extrait'`.

Un seul endroit à ne pas oublier — c'est précisément l'argument contre le modèle
par champ.

`persistRows` reçoit aujourd'hui `sourceFile: string`. La signature évolue pour
recevoir `publicationId: string` et `extracteur: string`, fournis par les deux
appelants : la route `/api/import-batch` et le script `scripts/reextract.ts`.

### Rétroactif

`fundamentals.source_file` contient le libellé de la publication (posé par
`toRows` : `pub.libelle ?? pub.source_url`). On le rattache à
`publications.libelle` pour retrouver le `publication_id` des exercices déjà en
base, par `code` + libellé.

**Là où le rattachement échoue, `confiance = 'non_trace'`** et le panneau affiche
« source non tracée ». On n'invente aucune provenance — c'est la règle constante
du projet, et une provenance devinée serait pire que pas de provenance.

### Amorçage de `correction_champ`

Les corrections de la session sont réinjectées avec leur motif réel :

| Code | Période | Champ | Avant → Après | Source |
|---|---|---|---|---|
| ETIT | 2022-2025 | flux (toutes colonnes) | ×~600 | conversion USD→FCFA au taux moyen BCE |
| CIEC | 2022,2023,2024 | `resultat_net` | 10 261→9 819, 11 485→10 633, 10 555→10 101 | Sika Finance |
| SHEC | 2022 | `resultat_net` | 3 548 638 458 → 3 753 000 000 | Sika Finance |
| CIEC | 2022,2023,2024 | `revenu_total`, `benefice_par_action`, `dividende_par_action` | voir `0118` | Madis Invest |
| TTLS | 2025 | `resultat_net` | 6 779 000 000 → 6 146 000 000 | Madis + Sika concordants |

L'historique démarre avec des cas documentés plutôt qu'une table vide.

## 6. Lecture et interface

### Module pur

`frontend/lib/provenance/passport.ts`

```ts
export interface Passeport {
  confiance: 'verifie' | 'extrait' | 'non_trace';
  document: { libelle: string; datePublication: string; url: string } | null;
  extraitLe: string | null;
  extracteur: string | null;
  conversion: { devise: string; taux: number } | null;
}

export function buildPassport(
  prov: ProvenanceRow | null,
  pub: PublicationRow | null,
  devise: { devise_origine: string | null; taux_conversion: number | null } | null,
): Passeport;
```

Fonction pure, testable sans base. Elle ne fait aucune requête : la page charge,
elle assemble.

### Composant

`frontend/components/provenance/PasseportPopover.tsx` — pastille discrète à côté
de chaque bloc de chiffres sur `/actions/[code]/financials`. Au clic, un panneau :

> **Résultat net 2025 — 345 523 000 000 FCFA**
> Source : *États financiers IFRS — Exercice 2025 — ETI TG*, publié le 13/04/2026 → **[ouvrir le PDF]**
> Extrait le 08/06/2026 par analyse automatique du document.
> ⓘ Société publiant en USD — converti au taux moyen 2025 de 581,834 FCFA/USD.

Trois états visuels selon `confiance` : vérifié, extrait, non tracé. Le troisième
n'est pas un échec à masquer mais une information à afficher.

## 7. Tests

**Purs** (`lib/provenance/passport.test.mjs`, `npx tsx --test`) :

- ETIT 2025 : passeport avec mention de conversion USD au taux 581,834
- CIEC 2023 : passeport `verifie` (corrigé contre source externe)
- exercice sans provenance : `non_trace`, document `null`, aucun plantage
- publication manquante (`publication_id` orphelin) : document `null`, pas d'exception

**Intégrité** (script `scripts/verify-provenance.ts`) :

- toute ligne `provenance_exercice` pointe une `publications` existante
- tout exercice présent dans `income_statements` sans provenance est listé —
  rapport de couverture, pour que les trous soient visibles et non silencieux

**RLS** : `provenance_exercice` lisible en `curl` anonyme ; `correction_champ`
inaccessible en anon et en authenticated (les deux, cf. discipline RLS du projet).

## 8. Hors périmètre

- Ratios dérivés (PER, ROE, marges) — chaîne de calcul, pas document source
- Cours et données de marché
- Affichage de l'historique des corrections
- Console admin de qualité de données
- Indice de fraîcheur (#2) — partage le socle, fera sa propre spec

## 9. Risques

| Risque | Traitement |
|---|---|
| Rattachement rétroactif partiel | `non_trace` assumé et affiché, jamais de provenance devinée |
| `persistRows` oublié par un futur appelant | Signature obligatoire (`publicationId` requis) → erreur de compilation |
| Volume de `provenance_exercice` | ~700 lignes ; index sur `(code, periode)` |
| Exposition publique d'un lien PDF mort | Le panneau affiche le libellé même si l'URL est absente |
