# Module Contenu (admin) — Design

**Date :** 2026-06-16
**Statut :** approuvé (brainstorming)
**Sous-projet (c2)** du lot « gestion admin » (ordre : b ✅ → Contenu → Rapports IA → Organisations).

## Objectif

Donner à l'admin la **modération + édition + création manuelle** des contenus de
marché scrapés : **Actualités** (`brvm_news`), **Communiqués** (`brvm_communiques`),
**Bulletins** (`brvm_bulletins`). Remplace le stub `/admin/content`.

## Décision structurante (validée)

Périmètre **le plus large** : masquer/afficher + supprimer + éditer + créer à la main.
Types : news, communiqué, bulletin. **`publications` exclu** (géré par le pipeline d'import).

## Contexte existant (réutilisé)

- Tables (lecture publique RLS `using(true)`) :
  - `brvm_news(id, dedupe_hash unique, titre, date_publication, source CHECK('brvm','cosumaf','autre'), source_url, resume, instrument_code, secteur, created_at)`.
  - `brvm_communiques(id, dedupe_hash unique, titre, date_publication, emetteur, categorie, source_url NOT NULL, document_url, resume, created_at)`.
  - `brvm_bulletins(id, dedupe_hash unique, date_bulletin, numero, source_url NOT NULL, document_url, resume, created_at)`.
- Pages publiques (`/actualites`, etc.) lisent ces tables via le client **anon** (RLS s'applique).
- Le scraper upsert via service-role sur `dedupe_hash` (bypasse la RLS).
- `requirePermission`, `recordAudit`, `getServiceClient`, kit `@/components/ui/premium`.

## Architecture

### 1. Migration `0044_content_moderation.sql`

- `alter table` les 3 tables : ajout `hidden boolean not null default false` + `created_by uuid references auth.users(id)`.
- **Filtrage public par RLS** : remplacer la policy `select` publique de chaque table
  par `using (hidden = false)`. Effet : une entrée masquée disparaît de toutes les
  lectures anon (pages publiques) **sans modifier les requêtes**. Service-role
  (admin + scraper) voit tout. Le scraper, qui n'inclut pas `hidden` dans son
  upsert, **préserve** le masquage lors d'un re-scrape (ON CONFLICT ne touche pas la colonne).

### 2. Config unifiée — `lib/admin/content.ts`

- `export type ContentKind = 'news' | 'communique' | 'bulletin'`.
- `CONTENT_KINDS: Record<ContentKind, KindConfig>` où `KindConfig` décrit : `table`,
  `label`, `dateCol` (`date_publication` | `date_bulletin`), `titleCol` (`titre` | `numero`),
  champs éditables/créables, et le mapping d'affichage. Centralise les différences → pas de triple duplication.
- `ContentRow` (forme normalisée pour l'UI : id, title, date, resume, hidden, source_url, document_url, created_by).
- `loadContent(kind, search?)` (service-role, **inclut les masqués**) → `{ rows: ContentRow[]; kpis: { total; hidden; lastDate } }`.

### 3. Actions serveur — `app/admin/content/actions.ts`

- `setHidden(kind, id, hidden: boolean)` — `content.write` ; update `hidden` ; audit `content.hide`/`content.show`.
- `deleteContent(kind, id)` — `content.write` ; delete ; audit `content.delete`.
- `upsertContent(kind, id: string | null, fields: Record<string,string>)` —
  - édition (id non null) → `content.write` ; update des champs autorisés du kind ;
  - création (id null) → `content.publish` ; insert avec `created_by = ctx.userId`,
    `dedupe_hash = 'manual-' + crypto.randomUUID()`, et valeurs par défaut spécifiques
    (news : `source='autre'` ; communiqué/bulletin : `source_url = fields.source_url ?? ''` car NOT NULL) ;
  - audit `content.create`/`content.update`. Validation : titre/date requis.
- `revalidatePath('/admin/content')` après chaque action.

### 4. Pages — `app/admin/content`

- `page.tsx` (server, `content.read`) : **onglets** via `?kind=news|communique|bulletin`
  (défaut `news`). KPIs (total, masqués, dernière date). Table `ContentTable` + bouton « Créer ».
- `ContentTable.tsx` (client) : lignes avec actions **Masquer/Afficher**, **Éditer**, **Supprimer**
  (confirmation simple), badge « masqué ». Liens `source_url`/`document_url` si présents.
- `ContentForm.tsx` (client) : formulaire créer/éditer, champs selon `kind` (cf. § Champs).
  Ouvert pour « Créer » et pour « Éditer » (prérempli). Appelle `upsertContent`.

### 5. Champs par type (créables/éditables)

- **news** : `titre`*, `date_publication`*, `resume`, `source_url`, `secteur`.
- **communique** : `titre`*, `date_publication`*, `emetteur`, `categorie`, `source_url`, `document_url`, `resume`.
- **bulletin** : `numero`, `date_bulletin`*, `source_url`, `document_url`, `resume`.
  (* = requis ; pour bulletin, date requise, numéro recommandé.)

## Flux de données

```
[/admin/content?kind=] --loadContent(service-role, incl. masqués)--> table + KPIs
  setHidden  -> hidden=true/false (+audit) -> RLS retire/rajoute du public
  deleteContent -> delete (+audit)
  upsertContent(null) -> insert (created_by, dedupe_hash manual) -> content.publish (+audit)
  upsertContent(id)   -> update champs (+audit) -> content.write
Pages publiques (anon) ne voient que hidden=false (RLS).
```

## Gestion d'erreurs

- Champs requis manquants → `{ ok:false, message }`, pas d'écriture.
- `dedupe_hash` en collision (improbable, uuid) → message d'erreur DB remonté.
- kind inconnu → rejet (`ContentKind` typé + garde runtime).
- Erreurs DB → message clair, jamais de throw non géré dans l'action.

## Sécurité / RGPD

- Contenu = **données publiques de marché**, pas de PII. Seul `created_by` (id admin)
  est une donnée perso, tracée légitimement (audit interne).
- Service-role server-only ; actions gardées par `content.read/write/publish` + `recordAudit`.
- La RLS `hidden=false` empêche toute fuite d'un contenu masqué côté public.

## Tests

Frontend sans harness → tsc + build. Vérif ciblée contre prod : créer une entrée
de test → la masquer → confirmer son absence en lecture anon → l'afficher → la supprimer.

## Hors-scope (YAGNI)

- `publications` (pipeline d'import) ; éditeur riche WYSIWYG (résumé = texte) ;
  workflow de validation multi-étapes ; gestion des `instrument_code`/`secteur` au-delà d'un champ libre.
