# Module Rapports IA (admin) — Design

**Date :** 2026-06-16
**Statut :** approuvé (brainstorming)
**Sous-projet (c3)** du lot « gestion admin » (ordre : b ✅ → Contenu ✅ → Rapports IA → Organisations).

## Objectif

Donner à l'admin une vue des **générations IA** (diagnostics sell-side par action,
rapports mensuels par utilisateur), avec **export** et **invalidation/régénération**
des diagnostics. Remplace le stub `/admin/reports`. **100 % data-backed** — pas de
modification du pipeline de génération.

## Décision structurante (validée)

Périmètre : **dashboard générations + exports + régénération**. Hors-scope (net-neuf,
sans données) : suivi des **coûts** LLM et **templates** de prompts.

## Contexte existant (réutilisé)

- `diagnostic_reports(id, code→brvm_instruments, generated_at, model_used, markdown_content, metrics_snapshot, unique(code))` — un diagnostic par action, TTL applicatif 7 j, lecture publique.
- `monthly_reports(id, user_id→auth.users, month '^\d{4}-\d{2}$', report_url, report_json, sent_at, created_at)` — un rapport mensuel par user/mois.
- `profiles(id, email)` pour enrichir l'email.
- Page publique existante `/premium/diagnostic/[code]` (affiche le diagnostic).
- `requirePermission`, `recordAudit`, `getServiceClient`, kit `@/components/ui/premium`.
- `/admin/reports` déjà dans `ADMIN_NAV` (`content.read`) → pas de changement nav.

## Architecture

### 1. Couche données — `lib/admin/aiReports.ts`

- `DiagnosticRow { code: string; model_used: string; generated_at: string | null; stale: boolean }`
  où `stale = generated_at < (now - 7 jours)`.
- `DiagnosticsDashboard { rows: DiagnosticRow[]; kpis: { total: number; stale: number; byModel: Record<string, number> } }`.
- `loadDiagnostics(): Promise<DiagnosticsDashboard>` — `diagnostic_reports` ordonné par `generated_at desc`, calcule `stale` + KPIs (service-role).
- `MonthlyReportRow { id: string; user_email: string | null; month: string; sent_at: string | null; report_url: string | null }`.
- `MonthlyReportsDashboard { rows: MonthlyReportRow[]; kpis: { total: number; sent: number } }`.
- `loadMonthlyReports(): Promise<MonthlyReportsDashboard>` — `monthly_reports` ordonné par `month desc`, email enrichi via `profiles` (requête séparée par `user_id`, comme `payments.ts`).

### 2. Action — `app/admin/reports/actions.ts`

- `invalidateDiagnostic(code: string): Promise<{ ok; message? }>` — `requirePermission('content.write')` ;
  `delete from diagnostic_reports where code = ...` (force la régénération à la prochaine
  consultation, le cache étant vide) ; `recordAudit(action='diagnostic.invalidate', resourceType='diagnostic', resourceId=code, severity='warning')` ; `revalidatePath('/admin/reports')`.

### 3. Export — `app/admin/reports/export/[code]/route.ts`

- `GET` (`content.read`) → lit `markdown_content` du diagnostic du `code` → renvoie un
  fichier `.md` (`Content-Type: text/markdown`, `Content-Disposition: attachment`).
  404-like (message) si introuvable.

### 4. Page — `app/admin/reports/page.tsx` (remplace le stub)

- `content.read` ; **onglets** via `?tab=diagnostics|mensuels` (défaut `diagnostics`).
- **Diagnostics** : KPIs (total, périmés, par modèle) + table : code, modèle, date,
  badge « à jour / périmé », actions **Voir** (lien `/premium/diagnostic/[code]`),
  **Exporter** (lien `/admin/reports/export/[code]`), **Invalider** (composant client).
- **Mensuels** : KPIs (total, envoyés) + table : utilisateur (email), mois, statut
  d'envoi (`sent_at`), lien **PDF** si `report_url`. **Aucun dump du contenu** (PII).
- Composant client `InvalidateButton.tsx` (appelle `invalidateDiagnostic`).

## Flux de données

```
[/admin/reports?tab=diagnostics] --loadDiagnostics--> KPIs + table
  Voir      -> lien /premium/diagnostic/[code]
  Exporter  -> GET /admin/reports/export/[code] -> .md
  Invalider -> invalidateDiagnostic(code) -> delete (cache vidé) -> régénère à la prochaine vue (+audit)
[?tab=mensuels] --loadMonthlyReports--> métadonnées (email, mois, envoi, lien PDF)
```

## Gestion d'erreurs

- Export d'un code inexistant → page/texte « Diagnostic introuvable » (pas de 500).
- `invalidateDiagnostic` sur code absent → `delete` sans effet, `{ ok: true }` (idempotent).
- Erreurs DB → message clair, jamais de throw non géré.

## Sécurité / RGPD

- Diagnostics = **analyse de marché publique** (pas de PII) → consultation/export libres.
- **Rapports mensuels = PII** (`report_json` = portefeuille de l'utilisateur) → l'admin ne
  voit que les **métadonnées** (email, mois, envoi, lien PDF), jamais le contenu en masse.
- Service-role server-only ; actions gardées par `content.read/write` + `recordAudit`.

## Tests

Frontend sans harness → tsc + build. Vérif ciblée prod : `loadDiagnostics`/`loadMonthlyReports`
renvoient (ou vide proprement) ; invalider un diagnostic de test (insert service-role →
invalidate → vérifier suppression).

## Hors-scope (YAGNI — confirmé)

Suivi des coûts LLM (instrumentation des routes de génération + table `llm_usage`) ;
templates de prompts éditables (table + lecture en base par le pipeline). Faisables ultérieurement.
