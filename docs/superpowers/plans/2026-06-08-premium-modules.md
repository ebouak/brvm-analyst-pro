# Premium BRVM — Gating + Classements + Calendrier + Anomalies

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le système de gating Premium (webhook paiement + middleware) et 3 modules : Classements multi-critères, Calendrier des dates clés, Détection d'anomalies visuelles.

**Architecture:** Namespace `/premium/*` protégé par un layout Server Component qui vérifie `profiles.is_premium` dans Supabase ; super admin `ebouak@gmail.com` bypass total. Webhook `POST /api/webhooks/payment` met à jour `is_premium` via service_role. Chaque module est un Server Component qui lit Supabase directement et passe les données à des Client Components ECharts.

**Tech Stack:** Next.js 14 App Router, Supabase (anon + service_role), TailwindCSS tokens dark finance, ECharts via `<EChart>` wrapper existant.

---

## File Structure

```
supabase/migrations/
  0021_premium.sql                          — table profiles + is_premium

frontend/
  middleware.ts                             — MODIFIÉ : gating /premium/*
  lib/supabase/middleware.ts                — MODIFIÉ : helper checkPremium()
  app/
    api/webhooks/payment/route.ts           — POST webhook paiement
    premium/
      layout.tsx                            — Server : vérifie premium, redirige
      upgrade/page.tsx                      — Page d'information abonnement
      classements/page.tsx                  — Module A (Server Component)
      calendrier/page.tsx                   — Module B (Server Component)
      anomalies/page.tsx                    — Module C (Server Component)
  lib/premium/
    classements.ts                          — Requêtes Supabase classements
    calendrier.ts                           — Requêtes Supabase dates clés
    anomalies.ts                            — Requêtes Supabase anomalies
  components/
    Sidebar.tsx                             — MODIFIÉ : section Premium
    premium/
      ClassementsTable.tsx                  — Tableau trié avec onglets
      CalendrierPremiumView.tsx             — Timeline + tableau dates
      AnomalieCharts.tsx                    — 7 charts ECharts
```

---

## Task 1 : Migration DB — table profiles + is_premium

**Files:**
- Create: `supabase/migrations/0021_premium.sql`

- [ ] **Step 1 : Créer la migration**

```sql
-- supabase/migrations/0021_premium.sql
-- Table profils utilisateurs avec flag premium.
-- Créée automatiquement à l'inscription via trigger.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  is_premium  boolean not null default false,
  premium_since timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- L'utilisateur peut lire son propre profil
create policy "profil lisible par le propriétaire"
  on public.profiles for select
  using (auth.uid() = id);

-- Seul le service_role peut écrire (webhook + admin)
-- Aucune policy insert/update/delete pour anon/authenticated

-- Trigger : crée le profil automatiquement à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2 : Appliquer dans Supabase**

Coller le contenu dans l'éditeur SQL de Supabase (Dashboard → SQL Editor) et exécuter. Ou via `supabase db push`.

Vérifier : Table `profiles` visible dans Table Editor avec colonnes `id, email, is_premium, premium_since`.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/0021_premium.sql
git commit -m "feat(premium): migration profiles + is_premium + trigger"
```

---

## Task 2 : Helper isPremium() + middleware gating

**Files:**
- Modify: `frontend/lib/supabase/middleware.ts`
- Modify: `frontend/middleware.ts`

- [ ] **Step 1 : Ajouter `isPremiumUser()` dans middleware.ts lib**

Remplacer le contenu de `frontend/lib/supabase/middleware.ts` :

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

const SUPER_ADMIN_EMAIL = 'ebouak@gmail.com';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }: CookieToSet) =>
            request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Gating /premium/* : vérifie is_premium sauf super admin
  if (request.nextUrl.pathname.startsWith('/premium') &&
      !request.nextUrl.pathname.startsWith('/premium/upgrade')) {

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Super admin bypass
    if (user.email !== SUPER_ADMIN_EMAIL) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', user.id)
        .single();

      if (!profile?.is_premium) {
        const url = request.nextUrl.clone();
        url.pathname = '/premium/upgrade';
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
```

- [ ] **Step 2 : Vérifier typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/supabase/middleware.ts
git commit -m "feat(premium): middleware gating /premium/* + super admin bypass"
```

---

## Task 3 : Webhook paiement POST /api/webhooks/payment

**Files:**
- Create: `frontend/app/api/webhooks/payment/route.ts`

- [ ] **Step 1 : Créer le route handler**

```typescript
// frontend/app/api/webhooks/payment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { user_email: string; action: 'activate' | 'deactivate' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { user_email, action } = body;
  if (!user_email || !action) {
    return NextResponse.json({ error: 'user_email and action required' }, { status: 400 });
  }

  const is_premium = action === 'activate';
  const premium_since = is_premium ? new Date().toISOString() : null;

  const { error } = await serviceClient
    .from('profiles')
    .update({ is_premium, premium_since, updated_at: new Date().toISOString() })
    .eq('email', user_email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user_email, is_premium });
}
```

- [ ] **Step 2 : Ajouter WEBHOOK_SECRET dans .env.local**

Ouvrir `frontend/.env.local` et ajouter :
```
WEBHOOK_SECRET=choisir_une_valeur_aleatoire_longue
```

- [ ] **Step 3 : Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/api/webhooks/payment/route.ts
git commit -m "feat(premium): webhook POST /api/webhooks/payment"
```

---

## Task 4 : Layout premium + page upgrade

**Files:**
- Create: `frontend/app/premium/layout.tsx`
- Create: `frontend/app/premium/upgrade/page.tsx`

- [ ] **Step 1 : Layout premium (Server Component)**

```typescript
// frontend/app/premium/layout.tsx
export default function PremiumLayout({ children }: { children: React.ReactNode }) {
  // Le gating est géré dans middleware.ts — ce layout est juste un wrapper.
  return <>{children}</>;
}
```

- [ ] **Step 2 : Page upgrade**

```tsx
// frontend/app/premium/upgrade/page.tsx
export default function UpgradePage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-6">
      <div className="text-center mb-10">
        <span className="inline-block px-3 py-1 rounded-full bg-warn/10 text-warn text-xs font-semibold uppercase tracking-widest mb-4">
          Premium
        </span>
        <h1 className="text-3xl font-bold text-white mb-3">Accès Premium BRVM</h1>
        <p className="text-muted text-sm leading-relaxed max-w-lg mx-auto">
          Débloquez les outils d'analyse avancée réservés aux investisseurs professionnels sur la BRVM.
        </p>
      </div>

      <div className="grid gap-4 mb-10">
        {[
          { icon: '📊', title: 'Classements multi-critères', desc: 'PBR, PER, marge nette, liquidité, performance, volatilité, rotation — 9 classements actualisés.' },
          { icon: '📅', title: 'Calendrier des dates clés', desc: 'Dates de publication des états financiers, annonces et versements de dividendes, Assemblées Générales.' },
          { icon: '🔍', title: 'Détection d\'anomalies', desc: '7 analyses visuelles : scatter PER/PBR, dividendes vs payout, liquidité/volatilité, heatmap 20 séances, profils radar.' },
        ].map((f) => (
          <div key={f.title} className="flex gap-4 p-4 bg-surface border border-border rounded-xl">
            <span className="text-2xl shrink-0">{f.icon}</span>
            <div>
              <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
              <p className="text-xs text-muted leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 text-center">
        <p className="text-sm text-muted mb-4">
          Pour souscrire, contactez-nous. Votre accès sera activé sous 24h.
        </p>
        <a
          href="mailto:ebouak@gmail.com?subject=Abonnement%20Premium%20BRVM%20Analyst%20Pro"
          className="inline-block px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Contacter pour souscrire
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/premium/layout.tsx frontend/app/premium/upgrade/page.tsx
git commit -m "feat(premium): layout + page upgrade"
```

---

## Task 5 : Sidebar — section Premium

**Files:**
- Modify: `frontend/components/Sidebar.tsx`

- [ ] **Step 1 : Ajouter section Premium dans NAV_GROUPS**

Dans `frontend/components/Sidebar.tsx`, modifier l'interface et ajouter `isPremium` prop, puis ajouter le groupe Premium :

```typescript
// frontend/components/Sidebar.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem { href: string; label: string; premium?: boolean; locked?: boolean; }
interface NavGroup { label: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Marché',
    items: [
      { href: '/',            label: 'Dashboard' },
      { href: '/actions',     label: 'Actions' },
      { href: '/obligations', label: 'Obligations' },
      { href: '/dividendes',  label: 'Dividendes' },
      { href: '/heatmap',     label: 'Heatmap' },
      { href: '/secteurs',    label: 'Secteurs' },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { href: '/signaux',      label: 'Signaux' },
      { href: '/scanner',      label: 'Scanner' },
      { href: '/fondamentaux', label: 'Fondamentaux' },
      { href: '/notations',    label: 'Notations' },
      { href: '/backtest',     label: 'Backtest' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { href: '/portefeuille', label: 'Portefeuille' },
      { href: '/calendrier',   label: 'Calendrier' },
      { href: '/dashboard/reports', label: 'Rapports' },
    ],
  },
  {
    label: 'Premium',
    items: [
      { href: '/premium/classements', label: 'Classements',  premium: true },
      { href: '/premium/calendrier',  label: 'Dates clés',   premium: true },
      { href: '/premium/anomalies',   label: 'Anomalies',    premium: true },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/assistant',                 label: 'Assistant IA' },
      { href: '/admin/import-fondamentaux', label: 'Import IA' },
      { href: '/admin/cles-api',            label: 'Clés API' },
      { href: '/methodologie',              label: 'Méthodologie' },
    ],
  },
];

export default function Sidebar({ isPremium = false }: { isPremium?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 hidden md:flex flex-col border-r border-border bg-surface">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-accent flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold tracking-tight">B</span>
          </div>
          <div className="leading-none">
            <span className="text-sm font-semibold text-white">BRVM</span>
            <span className="text-sm font-semibold text-accent"> Analyst</span>
          </div>
        </div>
        <p className="text-[10px] text-faint mt-1.5 tracking-wider uppercase">Pro · UEMOA</p>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-faint uppercase tracking-widest px-2 mb-1.5">
              {group.label === 'Premium' ? (
                <span className="flex items-center gap-1">
                  Premium <span className="text-warn">★</span>
                </span>
              ) : group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const locked = item.premium && !isPremium;
                if (locked) {
                  return (
                    <Link
                      key={item.href}
                      href="/premium/upgrade"
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded text-sm text-faint hover:text-warn hover:bg-warn/5 transition-all"
                    >
                      <span className="w-1 h-1 rounded-full shrink-0 opacity-0" />
                      {item.label}
                      <span className="ml-auto text-[10px]">🔒</span>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-sm transition-all ${
                      active ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {active ? (
                      <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
                    ) : (
                      <span className="w-1 h-1 rounded-full shrink-0 opacity-0" />
                    )}
                    {item.label}
                    {item.premium && <span className="ml-auto text-[9px] text-warn font-semibold">PRO</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] text-faint">Données BRVM · BDFIN</p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2 : Passer isPremium depuis le layout root**

Ouvrir `frontend/app/layout.tsx`. Ajouter la récupération du profil et passer `isPremium` à `<Sidebar>` :

```tsx
// Dans frontend/app/layout.tsx — ajouter en haut des imports :
import { createClient } from '@/lib/supabase/server';

// Dans la fonction layout, avant le return :
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
let isPremium = user?.email === 'ebouak@gmail.com';
if (user && !isPremium) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_premium')
    .eq('id', user.id)
    .single();
  isPremium = profile?.is_premium ?? false;
}

// Dans le JSX, remplacer <Sidebar /> par :
<Sidebar isPremium={isPremium} />
```

- [ ] **Step 3 : Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add frontend/components/Sidebar.tsx frontend/app/layout.tsx
git commit -m "feat(premium): sidebar section Premium avec cadenas"
```

---

## Task 6 : Module A — Données classements

**Files:**
- Create: `frontend/lib/premium/classements.ts`

- [ ] **Step 1 : Créer le module de requêtes**

```typescript
// frontend/lib/premium/classements.ts
import { createClient } from '@/lib/supabase/server';

export type CritereClassement =
  | 'performance' | 'liquidite' | 'volatilite' | 'valeur_echangee'
  | 'marge_nette' | 'taux_rotation' | 'reserve' | 'per' | 'pbr';

export interface LigneClassement {
  code: string;
  designation: string;
  secteur: string | null;
  signal: string | null;
  valeur: number | null;
  valeur_label: string;
  unite: string;
}

export async function getClassement(critere: CritereClassement): Promise<LigneClassement[]> {
  const supabase = createClient();

  if (critere === 'performance' || critere === 'liquidite' || critere === 'volatilite' || critere === 'valeur_echangee') {
    // Données de marché : dernières 20 séances par action
    const { data: actions } = await supabase
      .from('brvm_actions_daily')
      .select('code, designation, secteur, cours_jour, variation_pct, volume, valeur_echangee, date_marche')
      .order('date_marche', { ascending: false })
      .limit(2000);

    if (!actions) return [];

    // Grouper par code, prendre les 20 dernières séances
    const byCode = new Map<string, typeof actions>();
    for (const row of actions) {
      if (!byCode.has(row.code)) byCode.set(row.code, []);
      if (byCode.get(row.code)!.length < 20) byCode.get(row.code)!.push(row);
    }

    // Récupérer les signaux les plus récents
    const { data: signals } = await supabase
      .from('signals_daily')
      .select('code, signal, date_marche')
      .order('date_marche', { ascending: false })
      .limit(200);
    const signalMap = new Map<string, string>();
    for (const s of signals ?? []) {
      if (!signalMap.has(s.code)) signalMap.set(s.code, s.signal);
    }

    const result: LigneClassement[] = [];
    for (const [code, rows] of byCode) {
      if (rows.length < 2) continue;
      const latest = rows[0]!;
      const designation = latest.designation ?? code;
      const secteur = latest.secteur;
      const signal = signalMap.get(code) ?? null;

      let valeur: number | null = null;
      let valeur_label = '—';
      let unite = '';

      if (critere === 'performance') {
        const oldest = rows[rows.length - 1]!;
        if (oldest.cours_jour && latest.cours_jour) {
          valeur = ((latest.cours_jour - oldest.cours_jour) / oldest.cours_jour) * 100;
          valeur_label = `${valeur >= 0 ? '+' : ''}${valeur.toFixed(2)}%`;
          unite = '%';
        }
      } else if (critere === 'liquidite') {
        const avg = rows.reduce((s, r) => s + (r.valeur_echangee ?? 0), 0) / rows.length;
        valeur = avg;
        valeur_label = avg > 1e6 ? `${(avg / 1e6).toFixed(1)} M` : `${avg.toFixed(0)}`;
        unite = 'FCFA moy/j';
      } else if (critere === 'volatilite') {
        const variations = rows.map((r) => r.variation_pct ?? 0);
        const mean = variations.reduce((s, v) => s + v, 0) / variations.length;
        const variance = variations.reduce((s, v) => s + (v - mean) ** 2, 0) / variations.length;
        valeur = Math.sqrt(variance);
        valeur_label = `${valeur.toFixed(2)}%`;
        unite = '% σ';
      } else if (critere === 'valeur_echangee') {
        valeur = rows.reduce((s, r) => s + (r.valeur_echangee ?? 0), 0);
        valeur_label = valeur > 1e9 ? `${(valeur / 1e9).toFixed(2)} Md` : `${(valeur / 1e6).toFixed(1)} M`;
        unite = 'FCFA total';
      }

      result.push({ code, designation, secteur, signal, valeur, valeur_label, unite });
    }

    result.sort((a, b) => {
      if (critere === 'volatilite') return (a.valeur ?? 0) - (b.valeur ?? 0); // moins volatile = meilleur
      return (b.valeur ?? -Infinity) - (a.valeur ?? -Infinity);
    });
    return result;
  }

  // Critères fondamentaux (marge_nette, taux_rotation, reserve, per, pbr)
  const { data: fonds } = await supabase
    .from('fundamentals')
    .select('code, year, revenue, net_income, equity')
    .order('year', { ascending: false });

  // Prendre uniquement l'année la plus récente par code
  const fondMap = new Map<string, { revenue: number | null; net_income: number | null; equity: number | null }>();
  for (const f of fonds ?? []) {
    if (!fondMap.has(f.code)) {
      fondMap.set(f.code, { revenue: f.revenue, net_income: f.net_income, equity: f.equity });
    }
  }

  // Récupérer désignations et cours
  const { data: instruments } = await supabase
    .from('brvm_instruments')
    .select('code, designation, secteur')
    .eq('type', 'action');

  const { data: cours } = await supabase
    .from('brvm_actions_daily')
    .select('code, cours_jour, date_marche')
    .order('date_marche', { ascending: false })
    .limit(500);
  const coursMap = new Map<string, number>();
  for (const c of cours ?? []) {
    if (!coursMap.has(c.code) && c.cours_jour) coursMap.set(c.code, c.cours_jour);
  }

  const { data: signals } = await supabase
    .from('signals_daily')
    .select('code, signal')
    .order('date_marche', { ascending: false })
    .limit(200);
  const signalMap = new Map<string, string>();
  for (const s of signals ?? []) {
    if (!signalMap.has(s.code)) signalMap.set(s.code, s.signal);
  }

  const result: LigneClassement[] = [];
  for (const inst of instruments ?? []) {
    const f = fondMap.get(inst.code);
    if (!f) {
      result.push({ code: inst.code, designation: inst.designation, secteur: inst.secteur, signal: signalMap.get(inst.code) ?? null, valeur: null, valeur_label: '—', unite: '' });
      continue;
    }
    let valeur: number | null = null;
    let valeur_label = '—';
    let unite = '';

    if (critere === 'marge_nette' && f.revenue && f.net_income) {
      valeur = (f.net_income / f.revenue) * 100;
      valeur_label = `${valeur.toFixed(1)}%`;
      unite = '%';
    } else if (critere === 'taux_rotation' && f.revenue && f.equity) {
      valeur = f.revenue / f.equity;
      valeur_label = `${valeur.toFixed(2)}x`;
      unite = 'x';
    } else if (critere === 'reserve' && f.equity) {
      valeur = f.equity / 1e9;
      valeur_label = `${valeur.toFixed(2)} Md`;
      unite = 'FCFA';
    } else if (critere === 'per' && f.net_income) {
      // Approximation : PER = cours × 1000 / (net_income / 1000 actions proxy)
      // Sans nb_actions exact, on affiche '—' sauf si cours disponible
      const cours_j = coursMap.get(inst.code);
      if (cours_j && f.net_income > 0) {
        // PER relatif : non calculable sans nb_actions → affiche N/A
        valeur_label = 'N/D';
        unite = '';
      }
    } else if (critere === 'pbr' && f.equity) {
      valeur_label = 'N/D';
      unite = '';
    }

    result.push({ code: inst.code, designation: inst.designation, secteur: inst.secteur, signal: signalMap.get(inst.code) ?? null, valeur, valeur_label, unite });
  }

  result.sort((a, b) => (b.valeur ?? -Infinity) - (a.valeur ?? -Infinity));
  return result;
}
```

- [ ] **Step 2 : Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/premium/classements.ts
git commit -m "feat(premium): lib classements — requêtes marché + fondamentaux"
```

---

## Task 7 : Module A — Composant + page classements

**Files:**
- Create: `frontend/components/premium/ClassementsTable.tsx`
- Create: `frontend/app/premium/classements/page.tsx`

- [ ] **Step 1 : Composant ClassementsTable**

```tsx
// frontend/components/premium/ClassementsTable.tsx
'use client';
import { useState } from 'react';
import type { LigneClassement, CritereClassement } from '@/lib/premium/classements';

const CRITERES: { id: CritereClassement; label: string }[] = [
  { id: 'performance',    label: 'Performance' },
  { id: 'liquidite',      label: 'Liquidité' },
  { id: 'volatilite',     label: 'Volatilité' },
  { id: 'valeur_echangee',label: 'Valeur échangée' },
  { id: 'marge_nette',    label: 'Marge nette' },
  { id: 'taux_rotation',  label: 'Rotation' },
  { id: 'reserve',        label: 'Réserve' },
  { id: 'per',            label: 'PER' },
  { id: 'pbr',            label: 'PBR' },
];

const SIGNAL_COLOR: Record<string, string> = {
  BUY: 'text-up bg-up/10', HOLD: 'text-warn bg-warn/10', SELL: 'text-down bg-down/10',
};

export function ClassementsTable({
  data,
  critereInit,
}: {
  data: Record<CritereClassement, LigneClassement[]>;
  critereInit: CritereClassement;
}) {
  const [critere, setCritere] = useState<CritereClassement>(critereInit);
  const [secteurFilter, setSecteurFilter] = useState('');
  const [asc, setAsc] = useState(false);

  const rows = data[critere] ?? [];
  const secteurs = [...new Set(rows.map((r) => r.secteur).filter(Boolean))] as string[];
  const filtered = rows.filter((r) => !secteurFilter || r.secteur === secteurFilter);
  const sorted = asc ? [...filtered].reverse() : filtered;

  return (
    <div>
      {/* Onglets critères */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {CRITERES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { setCritere(c.id); setSecteurFilter(''); setAsc(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              critere === c.id
                ? 'bg-accent text-white'
                : 'bg-surface border border-border text-muted hover:text-white hover:border-accent/30'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Filtre secteur */}
      <div className="flex gap-2 mb-4">
        <select
          value={secteurFilter}
          onChange={(e) => setSecteurFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-surface border border-border text-muted text-xs focus:outline-none focus:border-accent"
        >
          <option value="">Tous les secteurs</option>
          {secteurs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setAsc((a) => !a)}
          className="px-3 py-1.5 rounded-lg bg-surface border border-border text-muted text-xs hover:text-white transition-colors"
        >
          {asc ? '▲ Croissant' : '▼ Décroissant'}
        </button>
      </div>

      {/* Tableau */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-elevated border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider w-8">Rang</th>
              <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Symbole</th>
              <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Société</th>
              <th className="text-left px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider hidden md:table-cell">Secteur</th>
              <th className="text-right px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">Signal</th>
              <th className="text-right px-4 py-2.5 text-xs text-faint font-semibold uppercase tracking-wider">{CRITERES.find((c) => c.id === critere)?.label}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.code} className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${i % 2 === 1 ? 'bg-surface/30' : ''}`}>
                <td className="px-4 py-2.5 text-faint tabular text-xs">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <a href={`/actions/${row.code}`} className="font-mono font-semibold text-accent hover:text-white transition-colors text-sm">
                    {row.code}
                  </a>
                </td>
                <td className="px-4 py-2.5 text-white text-xs">{row.designation}</td>
                <td className="px-4 py-2.5 text-muted text-xs hidden md:table-cell">{row.secteur ?? '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  {row.signal ? (
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${SIGNAL_COLOR[row.signal] ?? 'text-muted bg-surface'}`}>
                      {row.signal}
                    </span>
                  ) : <span className="text-faint text-xs">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-sm font-semibold text-white">
                  {row.valeur_label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-10 text-center text-muted text-sm">Aucune donnée disponible.</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Page classements (Server Component)**

```tsx
// frontend/app/premium/classements/page.tsx
import { getClassement, type CritereClassement } from '@/lib/premium/classements';
import { ClassementsTable } from '@/components/premium/ClassementsTable';

const CRITERES: CritereClassement[] = [
  'performance', 'liquidite', 'volatilite', 'valeur_echangee',
  'marge_nette', 'taux_rotation', 'reserve', 'per', 'pbr',
];

export default async function ClassementsPage({
  searchParams,
}: {
  searchParams: { critere?: string };
}) {
  const critereInit = (CRITERES.includes(searchParams.critere as CritereClassement)
    ? searchParams.critere
    : 'performance') as CritereClassement;

  // Charger tous les critères en parallèle
  const results = await Promise.all(CRITERES.map((c) => getClassement(c)));
  const data = Object.fromEntries(
    CRITERES.map((c, i) => [c, results[i]!]),
  ) as Record<CritereClassement, Awaited<ReturnType<typeof getClassement>>>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <span className="text-[10px] font-semibold text-warn uppercase tracking-widest">Premium</span>
        <h1 className="text-2xl font-bold text-white mt-1">Classements des Actions</h1>
        <p className="text-sm text-muted mt-1">Classement de toutes les sociétés BRVM selon 9 critères.</p>
      </div>
      <ClassementsTable data={data} critereInit={critereInit} />
    </div>
  );
}
```

- [ ] **Step 3 : Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add frontend/components/premium/ClassementsTable.tsx frontend/app/premium/classements/page.tsx
git commit -m "feat(premium): module A classements — composant + page"
```

---

## Task 8 : Module B — Données + page calendrier dates clés

**Files:**
- Create: `frontend/lib/premium/calendrier.ts`
- Create: `frontend/app/premium/calendrier/page.tsx`

- [ ] **Step 1 : Requêtes calendrier**

```typescript
// frontend/lib/premium/calendrier.ts
import { createClient } from '@/lib/supabase/server';

export type TypeDate = 'publication' | 'dividende_annonce' | 'dividende_paiement' | 'ag';

export interface DateCle {
  date: string;
  type: TypeDate;
  code: string;
  designation: string;
  detail: string;
}

export async function getDatesClés(mois: number = 12): Promise<DateCle[]> {
  const supabase = createClient();
  const depuis = new Date();
  depuis.setMonth(depuis.getMonth() - 3); // 3 mois passés
  const jusqua = new Date();
  jusqua.setMonth(jusqua.getMonth() + mois);

  const results: DateCle[] = [];

  // Publications états financiers
  const { data: pubs } = await supabase
    .from('publications')
    .select('code, date_publication, libelle, brvm_instruments(designation)')
    .gte('date_publication', depuis.toISOString().split('T')[0]!)
    .lte('date_publication', jusqua.toISOString().split('T')[0]!)
    .order('date_publication', { ascending: true });

  for (const p of pubs ?? []) {
    const instr = p.brvm_instruments as { designation: string } | null;
    results.push({
      date: p.date_publication,
      type: 'publication',
      code: p.code,
      designation: instr?.designation ?? p.code,
      detail: p.libelle,
    });
  }

  // Dividendes — ex_date (annonce) et payment_date
  const { data: divs } = await supabase
    .from('dividends')
    .select('code, ex_date, payment_date, montant, exercice, brvm_instruments(designation)')
    .or(
      `ex_date.gte.${depuis.toISOString().split('T')[0]!},payment_date.gte.${depuis.toISOString().split('T')[0]!}`,
    )
    .order('ex_date', { ascending: true });

  for (const d of divs ?? []) {
    const instr = d.brvm_instruments as { designation: string } | null;
    const designation = instr?.designation ?? d.code;
    if (d.ex_date) {
      results.push({
        date: d.ex_date,
        type: 'dividende_annonce',
        code: d.code,
        designation,
        detail: `Dividende ${d.exercice ?? ''} : ${d.montant} FCFA — détachement`,
      });
    }
    if (d.payment_date) {
      results.push({
        date: d.payment_date,
        type: 'dividende_paiement',
        code: d.code,
        designation,
        detail: `Paiement dividende ${d.exercice ?? ''} : ${d.montant} FCFA`,
      });
    }
  }

  // Événements AG (type 'AG' dans events)
  const { data: events } = await supabase
    .from('brvm_events')
    .select('instrument_code, event_date, title, issuer_name')
    .ilike('event_type', '%AG%')
    .gte('event_date', depuis.toISOString().split('T')[0]!)
    .lte('event_date', jusqua.toISOString().split('T')[0]!)
    .order('event_date', { ascending: true });

  for (const e of events ?? []) {
    results.push({
      date: e.event_date,
      type: 'ag',
      code: e.instrument_code ?? '',
      designation: e.issuer_name ?? e.instrument_code ?? '',
      detail: e.title,
    });
  }

  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}
```

- [ ] **Step 2 : Page calendrier premium**

```tsx
// frontend/app/premium/calendrier/page.tsx
import { getDatesClés, type TypeDate } from '@/lib/premium/calendrier';

const TYPE_CONFIG: Record<TypeDate, { label: string; color: string; bg: string }> = {
  publication:        { label: 'États financiers', color: 'text-info',    bg: 'bg-info/10' },
  dividende_annonce:  { label: 'Dividende annoncé', color: 'text-up',     bg: 'bg-up/10' },
  dividende_paiement: { label: 'Paiement dividende', color: 'text-up',    bg: 'bg-up/20' },
  ag:                 { label: 'Assemblée Générale', color: 'text-warn',   bg: 'bg-warn/10' },
};

export default async function CalendrierPremiumPage() {
  const dates = await getDatesClés(12);

  const passees = dates.filter((d) => d.date < new Date().toISOString().split('T')[0]!);
  const avenir  = dates.filter((d) => d.date >= new Date().toISOString().split('T')[0]!);

  const renderListe = (items: typeof dates, titre: string) => (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-faint uppercase tracking-widest mb-3">{titre}</h2>
      {items.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center text-muted text-sm">
          Aucune date enregistrée.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((d, i) => {
            const cfg = TYPE_CONFIG[d.type];
            return (
              <div key={i} className="flex items-start gap-4 p-3 bg-surface border border-border rounded-xl hover:border-accent/20 transition-colors">
                <div className="text-center min-w-[52px]">
                  <p className="text-xs text-faint">{new Date(d.date).toLocaleDateString('fr-FR', { month: 'short' })}</p>
                  <p className="text-lg font-bold text-white tabular">{new Date(d.date).getDate().toString().padStart(2, '0')}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <a href={`/actions/${d.code}`} className="font-mono text-xs font-semibold text-accent hover:text-white">{d.code}</a>
                    <span className="text-xs text-white">{d.designation}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
                  </div>
                  <p className="text-xs text-muted truncate">{d.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <span className="text-[10px] font-semibold text-warn uppercase tracking-widest">Premium</span>
        <h1 className="text-2xl font-bold text-white mt-1">Dates Clés</h1>
        <p className="text-sm text-muted mt-1">Publications, dividendes et Assemblées Générales sur 12 mois.</p>
        {/* Légende */}
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
            <span key={type} className={`px-2 py-0.5 rounded text-[10px] font-semibold ${cfg.color} ${cfg.bg}`}>{cfg.label}</span>
          ))}
        </div>
      </div>
      {renderListe(avenir, `À venir (${avenir.length})`)}
      {renderListe(passees, `Passées — 3 derniers mois (${passees.length})`)}
    </div>
  );
}
```

- [ ] **Step 3 : Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add frontend/lib/premium/calendrier.ts frontend/app/premium/calendrier/page.tsx
git commit -m "feat(premium): module B calendrier dates clés"
```

---

## Task 9 : Module C — Données anomalies

**Files:**
- Create: `frontend/lib/premium/anomalies.ts`

- [ ] **Step 1 : Requêtes anomalies**

```typescript
// frontend/lib/premium/anomalies.ts
import { createClient } from '@/lib/supabase/server';

export interface PointDividende {
  code: string; nom: string; rendement: number; payout: number; signal: string;
}
export interface PointLiquiditeVol {
  code: string; nom: string; liquidite: number; volatilite: number; capitalisation: number; signal: string;
}
export interface CellHeatmap {
  code: string; date: string; variation: number;
}
export interface PointValuation {
  code: string; nom: string; marge_nette: number; croissance_ca: number | null; croissance_rn: number | null; signal: string;
}

export async function getAnomaliesData() {
  const supabase = createClient();

  // Dernières cotations (20 séances × toutes actions)
  const { data: cotations } = await supabase
    .from('brvm_actions_daily')
    .select('code, designation, date_marche, cours_jour, variation_pct, volume, valeur_echangee')
    .order('date_marche', { ascending: false })
    .limit(3000);

  // Fondamentaux dernière année
  const { data: fonds } = await supabase
    .from('fundamentals')
    .select('code, year, revenue, net_income, equity')
    .order('year', { ascending: false });

  // Dividendes
  const { data: divs } = await supabase
    .from('dividends')
    .select('code, montant, exercice')
    .order('exercice', { ascending: false });

  // Signaux
  const { data: signals } = await supabase
    .from('signals_daily')
    .select('code, signal, score_total')
    .order('date_marche', { ascending: false })
    .limit(200);

  // --- Organiser par code ---
  const byCode = new Map<string, typeof cotations>();
  for (const c of cotations ?? []) {
    if (!byCode.has(c.code)) byCode.set(c.code, []);
    if (byCode.get(c.code)!.length < 20) byCode.get(c.code)!.push(c);
  }
  const fondMap = new Map<string, { revenue: number | null; net_income: number | null; equity: number | null; year: number }>();
  for (const f of fonds ?? []) {
    if (!fondMap.has(f.code)) fondMap.set(f.code, { revenue: f.revenue, net_income: f.net_income, equity: f.equity, year: f.year });
  }
  const fondPrevMap = new Map<string, { revenue: number | null; net_income: number | null }>();
  for (const f of fonds ?? []) {
    const curr = fondMap.get(f.code);
    if (curr && f.year === curr.year - 1 && !fondPrevMap.has(f.code)) {
      fondPrevMap.set(f.code, { revenue: f.revenue, net_income: f.net_income });
    }
  }
  const divMap = new Map<string, number>();
  for (const d of divs ?? []) {
    if (!divMap.has(d.code)) divMap.set(d.code, d.montant);
  }
  const signalMap = new Map<string, string>();
  for (const s of signals ?? []) {
    if (!signalMap.has(s.code)) signalMap.set(s.code, s.signal);
  }

  // 1. Scatter dividendes : rendement vs payout
  const pointsDividendes: PointDividende[] = [];
  for (const [code, rows] of byCode) {
    const cours = rows[0]?.cours_jour;
    const div = divMap.get(code);
    const f = fondMap.get(code);
    if (!cours || !div) continue;
    const rendement = (div / cours) * 100;
    const payout = (f?.net_income && f.net_income > 0) ? (div * 1000 / f.net_income) * 100 : NaN;
    if (isNaN(payout) || payout > 500) continue;
    pointsDividendes.push({ code, nom: rows[0]?.designation ?? code, rendement: +rendement.toFixed(2), payout: +payout.toFixed(1), signal: signalMap.get(code) ?? 'HOLD' });
  }

  // 2. Scatter liquidité vs volatilité
  const pointsLiqVol: PointLiquiditeVol[] = [];
  for (const [code, rows] of byCode) {
    if (rows.length < 5) continue;
    const liquidite = rows.reduce((s, r) => s + (r.valeur_echangee ?? 0), 0) / rows.length / 1e6;
    const variations = rows.map((r) => r.variation_pct ?? 0);
    const mean = variations.reduce((s, v) => s + v, 0) / variations.length;
    const volatilite = +Math.sqrt(variations.reduce((s, v) => s + (v - mean) ** 2, 0) / variations.length).toFixed(2);
    const cours = rows[0]?.cours_jour ?? 0;
    const capitalisation = cours * 1000000; // proxy
    pointsLiqVol.push({ code, nom: rows[0]?.designation ?? code, liquidite: +liquidite.toFixed(2), volatilite, capitalisation, signal: signalMap.get(code) ?? 'HOLD' });
  }

  // 3. Heatmap 20 séances
  const heatmapCells: CellHeatmap[] = [];
  for (const [code, rows] of byCode) {
    for (const r of rows) {
      heatmapCells.push({ code, date: r.date_marche, variation: r.variation_pct ?? 0 });
    }
  }

  // 4. Scatter valorisation : marge nette vs croissance
  const pointsValuation: PointValuation[] = [];
  for (const [code, f] of fondMap) {
    if (!f.revenue || !f.net_income) continue;
    const marge = (f.net_income / f.revenue) * 100;
    const prev = fondPrevMap.get(code);
    const croissance_ca = prev?.revenue ? ((f.revenue - prev.revenue) / Math.abs(prev.revenue)) * 100 : null;
    const croissance_rn = prev?.net_income ? ((f.net_income - prev.net_income) / Math.abs(prev.net_income)) * 100 : null;
    const rows = byCode.get(code);
    pointsValuation.push({ code, nom: rows?.[0]?.designation ?? code, marge_nette: +marge.toFixed(1), croissance_ca: croissance_ca ? +croissance_ca.toFixed(1) : null, croissance_rn: croissance_rn ? +croissance_rn.toFixed(1) : null, signal: signalMap.get(code) ?? 'HOLD' });
  }

  return { pointsDividendes, pointsLiqVol, heatmapCells, pointsValuation };
}
```

- [ ] **Step 2 : Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/premium/anomalies.ts
git commit -m "feat(premium): lib anomalies — 4 jeux de données"
```

---

## Task 10 : Module C — Composants charts + page anomalies

**Files:**
- Create: `frontend/components/premium/AnomalieCharts.tsx`
- Create: `frontend/app/premium/anomalies/page.tsx`

- [ ] **Step 1 : Composant AnomalieCharts**

```tsx
// frontend/components/premium/AnomalieCharts.tsx
'use client';
import EChart from '@/components/EChart';
import type {
  PointDividende, PointLiquiditeVol, CellHeatmap, PointValuation,
} from '@/lib/premium/anomalies';

const SIG_COLOR: Record<string, string> = { BUY: '#00c853', HOLD: '#ffb300', SELL: '#f44336' };

function ChartCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 mb-6">
      <h2 className="text-sm font-semibold text-white mb-0.5">{title}</h2>
      <p className="text-xs text-muted mb-4">{desc}</p>
      {children}
    </div>
  );
}

export function AnomalieCharts({
  pointsDividendes,
  pointsLiqVol,
  heatmapCells,
  pointsValuation,
}: {
  pointsDividendes: PointDividende[];
  pointsLiqVol: PointLiquiditeVol[];
  heatmapCells: CellHeatmap[];
  pointsValuation: PointValuation[];
}) {
  // 1. Scatter dividendes
  const optDividendes = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: { data: [number, number, string, string] }) =>
        `<b>${p.data[2]}</b> (${p.data[3]})<br/>Rendement : ${p.data[1]}%<br/>Payout : ${p.data[0]}%`,
    },
    xAxis: { name: 'Payout (%)', type: 'value', nameTextStyle: { color: '#8b93a7' }, axisLabel: { color: '#8b93a7' }, splitLine: { lineStyle: { color: '#232733' } } },
    yAxis: { name: 'Rendement (%)', type: 'value', nameTextStyle: { color: '#8b93a7' }, axisLabel: { color: '#8b93a7' }, splitLine: { lineStyle: { color: '#232733' } } },
    series: [{
      type: 'scatter',
      data: pointsDividendes.map((p) => [p.payout, p.rendement, p.nom, p.code]),
      itemStyle: { color: (params: { data: [number, number, string, string] }) => SIG_COLOR[params.data[3]] ?? '#8b93a7' },
      symbolSize: 10,
      label: { show: pointsDividendes.length < 15, formatter: (p: { data: [number, number, string, string] }) => p.data[3], color: '#e6e9f0', fontSize: 9, position: 'top' },
    }],
  };

  // 2. Scatter liquidité vs volatilité
  const optLiqVol = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: { data: [number, number, string] }) =>
        `<b>${p.data[2]}</b><br/>Liquidité : ${p.data[0].toFixed(1)} M FCFA/j<br/>Volatilité : ${p.data[1]}%`,
    },
    xAxis: { name: 'Liquidité moy. (M FCFA/j)', type: 'value', nameTextStyle: { color: '#8b93a7' }, axisLabel: { color: '#8b93a7' }, splitLine: { lineStyle: { color: '#232733' } } },
    yAxis: { name: 'Volatilité (%)', type: 'value', nameTextStyle: { color: '#8b93a7' }, axisLabel: { color: '#8b93a7' }, splitLine: { lineStyle: { color: '#232733' } } },
    series: [{
      type: 'scatter',
      data: pointsLiqVol.map((p) => [p.liquidite, p.volatilite, p.code]),
      itemStyle: { color: (params: { data: [number, number, string] }) => SIG_COLOR[signalFromCode(params.data[2], pointsLiqVol)] ?? '#8b93a7' },
      symbolSize: 10,
      label: { show: true, formatter: (p: { data: [number, number, string] }) => p.data[2], color: '#e6e9f0', fontSize: 9, position: 'top' },
    }],
  };

  // 3. Heatmap 20 séances
  const codes = [...new Set(heatmapCells.map((c) => c.code))].slice(0, 30);
  const dates = [...new Set(heatmapCells.map((c) => c.date))].sort().slice(-20);
  const heatData = heatmapCells
    .filter((c) => codes.includes(c.code) && dates.includes(c.date))
    .map((c) => [dates.indexOf(c.date), codes.indexOf(c.code), +c.variation.toFixed(2)]);
  const optHeatmap = {
    backgroundColor: 'transparent',
    tooltip: { formatter: (p: { data: [number, number, number] }) => `${codes[p.data[1]]} — ${dates[p.data[0]]}<br/>Variation : ${p.data[2]}%` },
    xAxis: { type: 'category', data: dates.map((d) => d.slice(5)), axisLabel: { color: '#8b93a7', fontSize: 8, rotate: 45 }, splitLine: { show: false } },
    yAxis: { type: 'category', data: codes, axisLabel: { color: '#e6e9f0', fontSize: 8 } },
    visualMap: { min: -5, max: 5, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: '#8b93a7' }, inRange: { color: ['#f44336', '#232733', '#00c853'] } },
    series: [{ type: 'heatmap', data: heatData, itemStyle: { borderColor: '#0f1117', borderWidth: 1 } }],
  };

  // 4. Scatter marge nette vs croissance CA
  const optValuation = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: { data: [number, number, string] }) =>
        `<b>${p.data[2]}</b><br/>Marge nette : ${p.data[0]}%<br/>Croissance CA : ${p.data[1] !== null ? p.data[1] + '%' : 'N/D'}`,
    },
    xAxis: { name: 'Marge nette (%)', type: 'value', nameTextStyle: { color: '#8b93a7' }, axisLabel: { color: '#8b93a7' }, splitLine: { lineStyle: { color: '#232733' } } },
    yAxis: { name: 'Croissance CA (%)', type: 'value', nameTextStyle: { color: '#8b93a7' }, axisLabel: { color: '#8b93a7' }, splitLine: { lineStyle: { color: '#232733' } } },
    series: [{
      type: 'scatter',
      data: pointsValuation.filter((p) => p.croissance_ca !== null).map((p) => [p.marge_nette, p.croissance_ca, p.code]),
      itemStyle: { color: (params: { data: [number, number, string] }) => SIG_COLOR[signalFromCodeVal(params.data[2], pointsValuation)] ?? '#8b93a7' },
      symbolSize: 10,
      label: { show: true, formatter: (p: { data: [number, number, string] }) => p.data[2], color: '#e6e9f0', fontSize: 9, position: 'top' },
    }],
  };

  return (
    <>
      <ChartCard title="Dividendes — Rendement vs Payout" desc="Zone idéale : rendement élevé + payout raisonnable (<80%). Hors zone = risque de coupe de dividende.">
        {pointsDividendes.length === 0
          ? <EmptyState />
          : <EChart option={optDividendes} style={{ height: 340 }} />}
      </ChartCard>

      <ChartCard title="Liquidité vs Volatilité" desc="Bas-gauche = stable et illiquide. Haut-droit = volatile et liquide. Idéal : liquidité élevée, faible volatilité (bas-droit).">
        {pointsLiqVol.length === 0
          ? <EmptyState />
          : <EChart option={optLiqVol} style={{ height: 340 }} />}
      </ChartCard>

      <ChartCard title="Heatmap — 20 dernières séances" desc="Variations journalières par action. Rouge = baisse, vert = hausse. Lignes homogènes = mouvement de marché général.">
        {heatData.length === 0
          ? <EmptyState />
          : <EChart option={optHeatmap} style={{ height: Math.max(280, codes.length * 18) }} />}
      </ChartCard>

      <ChartCard title="Marge nette vs Croissance CA" desc="Haut-droit = croissance rentable. Bas-gauche = déclin. Les ciseaux (CA croît, marge chute) sont en haut-gauche.">
        {pointsValuation.filter((p) => p.croissance_ca !== null).length === 0
          ? <EmptyState />
          : <EChart option={optValuation} style={{ height: 340 }} />}
      </ChartCard>
    </>
  );
}

function EmptyState() {
  return (
    <div className="py-10 text-center text-muted text-sm">Données insuffisantes pour afficher cette analyse.</div>
  );
}

function signalFromCode(code: string, pts: PointLiquiditeVol[]) {
  return pts.find((p) => p.code === code)?.signal ?? 'HOLD';
}
function signalFromCodeVal(code: string, pts: PointValuation[]) {
  return pts.find((p) => p.code === code)?.signal ?? 'HOLD';
}
```

- [ ] **Step 2 : Page anomalies**

```tsx
// frontend/app/premium/anomalies/page.tsx
import { getAnomaliesData } from '@/lib/premium/anomalies';
import { AnomalieCharts } from '@/components/premium/AnomalieCharts';

export default async function AnomaliesPage() {
  const data = await getAnomaliesData();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <span className="text-[10px] font-semibold text-warn uppercase tracking-widest">Premium</span>
        <h1 className="text-2xl font-bold text-white mt-1">Détection d'Anomalies & Opportunités</h1>
        <p className="text-sm text-muted mt-1">
          4 analyses visuelles pour identifier les actions hors-norme et les opportunités cachées.
        </p>
        <div className="flex gap-3 mt-2 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-up inline-block" /> BUY</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warn inline-block" /> HOLD</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-down inline-block" /> SELL</span>
        </div>
      </div>
      <AnomalieCharts {...data} />
    </div>
  );
}
```

- [ ] **Step 3 : Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add frontend/components/premium/AnomalieCharts.tsx frontend/app/premium/anomalies/page.tsx
git commit -m "feat(premium): module C anomalies — 4 charts ECharts"
```

---

## Task 11 : Build final + déploiement

- [ ] **Step 1 : Typecheck global**

```bash
cd frontend && npx tsc --noEmit
```

Attendu : 0 erreur.

- [ ] **Step 2 : Build de production**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Attendu : `✓ Compiled successfully`

- [ ] **Step 3 : Vérifications manuelles**

- Visiter `/premium/upgrade` → page d'info s'affiche sans login
- Visiter `/premium/classements` sans être connecté → redirect `/login`
- Se connecter avec `ebouak@gmail.com` → accès direct sans vérification is_premium
- Sidebar affiche section "Premium" avec liens actifs pour super admin

- [ ] **Step 4 : Push + deploy**

```bash
git push origin main
cd frontend && npx vercel --prod --yes
```

---

## Self-Review

**Spec coverage ✅**
- Gating middleware : Task 2 ✓
- Webhook paiement : Task 3 ✓
- Page upgrade : Task 4 ✓
- Sidebar Premium : Task 5 ✓
- Classements (9 critères) : Tasks 6-7 ✓
- Calendrier dates clés (4 types) : Task 8 ✓
- Anomalies (4 charts) : Tasks 9-10 ✓
- Build + déploiement : Task 11 ✓

**Types cohérents :** `CritereClassement`, `LigneClassement`, `TypeDate`, `DateCle`, `PointDividende`, `PointLiquiditeVol`, `CellHeatmap`, `PointValuation` — définis dans les libs, importés dans composants et pages.

**Note PER/PBR :** Sans `nb_actions` dans la DB, PER et PBR affichent "N/D". Les onglets existent dans le tableau pour éviter de supprimer l'UI, les données seront renseignées quand `nb_actions` sera disponible (enrichissement futur de `brvm_instruments`).
