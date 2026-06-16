# Module Rapports IA (admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vue admin des générations IA (diagnostics + rapports mensuels) avec export markdown et invalidation/régénération des diagnostics.

**Architecture :** Couche données lisant `diagnostic_reports` (fraîcheur 7 j) et `monthly_reports` (email enrichi via `profiles`), une action serveur `invalidateDiagnostic` (delete → régénère au prochain accès), une route d'export `.md`, et une page à onglets `/admin/reports`. 100 % data-backed, aucune modif du pipeline.

**Tech Stack :** Next.js 14 App Router (Server Components + Server Action + Route Handler), TypeScript, Supabase (service-role), TailwindCSS.

---

## File Structure

- `frontend/lib/admin/aiReports.ts` — CRÉÉ : `loadDiagnostics`, `loadMonthlyReports` + types.
- `frontend/app/admin/reports/actions.ts` — CRÉÉ : `invalidateDiagnostic`.
- `frontend/app/admin/reports/export/[code]/route.ts` — CRÉÉ : export markdown.
- `frontend/app/admin/reports/InvalidateButton.tsx` — CRÉÉ : bouton client.
- `frontend/app/admin/reports/page.tsx` — REMPLACE le stub : onglets + tables.

**Réutilise :** `requirePermission` (`lib/server/rbac.ts`), `recordAudit` (`lib/server/audit.ts`), `getServiceClient` (`lib/billing/serviceClient.ts`), kit `@/components/ui/premium`. `/admin/reports` déjà dans `ADMIN_NAV` (`content.read`) → pas de changement nav. Page publique existante `/premium/diagnostic/[code]`.

**Vérification :** frontend sans harness → `npx tsc --noEmit` + `npx next build`. Tâche finale : test prod (insert diagnostic test → invalider → vérifier suppression).

---

### Task 1 : Couche données

**Files:**
- Create: `frontend/lib/admin/aiReports.ts`

- [ ] **Step 1 : Implémenter**

`frontend/lib/admin/aiReports.ts` :
```ts
import { getServiceClient } from '@/lib/billing/serviceClient';

const TTL_MS = 7 * 24 * 3600 * 1000; // 7 jours (TTL applicatif des diagnostics)

export interface DiagnosticRow {
  code: string;
  model_used: string;
  generated_at: string | null;
  stale: boolean;
}
export interface DiagnosticsDashboard {
  rows: DiagnosticRow[];
  kpis: { total: number; stale: number; byModel: Record<string, number> };
}

/** Diagnostics IA (un par action) + KPIs (fraîcheur, répartition modèles). */
export async function loadDiagnostics(): Promise<DiagnosticsDashboard> {
  const db = getServiceClient();
  const { data } = await db
    .from('diagnostic_reports')
    .select('code, model_used, generated_at')
    .order('generated_at', { ascending: false })
    .limit(500);
  const now = Date.now();
  const rows: DiagnosticRow[] = (data ?? []).map((r: Record<string, unknown>) => {
    const gen = (r.generated_at as string) ?? null;
    const stale = gen ? now - new Date(gen).getTime() > TTL_MS : true;
    return { code: r.code as string, model_used: (r.model_used as string) || 'inconnu', generated_at: gen, stale };
  });
  const byModel: Record<string, number> = {};
  for (const r of rows) byModel[r.model_used] = (byModel[r.model_used] ?? 0) + 1;
  return { rows, kpis: { total: rows.length, stale: rows.filter((r) => r.stale).length, byModel } };
}

export interface MonthlyReportRow {
  id: string;
  user_email: string | null;
  month: string;
  sent_at: string | null;
  report_url: string | null;
}
export interface MonthlyReportsDashboard {
  rows: MonthlyReportRow[];
  kpis: { total: number; sent: number };
}

/** Rapports mensuels (métadonnées seulement, PII non exposée) + email enrichi. */
export async function loadMonthlyReports(): Promise<MonthlyReportsDashboard> {
  const db = getServiceClient();
  const { data } = await db
    .from('monthly_reports')
    .select('id, user_id, month, sent_at, report_url')
    .order('month', { ascending: false })
    .limit(300);
  const raw = (data ?? []) as Record<string, unknown>[];
  const userIds = Array.from(new Set(raw.map((r) => r.user_id as string).filter(Boolean)));
  const emailById = new Map<string, string | null>();
  if (userIds.length) {
    const { data: profs } = await db.from('profiles').select('id, email').in('id', userIds);
    for (const p of (profs ?? []) as { id: string; email: string | null }[]) emailById.set(p.id, p.email);
  }
  const rows: MonthlyReportRow[] = raw.map((r) => ({
    id: r.id as string,
    user_email: emailById.get(r.user_id as string) ?? null,
    month: r.month as string,
    sent_at: (r.sent_at as string) ?? null,
    report_url: (r.report_url as string) ?? null,
  }));
  return { rows, kpis: { total: rows.length, sent: rows.filter((r) => r.sent_at).length } };
}
```

- [ ] **Step 2 : Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit` → exit 0.
```bash
git add frontend/lib/admin/aiReports.ts
git commit -m "feat(admin): couche données rapports IA (diagnostics + mensuels)"
```

---

### Task 2 : Action d'invalidation + route d'export

**Files:**
- Create: `frontend/app/admin/reports/actions.ts`
- Create: `frontend/app/admin/reports/export/[code]/route.ts`

- [ ] **Step 1 : Action**

`frontend/app/admin/reports/actions.ts` :
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';

/** Supprime le diagnostic en cache → régénéré à la prochaine consultation. */
export async function invalidateDiagnostic(code: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requirePermission('content.write');
  const { error } = await getServiceClient().from('diagnostic_reports').delete().eq('code', code);
  if (error) return { ok: false, message: error.message };
  await recordAudit(ctx, { action: 'diagnostic.invalidate', resourceType: 'diagnostic', resourceId: code, severity: 'warning' });
  revalidatePath('/admin/reports');
  return { ok: true };
}
```

- [ ] **Step 2 : Route d'export**

`frontend/app/admin/reports/export/[code]/route.ts` :
```ts
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  await requirePermission('content.read');
  const { data } = await getServiceClient()
    .from('diagnostic_reports')
    .select('markdown_content')
    .eq('code', params.code)
    .maybeSingle();
  const md = data?.markdown_content as string | undefined;
  if (!md) return new NextResponse('Diagnostic introuvable.', { status: 404 });
  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="diagnostic-${params.code}.md"`,
    },
  });
}
```

- [ ] **Step 3 : Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit` → exit 0.
```bash
git add frontend/app/admin/reports/actions.ts "frontend/app/admin/reports/export/[code]/route.ts"
git commit -m "feat(admin): invalidateDiagnostic + export markdown des diagnostics"
```

---

### Task 3 : Bouton client + page à onglets

**Files:**
- Create: `frontend/app/admin/reports/InvalidateButton.tsx`
- Modify: `frontend/app/admin/reports/page.tsx` (remplace le stub)

- [ ] **Step 1 : Bouton client**

`frontend/app/admin/reports/InvalidateButton.tsx` :
```tsx
'use client';

import { useState, useTransition } from 'react';
import { invalidateDiagnostic } from './actions';

export function InvalidateButton({ code }: { code: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return <span className="text-faint">Invalidé</span>;
  return (
    <button
      type="button" disabled={pending}
      onClick={() => {
        if (confirm(`Invalider le diagnostic ${code} ? Il sera régénéré à la prochaine consultation.`)) {
          startTransition(async () => { const r = await invalidateDiagnostic(code); if (r.ok) setDone(true); });
        }
      }}
      className="rounded-md border border-down/40 px-2 py-1 text-xs font-medium text-down transition active:scale-95 disabled:opacity-50"
    >
      Invalider
    </button>
  );
}
```

- [ ] **Step 2 : Page**

Écrire `frontend/app/admin/reports/page.tsx` :
```tsx
import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, MetricCard, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { loadDiagnostics, loadMonthlyReports } from '@/lib/admin/aiReports';
import { InvalidateButton } from './InvalidateButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rapports IA — Administration' };

const DASH = '—';
const nf = new Intl.NumberFormat('fr-FR');

function fmtDate(d: string | null): string {
  if (!d) return DASH;
  const p = new Date(d);
  if (Number.isNaN(p.getTime())) return DASH;
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function Page({ searchParams }: { searchParams: { tab?: string } }) {
  await requirePermission('content.read');
  const tab: 'diagnostics' | 'mensuels' = searchParams.tab === 'mensuels' ? 'mensuels' : 'diagnostics';

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader kicker="Administration" title="Rapports IA" subtitle="Diagnostics sell-side et rapports mensuels — générations, exports, régénération." />
      <div className="gold-rule" />
      <nav className="flex gap-2">
        <Link href="/admin/reports?tab=diagnostics" className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${tab === 'diagnostics' ? 'bg-accent text-obsidian font-semibold' : 'border border-border text-muted hover:text-ivory'}`}>Diagnostics</Link>
        <Link href="/admin/reports?tab=mensuels" className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${tab === 'mensuels' ? 'bg-accent text-obsidian font-semibold' : 'border border-border text-muted hover:text-ivory'}`}>Rapports mensuels</Link>
      </nav>
      {tab === 'diagnostics' ? <DiagnosticsTab /> : <MonthlyTab />}
    </div>
  );
}

async function DiagnosticsTab() {
  const { rows, kpis } = await loadDiagnostics();
  const models = Object.entries(kpis.byModel).map(([m, n]) => `${m}:${n}`).join(' · ') || DASH;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="Diagnostics" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Périmés (>7j)" value={nf.format(kpis.stale)} accent={kpis.stale > 0 ? 'gold' : 'neutral'} />
        <MetricCard label="Modèles" value={models} accent="neutral" />
      </div>
      {rows.length === 0 ? (
        <EmptyStatePremium title="Aucun diagnostic" hint="Les diagnostics générés apparaîtront ici." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Modèle</th>
                <th className="px-4 py-3 font-medium">Généré</th>
                <th className="px-4 py-3 font-medium">État</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2.5 text-ivory">{r.code}</td>
                  <td className="px-4 py-2.5 text-muted">{r.model_used}</td>
                  <td className="px-4 py-2.5 text-muted tabular">{fmtDate(r.generated_at)}</td>
                  <td className="px-4 py-2.5">{r.stale ? <StatPill tone="gold">Périmé</StatPill> : <StatPill tone="emerald">À jour</StatPill>}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap gap-2">
                      <Link href={`/premium/diagnostic/${r.code}`} className="rounded-md border border-border px-2 py-1 text-xs text-muted">Voir</Link>
                      <a href={`/admin/reports/export/${r.code}`} className="rounded-md border border-border px-2 py-1 text-xs text-muted">Exporter</a>
                      <InvalidateButton code={r.code} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </>
  );
}

async function MonthlyTab() {
  const { rows, kpis } = await loadMonthlyReports();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Rapports" value={nf.format(kpis.total)} accent="sapphire" />
        <MetricCard label="Envoyés" value={nf.format(kpis.sent)} accent="emerald" />
      </div>
      {rows.length === 0 ? (
        <EmptyStatePremium title="Aucun rapport mensuel" hint="Les rapports mensuels générés apparaîtront ici." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Mois</th>
                <th className="px-4 py-3 font-medium">Envoi</th>
                <th className="px-4 py-3 font-medium">PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2.5 text-ivory">{r.user_email ?? DASH}</td>
                  <td className="px-4 py-2.5 text-muted tabular">{r.month}</td>
                  <td className="px-4 py-2.5">{r.sent_at ? <StatPill tone="emerald">Envoyé</StatPill> : <StatPill tone="neutral">Non envoyé</StatPill>}</td>
                  <td className="px-4 py-2.5">{r.report_url ? <a href={r.report_url} className="text-accent hover:underline" target="_blank" rel="noreferrer">Ouvrir</a> : DASH}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </>
  );
}
```

- [ ] **Step 3 : Typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; routes `/admin/reports` et `/admin/reports/export/[code]` présentes. (Ignorer l'avertissement bénin `/api/paper-trading/stats`.)

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/admin/reports/page.tsx frontend/app/admin/reports/InvalidateButton.tsx
git commit -m "feat(admin): page Rapports IA à onglets (diagnostics + mensuels) + invalidation"
```

---

### Task 4 : Vérification finale + merge

- [ ] **Step 1 : Build complet**

Run: `cd frontend && npx tsc --noEmit && npx next build`
Expected: exit 0 ; routes présentes.

- [ ] **Step 2 : Merge sur main + push**

```bash
git checkout main
git merge --no-ff feat/admin-rapports-ia -m "merge: module Rapports IA admin (générations + exports + régénération) — sous-projet c3"
git push origin main
```

- [ ] **Step 3 : Vérification ciblée prod (par le contrôleur)**

Le contrôleur exécute un test REST (service-role + anon) : insérer un `diagnostic_reports`
de test (code existant, ex. 'SNTS' n'a pas d'unicité conflit si déjà là → utiliser un upsert
ou un code de test) → confirmer que `loadDiagnostics` le verrait → appeler la suppression
(simulant `invalidateDiagnostic`) → confirmer la disparition. (Le diagnostic réel se
régénère ensuite via `/api/diagnostic/[code]`.)

---

## Self-Review

**1. Spec coverage**
- Couche données diagnostics + mensuels (fraîcheur, email enrichi) → Task 1. ✅
- `invalidateDiagnostic` (delete → régénère) → Task 2. ✅
- Export markdown → Task 2 (route). ✅
- Page à onglets + KPIs + tables + actions (Voir/Exporter/Invalider, PDF mensuel) → Task 3. ✅
- RGPD (mensuels = métadonnées seulement) → Task 1 (`loadMonthlyReports` ne lit pas `report_json`) + Task 3 (table sans contenu). ✅
- Permissions (`content.read`/`content.write`) + audit → Tasks 2, 3. ✅

**2. Placeholder scan** : aucun TODO/TBD ; code complet partout.

**3. Type consistency** : `DiagnosticRow`/`DiagnosticsDashboard`/`MonthlyReportRow`/`MonthlyReportsDashboard`/`loadDiagnostics`/`loadMonthlyReports` (T1) consommés en T3. `invalidateDiagnostic(code)` (T2) appelé par `InvalidateButton` (T3). Route export `/admin/reports/export/[code]` (T2) liée depuis la page (T3). `loadMonthlyReports` ne sélectionne PAS `report_json` (PII) — conforme à la spec. ✅

**Risque résiduel** : aucun bloquant. Les pages sont `force-dynamic` (pas de pré-rendu au build). `diagnostic_reports.markdown_content` peut être volumineux mais l'export le sert en flux (pas de souci mémoire à l'échelle actuelle).
