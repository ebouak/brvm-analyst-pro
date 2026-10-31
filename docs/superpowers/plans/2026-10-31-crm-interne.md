# CRM interne — lot 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une vue par personne (prospects et comptes) classée par proximité de l'abonnement Premium, chaque classement justifié par des faits datés, avec relance manuelle par e-mail, notes, et droit d'opposition.

**Architecture:** calcul à la lecture. Un chargeur serveur (`lib/crm/charger.ts`, service_role, lectures paginées) rassemble les sources existantes ; des fonctions PURES (`identite`, `score`, `gabarits`) assemblent, notent et rédigent ; deux pages admin les affichent ; une action serveur envoie et journalise. Trois tables nouvelles, toutes service_role.

**Tech Stack:** Next.js 14 App Router, Supabase (service_role côté serveur, RLS sans policy), vitest, Resend via `lib/server/email.ts`.

**Spec :** `docs/superpowers/specs/2026-10-31-crm-interne-design.md`. **Écarts tranchés par ce plan** (constatés dans le code le 2026-10-31) :
1. Le rôle `admin` n'existe pas : `crm.*` est donné à `super_admin` et `support_admin`.
2. `auth.users.last_sign_in_at` n'est pas exposé par PostgREST : lecture par `auth.admin.listUsers()`.
3. Les tests frontend sont en `*.test.ts` (vitest), pas `.test.mjs`.
4. Le lien d'opposition mène à une page avec bouton de confirmation : un scanner de liens (Outlook, antivirus) qui ouvre l'URL ne doit pas opposer la personne à sa place.
5. Garde-fou anti double envoi : refus si une relance `envoi` de la même personne date de moins de 2 minutes.

**Règles du dépôt à respecter** (CLAUDE.md) : toute lecture de liste passe par `fetchAllRows` (`lib/supabase/paginate.ts`) — PostgREST tronque à 1000 lignes en silence ; `revoke … from public, anon, authenticated` (les trois) ; aucun chiffre inventé dans un texte ; la migration est appliquée **par l'utilisateur** dans l'éditeur SQL Supabase, jamais par `db push`.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0172_crm_interne.sql` | 3 tables, permissions, purge |
| `frontend/lib/server/rbac.ts` (modif) | `crm.read`, `crm.write` dans `PermissionCode` |
| `frontend/lib/admin-nav.ts` (modif) | entrée « CRM » |
| `frontend/lib/crm/types.ts` | `Dossier`, `Raison`, `Score` |
| `frontend/lib/crm/identite.ts` (+ test) | normalisation e-mail, assemblage, chronologie — pur |
| `frontend/lib/crm/score.ts` (+ test) | score expliqué — pur |
| `frontend/lib/crm/gabarits.ts` (+ test) | gabarits de relance, pied d'opposition, HTML — pur |
| `frontend/lib/crm/signal.ts` | liste blanche des pages d'offre |
| `frontend/lib/crm/charger.ts` | lecture des sources (serveur, service_role) |
| `frontend/lib/crm/opposition.ts` | lecture/écriture de `crm_oppositions` (serveur) |
| `frontend/app/api/crm/signal/route.ts` | balise « a consulté l'offre » |
| `frontend/components/crm/SignalOffre.tsx` | composant client qui envoie la balise au montage |
| `frontend/app/crm/opposition/page.tsx` + `actions.ts` | opposition en un clic, avec confirmation |
| `frontend/app/parametres/compte/oppositionAction.ts` + `frontend/components/crm/OppositionProfilage.tsx` | case dans les paramètres |
| `frontend/app/admin/crm/page.tsx` | liste |
| `frontend/app/admin/crm/[cle]/page.tsx`, `actions.ts`, `RelanceForm.tsx`, `NoteForm.tsx` | fiche, relance, notes |
| `frontend/app/api/account/export/route.ts`, `delete/route.ts`, `app/confidentialite/page.tsx`, `lib/supabase/middleware.ts` (modifs) | RGPD et route publique |

Commandes depuis `frontend/` : tests `npx vitest run <fichier>`, types `npx tsc --noEmit -p .`.

---

### Task 1 : Migration 0172

**Files:**
- Create: `supabase/migrations/0172_crm_interne.sql`

- [ ] **Step 1 : écrire la migration**

```sql
-- 0172 — CRM interne, lot 1 (spec 2026-10-31-crm-interne-design.md).
-- Trois tables service_role : RLS activée, AUCUNE policy, revoke sur les trois
-- rôles (« from public » seul ne suffit pas — CLAUDE.md §11, migration 0093).

create table if not exists public.crm_signaux (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('offre_vue')),
  page        text not null check (page in ('/pricing', '/account/plan', '/premium/upgrade')),
  jour        date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (user_id, page, jour)
);
alter table public.crm_signaux enable row level security;
revoke all on table public.crm_signaux from public, anon, authenticated;
revoke all on sequence public.crm_signaux_id_seq from public, anon, authenticated;

create table if not exists public.crm_actions (
  id                uuid primary key default gen_random_uuid(),
  email_norm        text not null,
  user_id           uuid null references auth.users(id) on delete set null,
  type              text not null check (type in ('relance', 'note')),
  canal             text null check (canal in ('email')),
  template_id       text null,
  sujet             text null,
  contenu           text not null,
  score_at_envoi    int null,
  signaux_json      jsonb null,
  statut            text not null check (statut in ('note', 'envoi', 'envoye', 'echec')),
  erreur            text null,
  resend_id         text null,
  jeton_opposition  text null unique,
  auteur            uuid null references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists crm_actions_email_created_idx on public.crm_actions (email_norm, created_at desc);
alter table public.crm_actions enable row level security;
revoke all on table public.crm_actions from public, anon, authenticated;

create table if not exists public.crm_oppositions (
  email_norm  text primary key,
  source      text not null check (source in ('parametres', 'lien', 'admin')),
  created_at  timestamptz not null default now()
);
alter table public.crm_oppositions enable row level security;
revoke all on table public.crm_oppositions from public, anon, authenticated;

insert into public.admin_permissions (code, label) values
  ('crm.read',  'Voir le CRM (prospects, scores, fiches)'),
  ('crm.write', 'Relancer, annoter, enregistrer une opposition')
on conflict (code) do nothing;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p
  on p.code in ('crm.read', 'crm.write')
where r.code in ('super_admin', 'support_admin')
on conflict do nothing;

-- ── Rétention : recréée à l'identique de 0158, + crm_signaux / crm_actions ──
create or replace function public.purge_rgpd_retention()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from public.admin_audit_logs where created_at < now() - interval '12 months';
  delete from public.notifications_log  where created_at < now() - interval '12 months';
  delete from public.auth_events        where created_at < now() - interval '12 months';
  delete from public.whatsapp_conversations where created_at < now() - interval '90 days';
  delete from public.whatsapp_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.telegram_conversations where created_at < now() - interval '90 days';
  delete from public.telegram_pairing_codes where expires_at < now() - interval '1 day';
  delete from public.dossier_envois         where created_at < now() - interval '90 days';
  delete from public.formation_inscriptions i
   using public.formation_sessions s
   where s.id = i.session_id and s.debut_at < now() - interval '3 years';
  delete from public.payment_webhook_events where received_at < now() - interval '12 months';
  delete from public.contact_messages       where derniere_activite_at < now() - interval '12 months';
  delete from public.crm_signaux            where created_at < now() - interval '90 days';
  delete from public.crm_actions            where created_at < now() - interval '24 months';
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
```

- [ ] **Step 2 : vérifier que la purge recréée part de la définition en production**

Run (racine du dépôt) : `supabase db query --linked "select pg_get_functiondef('public.purge_rgpd_retention()'::regprocedure)" -o json`
Expected : exactement les 11 `delete from` de la migration, sans les deux lignes `crm_*` (vérifié le 2026-10-31). Si la production en compte d'autres, les recopier avant de continuer.

- [ ] **Step 3 : commit** — `git add supabase/migrations/0172_crm_interne.sql && git commit -m "feat(crm): migration 0172 — signaux, actions, oppositions, permissions"`

- [ ] **Step 4 : demander à l'utilisateur d'appliquer la migration** dans l'éditeur SQL Supabase (jamais `db push` : historique désynchronisé). Ne pas tester les pages (Task 12) sans sa confirmation.

---

### Task 2 : Permissions et navigation

**Files:**
- Modify: `frontend/lib/server/rbac.ts` (type `PermissionCode`)
- Modify: `frontend/lib/admin-nav.ts` (après l'entrée `/admin/leads`)

- [ ] **Step 1** — dans `PermissionCode`, après `| 'leads.read' | 'leads.write'` : `  | 'crm.read' | 'crm.write'`
- [ ] **Step 2** — dans `admin-nav.ts`, après l'entrée de `/admin/leads` :
  `  { href: '/admin/crm', label: 'CRM · proches du Premium', permission: 'crm.read' },`
- [ ] **Step 3** — Run : `npx tsc --noEmit -p .` — Expected : aucune erreur nouvelle.
- [ ] **Step 4** — `git commit -am "feat(crm): permissions crm.read/crm.write et entrée de navigation"`

---

### Task 3 : Types et identité

**Files:**
- Create: `frontend/lib/crm/types.ts`, `frontend/lib/crm/identite.ts`
- Test: `frontend/lib/crm/identite.test.ts`

- [ ] **Step 1 : types**

```ts
// frontend/lib/crm/types.ts
/** Une personne vue par le CRM : un compte, ou un prospect sans compte. */
export interface Dossier {
  /** user_id pour un compte, `email:<email_norm>` pour un prospect sans compte. */
  cle: string;
  emailNorm: string;
  userId: string | null;
  nom: string | null;
  inscritLe: string | null;
  derniereConnexion: string | null;
  premium: boolean;
  admin: boolean;
  oppose: boolean;
  paiementsEnAttente: { montant: number; devise: string; date: string }[];
  paiementsReussis: { montant: number; date: string }[];
  offreVues: { page: string; jour: string }[];
  lignesPortefeuille: number;
  messages: { date: string }[];
  prospect: { date: string; consent: boolean } | null;
  newsletter: boolean;
  leconsAcademy: number;
  actions: { date: string; type: 'relance' | 'note'; statut: string; canal: string | null; sujet: string | null; contenu: string }[];
}

export interface Raison { code: 'paiement' | 'offre' | 'connexion' | 'portefeuille' | 'contact' | 'newsletter' | 'academy'; points: number; texte: string; date: string | null }
export type Niveau = 'chaud' | 'tiede' | 'froid';
export interface Score { score: number; niveau: Niveau; raisons: Raison[] }
```

- [ ] **Step 2 : test qui échoue**

```ts
// frontend/lib/crm/identite.test.ts
import { describe, it, expect } from 'vitest';
import { assemblerDossiers, normaliserEmail, chronologie, type Sources } from './identite';

const vide: Sources = {
  comptes: [], profils: [], admins: [], paiements: [], signaux: [], positions: [],
  messages: [], prospects: [], newsletter: [], academy: [], actions: [], oppositions: [],
};

describe('normaliserEmail', () => {
  it('met en minuscules et retire les espaces', () => {
    expect(normaliserEmail('  Awa.K@Mail.COM ')).toBe('awa.k@mail.com');
    expect(normaliserEmail(null)).toBe('');
  });
});

describe('assemblerDossiers', () => {
  it('rattache au compte, par e-mail normalisé, le prospect, la newsletter et les messages', () => {
    const d = assemblerDossiers({
      ...vide,
      comptes: [{ id: 'u1', email: 'Awa@mail.com', created_at: '2026-09-01T10:00:00Z', last_sign_in_at: '2026-10-30T10:00:00Z' }],
      profils: [{ id: 'u1', display_name: 'Awa Koné', is_premium: false }],
      prospects: [{ email: 'awa@MAIL.com ', nom: 'Awa', created_at: '2026-08-01T10:00:00Z', consent: true }],
      newsletter: [{ email: 'awa@mail.com', confirmed: true }],
      messages: [{ email: 'awa@mail.com', created_at: '2026-10-25T10:00:00Z' }],
    });
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ cle: 'u1', emailNorm: 'awa@mail.com', nom: 'Awa Koné', newsletter: true, prospect: { consent: true } });
    expect(d[0]!.messages).toEqual([{ date: '2026-10-25T10:00:00Z' }]);
  });

  it('crée un dossier « prospect sans compte » seulement avec consentement ou newsletter confirmée', () => {
    const d = assemblerDossiers({
      ...vide,
      prospects: [
        { email: 'oui@mail.com', nom: 'Oui', created_at: '2026-10-01T10:00:00Z', consent: true },
        { email: 'non@mail.com', nom: 'Non', created_at: '2026-10-01T10:00:00Z', consent: false },
      ],
      newsletter: [{ email: 'lecteur@mail.com', confirmed: true }, { email: 'pasconfirme@mail.com', confirmed: false }],
    });
    expect(d.map((x) => x.cle).sort()).toEqual(['email:lecteur@mail.com', 'email:oui@mail.com']);
    expect(d.find((x) => x.cle === 'email:oui@mail.com')!.userId).toBeNull();
  });

  it('marque premium, admin et opposition ; compte paiements, portefeuille et Academy', () => {
    const [d] = assemblerDossiers({
      ...vide,
      comptes: [{ id: 'u1', email: 'a@b.c', created_at: null, last_sign_in_at: null }],
      profils: [{ id: 'u1', display_name: null, is_premium: true }],
      admins: [{ user_id: 'u1' }],
      oppositions: [{ email_norm: 'a@b.c' }],
      paiements: [
        { user_id: 'u1', amount: '5000', currency: 'XOF', status: 'pending', created_at: '2026-10-12T10:00:00Z', paid_at: null },
        { user_id: 'u1', amount: 5000, currency: 'XOF', status: 'paid', created_at: '2026-09-01T10:00:00Z', paid_at: '2026-09-01T11:00:00Z' },
      ],
      positions: [{ user_id: 'u1' }, { user_id: 'u1' }],
      academy: [{ user_id: 'u1', completed: true }, { user_id: 'u1', completed: false }],
    });
    expect(d).toMatchObject({ premium: true, admin: true, oppose: true, lignesPortefeuille: 2, leconsAcademy: 1 });
    expect(d!.paiementsEnAttente).toEqual([{ montant: 5000, devise: 'XOF', date: '2026-10-12T10:00:00Z' }]);
    expect(d!.paiementsReussis).toEqual([{ montant: 5000, date: '2026-09-01T11:00:00Z' }]);
  });
});

describe('chronologie', () => {
  it('fusionne et trie les faits du plus récent au plus ancien', () => {
    const [d] = assemblerDossiers({
      ...vide,
      comptes: [{ id: 'u1', email: 'a@b.c', created_at: '2026-09-01T10:00:00Z', last_sign_in_at: null }],
      messages: [{ email: 'a@b.c', created_at: '2026-10-25T10:00:00Z' }],
      signaux: [{ user_id: 'u1', page: '/pricing', jour: '2026-10-29' }],
    });
    expect(chronologie(d!).map((e) => e.libelle)).toEqual(['A consulté /pricing', 'Message envoyé au support', 'Inscription']);
  });
});
```

- [ ] **Step 3** — Run : `npx vitest run lib/crm/identite.test.ts` — Expected : FAIL (`Cannot find module './identite'`).

- [ ] **Step 4 : implémentation**

```ts
// frontend/lib/crm/identite.ts
/**
 * Assemblage des dossiers CRM — PUR. Une personne = un compte, ou un prospect
 * sans compte (formulaire avec consentement, ou newsletter confirmée). Le
 * rapprochement se fait par e-mail normalisé : seule clé commune entre comptes,
 * prospects, newsletter et messages.
 */
import type { Dossier } from './types';

export const normaliserEmail = (e: string | null | undefined): string => (e ?? '').trim().toLowerCase();

export interface Sources {
  comptes: { id: string; email: string | null; created_at: string | null; last_sign_in_at: string | null }[];
  profils: { id: string; display_name: string | null; is_premium: boolean | null }[];
  admins: { user_id: string }[];
  paiements: { user_id: string | null; amount: number | string; currency: string | null; status: string; created_at: string; paid_at: string | null }[];
  signaux: { user_id: string; page: string; jour: string }[];
  positions: { user_id: string }[];
  messages: { email: string; created_at: string }[];
  prospects: { email: string; nom: string | null; created_at: string; consent: boolean | null }[];
  newsletter: { email: string; confirmed: boolean | null }[];
  academy: { user_id: string; completed: boolean | null }[];
  actions: { email_norm: string; created_at: string; type: 'relance' | 'note'; statut: string; canal: string | null; sujet: string | null; contenu: string }[];
  oppositions: { email_norm: string }[];
}

function grouper<T>(lignes: readonly T[], cle: (l: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const l of lignes) {
    const k = cle(l);
    const liste = m.get(k);
    if (liste) liste.push(l);
    else m.set(k, [l]);
  }
  return m;
}

export function assemblerDossiers(s: Sources): Dossier[] {
  const profils = new Map(s.profils.map((p) => [p.id, p]));
  const admins = new Set(s.admins.map((a) => a.user_id));
  const opposes = new Set(s.oppositions.map((o) => normaliserEmail(o.email_norm)));
  const paiements = grouper(s.paiements.filter((p) => p.user_id), (p) => p.user_id as string);
  const signaux = grouper(s.signaux, (x) => x.user_id);
  const positions = grouper(s.positions, (x) => x.user_id);
  const academy = grouper(s.academy, (x) => x.user_id);
  const messages = grouper(s.messages, (x) => normaliserEmail(x.email));
  const actions = grouper(s.actions, (x) => normaliserEmail(x.email_norm));
  const prospects = new Map<string, Sources['prospects'][number]>();
  for (const p of [...s.prospects].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const k = normaliserEmail(p.email);
    if (k && !prospects.has(k)) prospects.set(k, p); // le plus récent
  }
  const abonnes = new Set(s.newsletter.filter((n) => n.confirmed).map((n) => normaliserEmail(n.email)));

  const commun = (emailNorm: string): Pick<Dossier, 'messages' | 'prospect' | 'newsletter' | 'oppose' | 'actions'> => {
    const p = prospects.get(emailNorm);
    return {
      messages: (messages.get(emailNorm) ?? []).map((m) => ({ date: m.created_at })),
      prospect: p ? { date: p.created_at, consent: p.consent === true } : null,
      newsletter: abonnes.has(emailNorm),
      oppose: opposes.has(emailNorm),
      actions: (actions.get(emailNorm) ?? []).map((a) => ({ date: a.created_at, type: a.type, statut: a.statut, canal: a.canal, sujet: a.sujet, contenu: a.contenu })),
    };
  };

  const dossiers: Dossier[] = [];
  const emailsComptes = new Set<string>();
  for (const c of s.comptes) {
    const emailNorm = normaliserEmail(c.email);
    if (!emailNorm) continue;
    emailsComptes.add(emailNorm);
    const pr = profils.get(c.id);
    const ps = paiements.get(c.id) ?? [];
    dossiers.push({
      cle: c.id,
      emailNorm,
      userId: c.id,
      nom: pr?.display_name ?? prospects.get(emailNorm)?.nom ?? null,
      inscritLe: c.created_at,
      derniereConnexion: c.last_sign_in_at,
      premium: pr?.is_premium === true,
      admin: admins.has(c.id),
      paiementsEnAttente: ps.filter((p) => p.status === 'pending').map((p) => ({ montant: Number(p.amount), devise: p.currency ?? 'XOF', date: p.created_at })),
      paiementsReussis: ps.filter((p) => p.status === 'paid').map((p) => ({ montant: Number(p.amount), date: p.paid_at ?? p.created_at })),
      offreVues: (signaux.get(c.id) ?? []).map((x) => ({ page: x.page, jour: x.jour })),
      lignesPortefeuille: (positions.get(c.id) ?? []).length,
      leconsAcademy: (academy.get(c.id) ?? []).filter((a) => a.completed).length,
      ...commun(emailNorm),
    });
  }

  // Prospects sans compte : formulaire AVEC consentement, ou newsletter confirmée.
  const sansCompte = new Set<string>();
  for (const [k, p] of prospects) if (p.consent === true && !emailsComptes.has(k)) sansCompte.add(k);
  for (const k of abonnes) if (!emailsComptes.has(k)) sansCompte.add(k);
  for (const emailNorm of sansCompte) {
    dossiers.push({
      cle: `email:${emailNorm}`, emailNorm, userId: null, nom: prospects.get(emailNorm)?.nom ?? null,
      inscritLe: null, derniereConnexion: null, premium: false, admin: false,
      paiementsEnAttente: [], paiementsReussis: [], offreVues: [], lignesPortefeuille: 0, leconsAcademy: 0,
      ...commun(emailNorm),
    });
  }
  return dossiers;
}

export interface Evenement { date: string; libelle: string }

/** Faits du dossier, du plus récent au plus ancien (fiche CRM). */
export function chronologie(d: Dossier): Evenement[] {
  const ev: Evenement[] = [];
  if (d.inscritLe) ev.push({ date: d.inscritLe, libelle: 'Inscription' });
  for (const p of d.paiementsEnAttente) ev.push({ date: p.date, libelle: `Paiement commencé (${p.montant} ${p.devise}), non terminé` });
  for (const p of d.paiementsReussis) ev.push({ date: p.date, libelle: `Paiement réussi (${p.montant})` });
  for (const v of d.offreVues) ev.push({ date: `${v.jour}T12:00:00Z`, libelle: `A consulté ${v.page}` });
  for (const m of d.messages) ev.push({ date: m.date, libelle: 'Message envoyé au support' });
  if (d.prospect) ev.push({ date: d.prospect.date, libelle: 'Formulaire prospect' });
  for (const a of d.actions) ev.push({ date: a.date, libelle: a.type === 'note' ? `Note : ${a.contenu.slice(0, 80)}` : `Relance ${a.canal ?? ''} (${a.statut}) : ${a.sujet ?? ''}` });
  return ev.sort((a, b) => b.date.localeCompare(a.date));
}
```

- [ ] **Step 5** — Run : `npx vitest run lib/crm/identite.test.ts` — Expected : PASS (5 tests).
- [ ] **Step 6** — `git add lib/crm && git commit -m "feat(crm): assemblage des dossiers par e-mail normalisé (pur, testé)"`

---

### Task 4 : Score expliqué

**Files:**
- Create: `frontend/lib/crm/score.ts`
- Test: `frontend/lib/crm/score.test.ts`

- [ ] **Step 1 : test qui échoue**

```ts
// frontend/lib/crm/score.test.ts
import { describe, it, expect } from 'vitest';
import { scorer, estExclu, fmtFcfa } from './score';
import type { Dossier } from './types';

const MAINTENANT = new Date('2026-10-31T12:00:00Z');
const ilYa = (j: number) => new Date(MAINTENANT.getTime() - j * 86_400_000).toISOString();
const d0: Dossier = {
  cle: 'u1', emailNorm: 'a@b.c', userId: 'u1', nom: null, inscritLe: null, derniereConnexion: null,
  premium: false, admin: false, oppose: false, paiementsEnAttente: [], paiementsReussis: [], offreVues: [],
  lignesPortefeuille: 0, messages: [], prospect: null, newsletter: false, leconsAcademy: 0, actions: [],
};

describe('scorer', () => {
  it('paiement inachevé : 40 points, raison datée avec le montant', () => {
    const s = scorer({ ...d0, paiementsEnAttente: [{ montant: 5000, devise: 'XOF', date: ilYa(19) }] }, MAINTENANT);
    expect(s.score).toBe(40);
    expect(s.raisons[0]!.texte).toBe(`paiement de ${fmtFcfa(5000)} commencé le 12/10, non terminé`);
  });

  it('paiement inachevé : 30 jours compte, 31 non', () => {
    expect(scorer({ ...d0, paiementsEnAttente: [{ montant: 1, devise: 'XOF', date: ilYa(30) }] }, MAINTENANT).score).toBe(40);
    expect(scorer({ ...d0, paiementsEnAttente: [{ montant: 1, devise: 'XOF', date: ilYa(31) }] }, MAINTENANT).score).toBe(0);
  });

  it('offre consultée : 14 jours compte, 15 non', () => {
    const jour = (j: number) => ilYa(j).slice(0, 10);
    expect(scorer({ ...d0, offreVues: [{ page: '/pricing', jour: jour(14) }] }, MAINTENANT).score).toBe(20);
    expect(scorer({ ...d0, offreVues: [{ page: '/pricing', jour: jour(15) }] }, MAINTENANT).score).toBe(0);
  });

  it('connexion : 15 points jusqu’à 7 jours, 5 de 8 à 30, 0 au-delà', () => {
    expect(scorer({ ...d0, derniereConnexion: ilYa(7) }, MAINTENANT).score).toBe(15);
    expect(scorer({ ...d0, derniereConnexion: ilYa(8) }, MAINTENANT).score).toBe(5);
    expect(scorer({ ...d0, derniereConnexion: ilYa(30) }, MAINTENANT).score).toBe(5);
    expect(scorer({ ...d0, derniereConnexion: ilYa(31) }, MAINTENANT).score).toBe(0);
  });

  it('cumule portefeuille, contact, newsletter, Academy', () => {
    const s = scorer({ ...d0, lignesPortefeuille: 4, messages: [{ date: ilYa(6) }], newsletter: true, leconsAcademy: 3 }, MAINTENANT);
    expect(s.score).toBe(30);
    expect(s.raisons.map((r) => r.code)).toEqual(['portefeuille', 'contact', 'newsletter', 'academy']);
  });

  it('plafonne à 100 et classe chaud / tiède / froid', () => {
    const plein: Dossier = {
      ...d0, paiementsEnAttente: [{ montant: 1, devise: 'XOF', date: ilYa(1) }], offreVues: [{ page: '/pricing', jour: ilYa(1).slice(0, 10) }],
      derniereConnexion: ilYa(1), lignesPortefeuille: 1, messages: [{ date: ilYa(1) }], newsletter: true, leconsAcademy: 1,
    };
    expect(scorer(plein, MAINTENANT)).toMatchObject({ score: 100, niveau: 'chaud' });
    expect(scorer({ ...d0, derniereConnexion: ilYa(1), lignesPortefeuille: 1 }, MAINTENANT).niveau).toBe('tiede');
    expect(scorer(d0, MAINTENANT)).toMatchObject({ score: 0, niveau: 'froid', raisons: [] });
  });

  it('les raisons ne citent que des faits du dossier', () => {
    const s = scorer({ ...d0, lignesPortefeuille: 4, leconsAcademy: 3 }, MAINTENANT);
    expect(s.raisons.map((r) => r.texte)).toEqual(['portefeuille de 4 lignes', "3 leçons de l'Academy suivies"]);
  });
});

describe('estExclu', () => {
  it('exclut Premium, administrateurs et personnes opposées', () => {
    expect(estExclu({ ...d0, premium: true })).toBe(true);
    expect(estExclu({ ...d0, admin: true })).toBe(true);
    expect(estExclu({ ...d0, oppose: true })).toBe(true);
    expect(estExclu(d0)).toBe(false);
  });
});
```

- [ ] **Step 2** — Run : `npx vitest run lib/crm/score.test.ts` — Expected : FAIL (module absent).

- [ ] **Step 3 : implémentation**

```ts
// frontend/lib/crm/score.ts
/**
 * Score de proximité du Premium — PUR. Chaque point est justifié par un fait
 * DATÉ du dossier ; une raison n'existe que si son fait existe (aucun chiffre
 * inventé). Pondérations et fenêtres : une seule constante chacune.
 */
import type { Dossier, Niveau, Raison, Score } from './types';

export const PONDERATIONS = { paiement: 40, offre: 20, connexion7: 15, connexion30: 5, portefeuille: 10, contact: 10, newsletter: 5, academy: 5 } as const;
export const FENETRES_JOURS = { paiement: 30, offre: 14, connexionForte: 7, connexion: 30, contact: 30 } as const;
export const SEUILS = { chaud: 50, tiede: 25 } as const;

const JOUR_MS = 86_400_000;
const age = (iso: string, maintenant: Date) => (maintenant.getTime() - Date.parse(iso)) / JOUR_MS;
const plusRecent = <T extends { date: string }>(xs: readonly T[]) => [...xs].sort((a, b) => b.date.localeCompare(a.date))[0];
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

export const fmtJour = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
export const fmtFcfa = (n: number): string => `${Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} FCFA`;

export function estExclu(d: Dossier): boolean {
  return d.premium || d.admin || d.oppose;
}

export function scorer(d: Dossier, maintenant: Date): Score {
  const raisons: Raison[] = [];

  const paiement = plusRecent(d.paiementsEnAttente.filter((p) => age(p.date, maintenant) <= FENETRES_JOURS.paiement));
  if (paiement) raisons.push({ code: 'paiement', points: PONDERATIONS.paiement, date: paiement.date, texte: `paiement de ${fmtFcfa(paiement.montant)} commencé le ${fmtJour(paiement.date)}, non terminé` });

  const vues = d.offreVues.map((v) => ({ ...v, date: `${v.jour}T12:00:00Z` })).filter((v) => age(v.date, maintenant) <= FENETRES_JOURS.offre);
  const derniereVue = plusRecent(vues);
  if (derniereVue) raisons.push({ code: 'offre', points: PONDERATIONS.offre, date: derniereVue.date, texte: `a consulté l'offre ${vues.length === 1 ? 'une fois' : `${vues.length} fois`}, dernière le ${fmtJour(derniereVue.date)}` });

  if (d.derniereConnexion) {
    const a = age(d.derniereConnexion, maintenant);
    const texte = a < 1 ? "connecté aujourd'hui" : `connecté il y a ${pluriel(Math.floor(a), 'jour')}`;
    if (a <= FENETRES_JOURS.connexionForte) raisons.push({ code: 'connexion', points: PONDERATIONS.connexion7, date: d.derniereConnexion, texte });
    else if (a <= FENETRES_JOURS.connexion) raisons.push({ code: 'connexion', points: PONDERATIONS.connexion30, date: d.derniereConnexion, texte });
  }

  if (d.lignesPortefeuille > 0) raisons.push({ code: 'portefeuille', points: PONDERATIONS.portefeuille, date: null, texte: `portefeuille de ${pluriel(d.lignesPortefeuille, 'ligne')}` });

  const contacts = [
    ...d.messages.map((m) => ({ date: m.date, quoi: 'message' })),
    ...(d.prospect ? [{ date: d.prospect.date, quoi: 'formulaire prospect' }] : []),
  ].filter((c) => age(c.date, maintenant) <= FENETRES_JOURS.contact);
  const contact = plusRecent(contacts);
  if (contact) raisons.push({ code: 'contact', points: PONDERATIONS.contact, date: contact.date, texte: `${contact.quoi} du ${fmtJour(contact.date)}` });

  if (d.newsletter) raisons.push({ code: 'newsletter', points: PONDERATIONS.newsletter, date: null, texte: 'abonné à la newsletter' });
  if (d.leconsAcademy > 0) raisons.push({ code: 'academy', points: PONDERATIONS.academy, date: null, texte: `${pluriel(d.leconsAcademy, 'leçon')} de l'Academy suivie${d.leconsAcademy > 1 ? 's' : ''}` });

  const score = Math.min(100, raisons.reduce((s, r) => s + r.points, 0));
  const niveau: Niveau = score >= SEUILS.chaud ? 'chaud' : score >= SEUILS.tiede ? 'tiede' : 'froid';
  // Tri stable : à points égaux, l'ordre d'insertion est conservé (le test « cumule » s'y fie).
  return { score, niveau, raisons: raisons.sort((a, b) => b.points - a.points) };
}
```

- [ ] **Step 4** — Run : `npx vitest run lib/crm/score.test.ts` — Expected : PASS (8 tests).
- [ ] **Step 5** — `git add lib/crm && git commit -m "feat(crm): score de proximité du Premium, expliqué et daté (pur, testé)"`

---

### Task 5 : Gabarits de relance

**Files:**
- Create: `frontend/lib/crm/gabarits.ts`
- Test: `frontend/lib/crm/gabarits.test.ts`

- [ ] **Step 1 : test qui échoue**

```ts
// frontend/lib/crm/gabarits.test.ts
import { describe, it, expect } from 'vitest';
import { choisirGabarit, composerRelance, piedOpposition, versHtml } from './gabarits';
import { scorer } from './score';
import type { Dossier } from './types';

const MAINTENANT = new Date('2026-10-31T12:00:00Z');
const d0: Dossier = {
  cle: 'u1', emailNorm: 'awa@mail.com', userId: 'u1', nom: 'Awa Koné', inscritLe: null, derniereConnexion: null,
  premium: false, admin: false, oppose: false, paiementsEnAttente: [], paiementsReussis: [], offreVues: [],
  lignesPortefeuille: 0, messages: [], prospect: null, newsletter: false, leconsAcademy: 0, actions: [],
};
const nombres = (t: string) => t.match(/\d+/g) ?? [];

describe('choisirGabarit', () => {
  it('suit la raison principale', () => {
    const paiement = { ...d0, paiementsEnAttente: [{ montant: 5000, devise: 'XOF', date: '2026-10-12T10:00:00Z' }] };
    expect(choisirGabarit(paiement, scorer(paiement, MAINTENANT))).toBe('paiement_inacheve');
    const offre = { ...d0, offreVues: [{ page: '/pricing', jour: '2026-10-29' }] };
    expect(choisirGabarit(offre, scorer(offre, MAINTENANT))).toBe('offre_consultee');
    const prospect = { ...d0, userId: null, cle: 'email:awa@mail.com' };
    expect(choisirGabarit(prospect, scorer(prospect, MAINTENANT))).toBe('prospect_sans_compte');
    expect(choisirGabarit(d0, scorer(d0, MAINTENANT))).toBe('actif_sans_abonnement');
  });
});

describe('composerRelance', () => {
  it('salue par le prénom et ne cite que les chiffres du dossier', () => {
    const d = { ...d0, paiementsEnAttente: [{ montant: 5000, devise: 'XOF', date: '2026-10-12T10:00:00Z' }] };
    const { sujet, corps } = composerRelance('paiement_inacheve', d);
    expect(corps.startsWith('Bonjour Awa,')).toBe(true);
    expect(sujet.length).toBeGreaterThan(0);
    expect(nombres(corps).every((n) => ['12', '10', '5', '000'].includes(n))).toBe(true);
  });

  it('aucun autre gabarit n’invente de chiffre', () => {
    for (const id of ['offre_consultee', 'actif_sans_abonnement', 'prospect_sans_compte'] as const) {
      expect(nombres(composerRelance(id, d0).corps)).toEqual([]);
    }
  });

  it('salue sans prénom quand le nom manque', () => {
    expect(composerRelance('offre_consultee', { ...d0, nom: null }).corps.startsWith('Bonjour,')).toBe(true);
  });
});

describe('piedOpposition et versHtml', () => {
  it('le pied porte toujours le lien d’opposition', () => {
    expect(piedOpposition('https://www.westbourse.com/crm/opposition?t=abc')).toContain('https://www.westbourse.com/crm/opposition?t=abc');
  });
  it('échappe le HTML et rend le lien cliquable', () => {
    const html = versHtml('a <b> & c\nhttps://www.westbourse.com/crm/opposition?t=abc');
    expect(html).toContain('a &lt;b&gt; &amp; c<br>');
    expect(html).toContain('<a href="https://www.westbourse.com/crm/opposition?t=abc">');
  });
});
```

- [ ] **Step 2** — Run : `npx vitest run lib/crm/gabarits.test.ts` — Expected : FAIL (module absent).

- [ ] **Step 3 : implémentation**

```ts
// frontend/lib/crm/gabarits.ts
/**
 * Gabarits de relance — PURS. N'insèrent QUE des faits du dossier (prénom,
 * date, montant) ; l'exploitant relit et corrige avant d'envoyer. Le pied
 * d'opposition est ajouté À L'ENVOI (le jeton n'existe qu'à ce moment) :
 * art. 21 RGPD, absolu en prospection.
 */
import { fmtFcfa, fmtJour } from './score';
import type { Dossier, Score } from './types';

export type TemplateId = 'paiement_inacheve' | 'offre_consultee' | 'actif_sans_abonnement' | 'prospect_sans_compte';

export function choisirGabarit(d: Dossier, s: Score): TemplateId {
  const codes = new Set(s.raisons.map((r) => r.code));
  if (codes.has('paiement')) return 'paiement_inacheve';
  if (codes.has('offre')) return 'offre_consultee';
  if (!d.userId) return 'prospect_sans_compte';
  return 'actif_sans_abonnement';
}

const SIGNATURE = "L'équipe WESTBOURSE";

export function composerRelance(id: TemplateId, d: Dossier): { sujet: string; corps: string } {
  const prenom = d.nom?.trim().split(/\s+/)[0];
  const bonjour = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const paiement = [...d.paiementsEnAttente].sort((a, b) => b.date.localeCompare(a.date))[0];
  switch (id) {
    case 'paiement_inacheve':
      return {
        sujet: 'Votre abonnement Premium WESTBOURSE',
        corps: [
          bonjour,
          '',
          paiement
            ? `Vous aviez commencé votre abonnement Premium le ${fmtJour(paiement.date)}, pour ${fmtFcfa(paiement.montant)}, sans aller jusqu'au bout.`
            : "Vous aviez commencé votre abonnement Premium sans aller jusqu'au bout.",
          "Si quelque chose vous a arrêté (moyen de paiement, question sur l'offre), répondez simplement à ce message : nous vous répondrons personnellement.",
          '',
          SIGNATURE,
        ].join('\n'),
      };
    case 'offre_consultee':
      return {
        sujet: "Une question sur l'offre Premium ?",
        corps: [bonjour, '', "Vous avez récemment regardé l'offre Premium de WESTBOURSE.", 'Si vous avez une question sur ce qu’elle contient, répondez simplement à ce message.', '', SIGNATURE].join('\n'),
      };
    case 'prospect_sans_compte':
      return {
        sujet: 'Votre compte WESTBOURSE',
        corps: [bonjour, '', 'Vous nous aviez laissé vos coordonnées sur WESTBOURSE.', 'Vous pouvez créer votre compte gratuitement sur https://www.westbourse.com/signup ; pour toute question, répondez à ce message.', '', SIGNATURE].join('\n'),
      };
    case 'actif_sans_abonnement':
      return {
        sujet: "Ce que l'offre Premium ajoute",
        corps: [bonjour, '', "Merci d'utiliser WESTBOURSE. L'offre Premium ajoute notamment les signaux expliqués et le diagnostic des sociétés.", 'Si vous voulez en savoir plus, répondez simplement à ce message.', '', SIGNATURE].join('\n'),
      };
  }
}

export function piedOpposition(lien: string): string {
  return `—\nVous ne souhaitez plus recevoir ce type de message ? ${lien}`;
}

export function versHtml(texte: string): string {
  const echappe = texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return echappe.replace(/https:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`).replace(/\n/g, '<br>');
}
```

- [ ] **Step 4** — Run : `npx vitest run lib/crm/gabarits.test.ts` — Expected : PASS (6 tests).
- [ ] **Step 5** — `git add lib/crm && git commit -m "feat(crm): gabarits de relance sans chiffre étranger (pur, testé)"`

---

### Task 6 : Chargeur serveur et opposition

**Files:**
- Create: `frontend/lib/crm/charger.ts`, `frontend/lib/crm/opposition.ts`

- [ ] **Step 1 : chargeur**

```ts
// frontend/lib/crm/charger.ts
/**
 * Lecture des sources du CRM — SERVEUR uniquement (service_role). Toute liste
 * passe par fetchAllRows : PostgREST tronque à 1000 lignes en silence.
 */
import { getServiceClient } from '@/lib/billing/serviceClient';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { assemblerDossiers, type Sources } from './identite';
import type { Dossier } from './types';

async function comptes(sb: ReturnType<typeof getServiceClient>): Promise<Sources['comptes']> {
  const tous: Sources['comptes'] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`CRM : lecture des comptes impossible (${error.message})`);
    tous.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null, created_at: u.created_at ?? null, last_sign_in_at: u.last_sign_in_at ?? null })));
    if (data.users.length < 1000) break;
  }
  return tous;
}

export async function chargerSources(): Promise<Sources> {
  const sb = getServiceClient();
  const depuis = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString().slice(0, 10);
  const [c, profils, admins, paiements, signaux, positions, messages, prospects, newsletter, academy, actions, oppositions] = await Promise.all([
    comptes(sb),
    fetchAllRows<Sources['profils'][number]>((a, b) => sb.from('profiles').select('id, display_name, is_premium').order('id').range(a, b)),
    fetchAllRows<Sources['admins'][number]>((a, b) => sb.from('admin_user_roles').select('user_id').order('user_id').range(a, b)),
    fetchAllRows<Sources['paiements'][number]>((a, b) => sb.from('billing_transactions').select('user_id, amount, currency, status, created_at, paid_at').in('status', ['pending', 'paid']).order('created_at').range(a, b)),
    fetchAllRows<Sources['signaux'][number]>((a, b) => sb.from('crm_signaux').select('user_id, page, jour').gte('jour', depuis(14)).order('id').range(a, b)),
    fetchAllRows<Sources['positions'][number]>((a, b) => sb.from('portfolios_positions').select('user_id').order('id').range(a, b)),
    fetchAllRows<Sources['messages'][number]>((a, b) => sb.from('contact_messages').select('email, created_at').order('created_at').range(a, b)),
    fetchAllRows<Sources['prospects'][number]>((a, b) => sb.from('leads_brvm').select('email, nom, created_at, consent').order('created_at').range(a, b)),
    fetchAllRows<Sources['newsletter'][number]>((a, b) => sb.from('newsletter_subscribers').select('email, confirmed').order('id').range(a, b)),
    fetchAllRows<Sources['academy'][number]>((a, b) => sb.from('academy_progress').select('user_id, completed').eq('completed', true).order('user_id').range(a, b)),
    fetchAllRows<Sources['actions'][number]>((a, b) => sb.from('crm_actions').select('email_norm, created_at, type, statut, canal, sujet, contenu').order('created_at').range(a, b)),
    fetchAllRows<Sources['oppositions'][number]>((a, b) => sb.from('crm_oppositions').select('email_norm').order('email_norm').range(a, b)),
  ]);
  return { comptes: c, profils, admins, paiements, signaux, positions, messages, prospects, newsletter, academy, actions, oppositions };
}

export async function chargerDossiers(): Promise<Dossier[]> {
  return assemblerDossiers(await chargerSources());
}

/** À l'échelle actuelle (≈ 200 personnes), recharger tout reste instantané. */
export async function chargerDossier(cle: string): Promise<Dossier | null> {
  return (await chargerDossiers()).find((d) => d.cle === cle) ?? null;
}
```

- [ ] **Step 2 : opposition**

```ts
// frontend/lib/crm/opposition.ts
/** Droit d'opposition (art. 21) — SERVEUR uniquement (service_role). */
import { getServiceClient } from '@/lib/billing/serviceClient';
import { normaliserEmail } from './identite';

export type SourceOpposition = 'parametres' | 'lien' | 'admin';

export async function estOppose(email: string): Promise<boolean> {
  const { data } = await getServiceClient().from('crm_oppositions').select('email_norm').eq('email_norm', normaliserEmail(email)).maybeSingle();
  return data != null;
}

export async function enregistrerOpposition(email: string, source: SourceOpposition): Promise<boolean> {
  const emailNorm = normaliserEmail(email);
  if (!emailNorm) return false;
  const { error } = await getServiceClient().from('crm_oppositions').upsert({ email_norm: emailNorm, source }, { onConflict: 'email_norm', ignoreDuplicates: true });
  return !error;
}

export async function retirerOpposition(email: string): Promise<boolean> {
  const { error } = await getServiceClient().from('crm_oppositions').delete().eq('email_norm', normaliserEmail(email));
  return !error;
}
```

- [ ] **Step 3** — Run : `npx tsc --noEmit -p .` — Expected : aucune erreur nouvelle (`getServiceClient` crée bien un client `@supabase/supabase-js` à clé de service : `auth.admin` est disponible).
- [ ] **Step 4** — `git add lib/crm && git commit -m "feat(crm): chargeur serveur paginé et module d'opposition"`

---

### Task 7 : Balise « a consulté l'offre »

**Files:**
- Create: `frontend/lib/crm/signal.ts`, `frontend/app/api/crm/signal/route.ts`, `frontend/components/crm/SignalOffre.tsx`
- Modify: `frontend/app/pricing/page.tsx` (racine du `return`, l. ~31), `frontend/app/premium/upgrade/page.tsx` (l. ~3), `frontend/app/account/plan/page.tsx` (avant `<PlanClient …/>`, l. ~113)

- [ ] **Step 1**

```ts
// frontend/lib/crm/signal.ts
/** Pages dont la consultation (connectée) compte comme intérêt pour l'offre. */
export const PAGES_OFFRE = ['/pricing', '/account/plan', '/premium/upgrade'] as const;
export type PageOffre = (typeof PAGES_OFFRE)[number];
export const estPageOffre = (p: unknown): p is PageOffre => typeof p === 'string' && (PAGES_OFFRE as readonly string[]).includes(p);
```

- [ ] **Step 2**

```ts
// frontend/app/api/crm/signal/route.ts
/**
 * Balise « a consulté l'offre ». Appelée par <SignalOffre> AU MONTAGE, jamais
 * au rendu serveur : Next précharge /pricing et /premium/upgrade sans que la
 * personne voie la page (revue Fable du 2026-10-31). Une ligne par jour et par
 * page ; rien pour un visiteur anonyme ni pour une personne opposée.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { estPageOffre } from '@/lib/crm/signal';
import { estOppose } from '@/lib/crm/opposition';

export async function POST(req: Request) {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user?.email) return new NextResponse(null, { status: 204 });
  let page: unknown;
  try { page = ((await req.json()) as { page?: unknown })?.page; } catch { return new NextResponse(null, { status: 400 }); }
  if (!estPageOffre(page)) return new NextResponse(null, { status: 400 });
  if (await estOppose(user.email)) return new NextResponse(null, { status: 204 });
  const { error } = await getServiceClient()
    .from('crm_signaux')
    .upsert({ user_id: user.id, type: 'offre_vue', page }, { onConflict: 'user_id,page,jour', ignoreDuplicates: true });
  if (error) {
    console.error('crm_signal : écriture refusée', error.code);
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3**

```tsx
// frontend/components/crm/SignalOffre.tsx
'use client';
import { useEffect } from 'react';
import type { PageOffre } from '@/lib/crm/signal';

/** Envoie la balise une fois la page réellement affichée (un préchargement ne monte pas ce composant). */
export default function SignalOffre({ page }: { page: PageOffre }) {
  useEffect(() => {
    void fetch('/api/crm/signal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page }),
      keepalive: true,
    }).catch(() => {});
  }, [page]);
  return null;
}
```

- [ ] **Step 4** — dans chacune des trois pages : `import SignalOffre from '@/components/crm/SignalOffre';` puis, premier enfant de l'élément racine renvoyé : `<SignalOffre page="/pricing" />`, `<SignalOffre page="/premium/upgrade" />`, `<SignalOffre page="/account/plan" />` (plan : juste avant `<PlanClient … />`).
- [ ] **Step 5** — Run : `npx tsc --noEmit -p .` — Expected : aucune erreur nouvelle.
- [ ] **Step 6** — `git add -A lib/crm app/api/crm components/crm app/pricing app/premium/upgrade app/account/plan && git commit -m "feat(crm): balise d'intérêt pour l'offre, envoyée au montage"`

---

### Task 8 : Opposition (lien confirmé, paramètres)

**Files:**
- Create: `frontend/app/crm/opposition/actions.ts`, `frontend/app/crm/opposition/page.tsx`, `frontend/app/parametres/compte/oppositionAction.ts`, `frontend/components/crm/OppositionProfilage.tsx`
- Modify: `frontend/lib/supabase/middleware.ts` (`PUBLIC_EXACT`), `frontend/app/parametres/compte/page.tsx`

- [ ] **Step 1**

```ts
// frontend/app/crm/opposition/actions.ts
'use server';
import { redirect } from 'next/navigation';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { enregistrerOpposition } from '@/lib/crm/opposition';

/**
 * Confirmée par un BOUTON : un scanner de liens qui ouvre l'URL ne doit pas
 * opposer la personne à sa place. Jeton inconnu : même réponse (pas d'oracle).
 */
export async function confirmerOpposition(formData: FormData): Promise<void> {
  const jeton = String(formData.get('t') ?? '');
  if (/^[a-f0-9]{48}$/.test(jeton)) {
    const { data } = await getServiceClient().from('crm_actions').select('email_norm').eq('jeton_opposition', jeton).maybeSingle();
    if (data?.email_norm) await enregistrerOpposition(data.email_norm, 'lien');
  }
  redirect('/crm/opposition?fait=1');
}
```

- [ ] **Step 2**

```tsx
// frontend/app/crm/opposition/page.tsx
import { confirmerOpposition } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ne plus recevoir de proposition', robots: { index: false } };

export default function Page({ searchParams }: { searchParams: { t?: string; fait?: string } }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold text-ivory">Ne plus recevoir de proposition</h1>
      {searchParams.fait ? (
        <p className="mt-4 text-muted">C&apos;est noté : WESTBOURSE ne vous adressera plus de proposition commerciale fondée sur votre activité.</p>
      ) : (
        <form action={confirmerOpposition} className="mt-6">
          <input type="hidden" name="t" value={searchParams.t ?? ''} />
          <p className="text-muted">Confirmez pour ne plus recevoir de proposition commerciale de WESTBOURSE.</p>
          <button type="submit" className="mt-6 rounded-full bg-accent px-6 py-2.5 font-semibold text-bg">Confirmer</button>
        </form>
      )}
    </main>
  );
}
```

- [ ] **Step 3** — `PUBLIC_EXACT` (`lib/supabase/middleware.ts`) : ajouter `'/crm/opposition',` après `'/apercu',`.

- [ ] **Step 4**

```ts
// frontend/app/parametres/compte/oppositionAction.ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { enregistrerOpposition, estOppose, retirerOpposition } from '@/lib/crm/opposition';

export async function lireOpposition(): Promise<boolean> {
  const { data: { user } } = await createClient().auth.getUser();
  return user?.email ? estOppose(user.email) : false;
}

export async function basculerOpposition(oppose: boolean): Promise<boolean> {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user?.email) return false;
  const ok = oppose ? await enregistrerOpposition(user.email, 'parametres') : await retirerOpposition(user.email);
  return ok ? oppose : !oppose;
}
```

- [ ] **Step 5**

```tsx
// frontend/components/crm/OppositionProfilage.tsx
'use client';
import { useEffect, useState } from 'react';
import { basculerOpposition, lireOpposition } from '@/app/parametres/compte/oppositionAction';

export default function OppositionProfilage() {
  const [oppose, setOppose] = useState<boolean | null>(null);
  useEffect(() => { void lireOpposition().then(setOppose); }, []);
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" className="mt-1" disabled={oppose === null} checked={oppose === true}
        onChange={async (e) => setOppose(await basculerOpposition(e.target.checked))} />
      <span>
        Ne pas utiliser mon activité pour me proposer l&apos;offre Premium.
        <span className="block text-xs text-faint">WESTBOURSE ne vous adressera alors plus de proposition commerciale.</span>
      </span>
    </label>
  );
}
```

- [ ] **Step 6** — dans `app/parametres/compte/page.tsx` : `import OppositionProfilage from '@/components/crm/OppositionProfilage';` et, avant la section à bordure `border-down/20`, une section du même style que les voisines (`bg-surface border border-border rounded-card shadow-card p-6 space-y-4`) contenant un `SectionHeader` (même prop que les autres sections du fichier) intitulé « Propositions commerciales » puis `<OppositionProfilage />`.
- [ ] **Step 7** — Run : `npx tsc --noEmit -p .` — Expected : aucune erreur nouvelle.
- [ ] **Step 8** — `git add -A app/crm app/parametres components/crm lib/supabase/middleware.ts && git commit -m "feat(crm): droit d'opposition — lien confirmé et case dans les paramètres"`

---

### Task 9 : Liste `/admin/crm`

**Files:**
- Create: `frontend/app/admin/crm/page.tsx`

- [ ] **Step 1**

```tsx
// frontend/app/admin/crm/page.tsx
import Link from 'next/link';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader } from '@/components/ui/premium';
import { chargerDossiers } from '@/lib/crm/charger';
import { estExclu, scorer, fmtJour } from '@/lib/crm/score';
import type { Niveau } from '@/lib/crm/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'CRM — Administration' };

const NIVEAUX: (Niveau | 'tous')[] = ['chaud', 'tiede', 'froid', 'tous'];
const LIB: Record<Niveau | 'tous', string> = { chaud: 'Chaud', tiede: 'Tiède', froid: 'Froid', tous: 'Tous' };

export default async function Page({ searchParams }: { searchParams: { niveau?: string } }) {
  await requirePermission('crm.read');
  const filtre = (NIVEAUX as string[]).includes(searchParams.niveau ?? '') ? (searchParams.niveau as Niveau | 'tous') : 'chaud';
  const maintenant = new Date();
  const lignes = (await chargerDossiers())
    .filter((d) => !estExclu(d))
    .map((d) => ({ d, s: scorer(d, maintenant), relance: [...d.actions].filter((a) => a.type === 'relance').sort((a, b) => b.date.localeCompare(a.date))[0] }))
    .filter((x) => filtre === 'tous' || x.s.niveau === filtre)
    .sort((a, b) => b.s.score - a.s.score);

  return (
    <div className="space-y-6">
      <SectionHeader title="CRM · proches du Premium" />
      <nav className="flex gap-2 text-sm">
        {NIVEAUX.map((n) => (
          <Link key={n} href={`/admin/crm?niveau=${n}`} className={`rounded-full border px-3 py-1 ${n === filtre ? 'border-accent text-accent-ink' : 'border-border text-muted'}`}>{LIB[n]}</Link>
        ))}
      </nav>
      {lignes.length === 0 ? (
        <p className="text-sm text-muted">Aucune personne à relancer pour l&apos;instant. Signaux suivis : paiement commencé, offre consultée, connexions, portefeuille, messages, newsletter, Academy.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-faint">
              <th className="py-2">Personne</th><th>Score</th><th>Raisons principales</th><th>Dernière connexion</th><th>Dernière relance</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(({ d, s, relance }) => (
              <tr key={d.cle} className="border-t border-border align-top">
                <td className="py-2">
                  <Link href={`/admin/crm/${encodeURIComponent(d.cle)}`} className="font-medium text-ivory hover:text-accent-ink">{d.nom ?? d.emailNorm}</Link>
                  {!d.userId && <span className="ml-2 text-xs text-faint">prospect sans compte</span>}
                </td>
                <td className="tabular">{s.score} · {LIB[s.niveau]}</td>
                <td className="text-muted">{s.raisons.slice(0, 2).map((r) => r.texte).join(' ; ') || '—'}</td>
                <td className="tabular text-muted">{d.derniereConnexion ? fmtJour(d.derniereConnexion) : '—'}</td>
                <td className="text-muted">{relance ? `${fmtJour(relance.date)} · ${relance.canal ?? ''} (${relance.statut})` : 'jamais relancé'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

Avant d'écrire : vérifier dans `app/admin/leads/page.tsx` le nom exact de la prop de `SectionHeader` (`title` ou autre) et s'y conformer.

- [ ] **Step 2** — Run : `npx tsc --noEmit -p .` — Expected : aucune erreur nouvelle.
- [ ] **Step 3** — `git add app/admin/crm && git commit -m "feat(crm): liste classée par proximité du Premium"`

---

### Task 10 : Fiche, relance et notes

**Files:**
- Create: `frontend/app/admin/crm/[cle]/actions.ts`, `RelanceForm.tsx`, `NoteForm.tsx`, `page.tsx`

- [ ] **Step 1 : actions serveur**

```ts
// frontend/app/admin/crm/[cle]/actions.ts
'use server';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { sendEmail } from '@/lib/server/email';
import { ADRESSE_SUPPORT } from '@/lib/contact/validerBrouillon';
import { chargerDossier } from '@/lib/crm/charger';
import { estOppose, enregistrerOpposition } from '@/lib/crm/opposition';
import { scorer } from '@/lib/crm/score';
import { piedOpposition, versHtml, type TemplateId } from '@/lib/crm/gabarits';

const EXPEDITEUR = `WESTBOURSE <${ADRESSE_SUPPORT}>`;
const SITE = 'https://www.westbourse.com';
type Retour = { ok: boolean; message: string };

export async function envoyerRelance(cle: string, sujet: string, corps: string, templateId: TemplateId): Promise<Retour> {
  const ctx = await requirePermission('crm.write');
  const s = sujet.trim().slice(0, 150);
  const c = corps.trim().slice(0, 5000);
  if (!s || !c) return { ok: false, message: 'Sujet et message obligatoires.' };
  const d = await chargerDossier(cle);
  if (!d) return { ok: false, message: 'Personne introuvable.' };
  // Revérifiée ICI, pas seulement dans la liste (revue Fable).
  if (await estOppose(d.emailNorm)) return { ok: false, message: "Cette personne s'est opposée aux propositions commerciales : envoi refusé." };

  const sb = getServiceClient();
  const deuxMinutes = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: enCours } = await sb.from('crm_actions').select('id').eq('email_norm', d.emailNorm).eq('statut', 'envoi').gte('created_at', deuxMinutes).limit(1);
  if (enCours && enCours.length > 0) return { ok: false, message: 'Une relance est déjà en cours d’envoi pour cette personne.' };

  const score = scorer(d, new Date());
  const jeton = randomBytes(24).toString('hex');
  const { data: ligne, error } = await sb.from('crm_actions').insert({
    email_norm: d.emailNorm, user_id: d.userId, type: 'relance', canal: 'email', template_id: templateId,
    sujet: s, contenu: c, score_at_envoi: score.score, signaux_json: score.raisons, statut: 'envoi',
    jeton_opposition: jeton, auteur: ctx.userId,
  }).select('id').single();
  if (error || !ligne) return { ok: false, message: 'Journal indisponible : envoi annulé.' };

  const texte = `${c}\n\n${piedOpposition(`${SITE}/crm/opposition?t=${jeton}`)}`;
  const res = await sendEmail({ to: d.emailNorm, subject: s, text: texte, html: versHtml(texte), from: EXPEDITEUR, replyTo: ADRESSE_SUPPORT });
  // L'échec est journalisé et affiché, jamais avalé (panne e-mail 07–09/2026).
  await sb.from('crm_actions').update(res.ok ? { statut: 'envoye', resend_id: res.id ?? null } : { statut: 'echec', erreur: (res.error ?? 'inconnue').slice(0, 300) }).eq('id', ligne.id);
  await recordAudit(ctx, { action: 'crm.relance', resourceType: 'crm_contact', resourceId: d.cle, severity: res.ok ? 'info' : 'warning', metadata: { template: templateId, ok: res.ok } });
  revalidatePath(`/admin/crm/${encodeURIComponent(cle)}`);
  return res.ok ? { ok: true, message: 'Relance envoyée.' } : { ok: false, message: `Échec de l'envoi : ${res.error ?? 'inconnu'}` };
}

export async function ajouterNote(cle: string, contenu: string): Promise<Retour> {
  const ctx = await requirePermission('crm.write');
  const c = contenu.trim().slice(0, 2000);
  if (!c) return { ok: false, message: 'Note vide.' };
  const d = await chargerDossier(cle);
  if (!d) return { ok: false, message: 'Personne introuvable.' };
  const { error } = await getServiceClient().from('crm_actions').insert({ email_norm: d.emailNorm, user_id: d.userId, type: 'note', contenu: c, statut: 'note', auteur: ctx.userId });
  if (error) return { ok: false, message: 'Note non enregistrée.' };
  revalidatePath(`/admin/crm/${encodeURIComponent(cle)}`);
  return { ok: true, message: 'Note ajoutée.' };
}

export async function opposerParAdmin(cle: string): Promise<Retour> {
  const ctx = await requirePermission('crm.write');
  const d = await chargerDossier(cle);
  if (!d) return { ok: false, message: 'Personne introuvable.' };
  const ok = await enregistrerOpposition(d.emailNorm, 'admin');
  await recordAudit(ctx, { action: 'crm.opposition', resourceType: 'crm_contact', resourceId: d.cle, severity: 'info', metadata: { ok } });
  revalidatePath(`/admin/crm/${encodeURIComponent(cle)}`);
  return ok ? { ok: true, message: 'Opposition enregistrée.' } : { ok: false, message: 'Échec.' };
}
```

- [ ] **Step 2 : formulaire de relance**

```tsx
// frontend/app/admin/crm/[cle]/RelanceForm.tsx
'use client';
import { useState, useTransition } from 'react';
import { envoyerRelance } from './actions';
import type { TemplateId } from '@/lib/crm/gabarits';

export default function RelanceForm({ cle, templateId, sujetInitial, corpsInitial, relanceRecente, oppose }: {
  cle: string; templateId: TemplateId; sujetInitial: string; corpsInitial: string; relanceRecente: string | null; oppose: boolean;
}) {
  const [sujet, setSujet] = useState(sujetInitial);
  const [corps, setCorps] = useState(corpsInitial);
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  const [envoi, demarrer] = useTransition();
  if (oppose) return <p className="text-sm text-down">Cette personne s&apos;est opposée aux propositions commerciales : relance désactivée.</p>;
  return (
    <div className="space-y-3">
      {relanceRecente && <p className="rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">Déjà relancée le {relanceRecente} : moins de 14 jours.</p>}
      <input value={sujet} onChange={(e) => setSujet(e.target.value)} className="w-full rounded-md border border-border bg-sunken px-3 py-2 text-sm" aria-label="Sujet" />
      <textarea value={corps} onChange={(e) => setCorps(e.target.value)} rows={10} className="w-full rounded-md border border-border bg-sunken px-3 py-2 text-sm" aria-label="Message" />
      <p className="text-xs text-faint">Le lien d&apos;opposition est ajouté automatiquement en pied de message.</p>
      <button disabled={envoi} onClick={() => demarrer(async () => setRetour(await envoyerRelance(cle, sujet, corps, templateId)))} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-bg disabled:opacity-50">
        {envoi ? 'Envoi…' : 'Envoyer la relance'}
      </button>
      {retour && <p className={`text-sm ${retour.ok ? 'text-up' : 'text-down'}`}>{retour.message}</p>}
    </div>
  );
}
```

- [ ] **Step 3 : formulaire de note**

```tsx
// frontend/app/admin/crm/[cle]/NoteForm.tsx
'use client';
import { useState, useTransition } from 'react';
import { ajouterNote } from './actions';

export default function NoteForm({ cle }: { cle: string }) {
  const [note, setNote] = useState('');
  const [retour, setRetour] = useState<string | null>(null);
  const [envoi, demarrer] = useTransition();
  return (
    <div className="space-y-2">
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-sunken px-3 py-2 text-sm" aria-label="Note interne" placeholder="Note interne (jamais visible par la personne)" />
      <button disabled={envoi || !note.trim()} onClick={() => demarrer(async () => { const r = await ajouterNote(cle, note); setRetour(r.message); if (r.ok) setNote(''); })} className="rounded-full border border-border px-4 py-1.5 text-sm disabled:opacity-50">Ajouter la note</button>
      {retour && <p className="text-xs text-muted">{retour}</p>}
    </div>
  );
}
```

- [ ] **Step 4 : page fiche**

```tsx
// frontend/app/admin/crm/[cle]/page.tsx
import { notFound } from 'next/navigation';
import { requirePermission, can } from '@/lib/server/rbac';
import { SectionHeader } from '@/components/ui/premium';
import { chargerDossier } from '@/lib/crm/charger';
import { chronologie } from '@/lib/crm/identite';
import { scorer, fmtJour } from '@/lib/crm/score';
import { choisirGabarit, composerRelance } from '@/lib/crm/gabarits';
import RelanceForm from './RelanceForm';
import NoteForm from './NoteForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fiche CRM — Administration' };

export default async function Page({ params }: { params: { cle: string } }) {
  const ctx = await requirePermission('crm.read');
  const d = await chargerDossier(decodeURIComponent(params.cle));
  if (!d) notFound();
  const maintenant = new Date();
  const s = scorer(d, maintenant);
  const templateId = choisirGabarit(d, s);
  const { sujet, corps } = composerRelance(templateId, d);
  const derniere = [...d.actions].filter((a) => a.type === 'relance').sort((a, b) => b.date.localeCompare(a.date))[0];
  const recente = derniere && maintenant.getTime() - Date.parse(derniere.date) < 14 * 86_400_000 ? fmtJour(derniere.date) : null;

  return (
    <div className="space-y-8">
      <SectionHeader title={d.nom ?? d.emailNorm} />
      <section className="space-y-1 text-sm">
        <p className="text-muted">{d.emailNorm} · {d.userId ? (d.premium ? 'Premium' : 'compte gratuit') : 'prospect sans compte'}{d.inscritLe ? ` · inscrit le ${fmtJour(d.inscritLe)}` : ''}</p>
        <p className="tabular text-ivory">Score {s.score} · {s.niveau}</p>
        <ul className="list-disc pl-5 text-muted">{s.raisons.map((r) => <li key={r.code}>{r.texte} (+{r.points})</li>)}</ul>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ivory">Chronologie</h2>
        <ul className="space-y-1 text-sm">{chronologie(d).map((e, i) => <li key={i} className="text-muted"><span className="tabular text-faint">{fmtJour(e.date)}</span> · {e.libelle}</li>)}</ul>
      </section>
      {can(ctx, 'crm.write') && (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ivory">Relance par e-mail</h2>
            <RelanceForm cle={d.cle} templateId={templateId} sujetInitial={sujet} corpsInitial={corps} relanceRecente={recente} oppose={d.oppose} />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ivory">Notes internes</h2>
            <NoteForm cle={d.cle} />
          </section>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5** — Run : `npx tsc --noEmit -p .` — Expected : aucune erreur nouvelle.
- [ ] **Step 6** — `git add app/admin/crm && git commit -m "feat(crm): fiche, relance journalisée avec lien d'opposition, notes internes"`

---

### Task 11 : RGPD — export, suppression, information

**Files:**
- Modify: `frontend/app/api/account/export/route.ts`, `frontend/app/api/account/delete/route.ts`, `frontend/app/confidentialite/page.tsx`

- [ ] **Step 1 : export** — après le bloc `contactMessages` :

```ts
  // CRM (migration 0172) : tables sans policy, lecture service_role FILTRÉE.
  // L'e-mail ne sert de clé que s'il est confirmé (même règle que contact_messages).
  const sbCrm = getServiceClient();
  const emailCrm = user.email && user.email_confirmed_at ? user.email.trim().toLowerCase() : null;
  const colonnesCrm = 'type, canal, sujet, contenu, statut, created_at';
  const crmSignaux = (await sbCrm.from('crm_signaux').select('page, jour, created_at').eq('user_id', user.id)).data ?? [];
  const crmActions = (emailCrm
    ? await sbCrm.from('crm_actions').select(colonnesCrm).or(`user_id.eq.${user.id},email_norm.eq.${emailCrm}`)
    : await sbCrm.from('crm_actions').select(colonnesCrm).eq('user_id', user.id)).data ?? [];
  const crmOpposition = emailCrm ? (await sbCrm.from('crm_oppositions').select('source, created_at').eq('email_norm', emailCrm)).data ?? [] : [];
```

et dans `payload`, après `contact_messages: contactMessages,` :

```ts
    // CRM : intérêt pour l'offre, relances et notes vous concernant, opposition.
    crm_signaux: crmSignaux,
    crm_actions: crmActions,
    crm_opposition: crmOpposition,
```

- [ ] **Step 2 : suppression** — avant « 3. Suppression définitive du compte auth » :

```ts
  // CRM (0172) : crm_signaux part avec la cascade ; actions et opposition sont
  // aussi indexées par e-mail (prospect devenu compte) — purge explicite.
  if (user.email) {
    const emailCrm = user.email.trim().toLowerCase();
    await admin.from('crm_actions').delete().eq('email_norm', emailCrm);
    await admin.from('crm_oppositions').delete().eq('email_norm', emailCrm);
  }
  await admin.from('crm_actions').delete().eq('user_id', user.id);
```

- [ ] **Step 3 : information** (`/confidentialite`) :
  - liste « Données collectées », nouvel item :
    ```tsx
          <li>
            <strong>Relation commerciale</strong> : pages de l&apos;offre Premium consultées en étant connecté,
            messages que nous vous adressons pour vous la proposer, et notes internes associées.
          </li>
    ```
  - liste « Finalités et base légale », nouvel item :
    ```tsx
          <li>
            Vous proposer l&apos;offre Premium lorsque votre activité montre un intérêt (paiement commencé,
            offre consultée…) : intérêt légitime. Une personne de WESTBOURSE décide de chaque message ;
            vous pouvez vous y opposer à tout moment (lien en pied de chaque message, ou Paramètres → Compte).
          </li>
    ```
  - paragraphe « Durées de conservation », phrase ajoutée à la fin : `Les consultations de l'offre sont conservées 90 jours, nos messages de proposition et les notes associées 24 mois.`
- [ ] **Step 4** — Run : `npx tsc --noEmit -p .` — Expected : aucune erreur nouvelle.
- [ ] **Step 5** — `git commit -am "feat(crm): export, suppression et information RGPD"`

---

### Task 12 : Vérifications de bout en bout

- [ ] **Step 1** — Run : `npx vitest run lib/crm` — Expected : 19 tests PASS (identité 5, score 8, gabarits 6).
- [ ] **Step 2** — Run : `npx tsc --noEmit -p .` puis `npm run build` — Expected : vert.
- [ ] **Step 3 : sécurité** (après application de la migration par l'utilisateur) — `supabase db advisors --linked` (aucun avis nouveau) ; à la clé **publishable** (anon), pour `crm_signaux`, `crm_actions`, `crm_oppositions` : `GET /rest/v1/<table>?select=*` → `401`/`[]`, `POST` → refusé ; `select has_function_privilege('anon', 'public.purge_rgpd_retention()', 'execute')` → `false`.
- [ ] **Step 4 : parcours réel en local** (`npm run dev`, connexion admin selon la mémoire « vérifier une page connectée ») :
  1. ouvrir `/pricing` connecté → une ligne `crm_signaux` du jour, une seule même après rechargement ;
  2. `/admin/crm` → la liste s'affiche, raisons lisibles et datées ;
  3. fiche d'un compte de test → relance vers **l'adresse de l'exploitant** → `crm_actions.statut = 'envoye'`, e-mail reçu avec lien d'opposition ;
  4. ouvrir le lien → page de confirmation, **aucune** opposition avant « Confirmer » ; cliquer → ligne `crm_oppositions` ;
  5. retour sur la fiche → relance désactivée ; un appel direct à l'action → refus « opposée ».
- [ ] **Step 5 : PR** — pousser `feat/crm-interne`, ouvrir la PR (migration à appliquer, résultats des étapes 1–4) ; la fusion attend « fusionner ».

---

## Auto-revue

- **Couverture de la spec** : §3.1 → T3 ; §3.2 → T4 ; §4.1 → T1, T7 ; §4.2 (+ instantané) → T1, T10 ; §4.3 → T1, T8, T10 ; §4.4 → T1, T2 ; §4.5 → T1 ; §5.1 → T9 ; §5.2 (garde-fou 14 j, notes, opposition) → T10 ; §6 (revérification, verrou, pied, échec journalisé) → T10 ; §7 → T8, T11 ; §8 → T3–T5, T12.
- **Cohérence des types** : `Dossier`, `Score`, `Raison`, `TemplateId`, `Sources` définis une fois (T3–T5) et repris tels quels ; `fmtJour`/`fmtFcfa` exportés de `score.ts`, importés par `gabarits.ts` et les pages.
- **Lectures de liste** : toutes paginées (`fetchAllRows`) ; les seules requêtes non paginées sont des lectures par clé (`maybeSingle`, `.limit(1)`).
