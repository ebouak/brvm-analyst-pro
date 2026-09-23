# Formations live payantes — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**But :** vendre des places à des sessions de formation animées en direct, encaissées par le flux de paiement manuel existant, avec réservation réservée aux titulaires d'un compte.

**Architecture :** deux tables (`formation_sessions`, `formation_inscriptions`) ; l'argent réutilise `billing_transactions` avec une colonne `objet` qui distingue une formation d'un abonnement ; un module pur porte les règles (prix applicable, place disponible, transitions de statut) ; une vue masque le lien de visioconférence aux non-inscrits ; quatre pages (liste publique, détail, mes inscriptions, console).

**Pile :** Next.js 14 App Router, Supabase Postgres + RLS, TypeScript strict, vitest. Spec : `docs/superpowers/specs/2026-09-23-formations-live-design.md`.

**Conventions du dépôt à respecter :**
- migrations : `supabase/migrations/NNNN_nom.sql`, numérotation à la suite (dernière : `0136`) ;
- actions d'administration : `requirePermission('content.write')` puis `recordAudit(...)` — voir `app/admin/landing/actions.ts` ;
- tests purs : `lib/**/*.test.ts`, lancés par `npx vitest run <fichier>` ;
- après chaque migration : `get_advisors` (type security) **et** essai à la clé anon.

---

### Tâche 1 : règles pures (prix, place, transitions)

**Fichiers :**
- Créer : `frontend/lib/formations/regles.ts`
- Test : `frontend/lib/formations/regles.test.ts`

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
// frontend/lib/formations/regles.test.ts
import { describe, expect, it } from 'vitest';
import { prixApplicable, placeDisponible, transitionAutorisee, type SessionTarif } from './regles';

const S = (o: Partial<SessionTarif> = {}): SessionTarif => ({ prix: 25000, prix_abonne: 15000, places: 20, places_prises: 0, statut: 'ouverte', ...o });

describe('prixApplicable', () => {
  it('applique le tarif abonné quand il existe et que la personne est abonnée', () => {
    expect(prixApplicable(S(), true)).toBe(15000);
  });
  it('applique le tarif plein à un non-abonné', () => {
    expect(prixApplicable(S(), false)).toBe(25000);
  });
  it('applique le tarif plein à un abonné quand aucune remise n’est définie', () => {
    expect(prixApplicable(S({ prix_abonne: null }), true)).toBe(25000);
  });
  it('rend null quand la séance n’a pas de prix — on n’encaisse jamais un montant deviné', () => {
    expect(prixApplicable(S({ prix: null as unknown as number }), false)).toBeNull();
  });
});

describe('placeDisponible', () => {
  it('vrai tant qu’il reste une place', () => expect(placeDisponible(S({ places_prises: 19 }))).toBe(true));
  it('faux à la dernière place prise', () => expect(placeDisponible(S({ places_prises: 20 }))).toBe(false));
  it('faux si la séance n’est pas ouverte, même avec des places', () => {
    expect(placeDisponible(S({ statut: 'annulee' }))).toBe(false);
    expect(placeDisponible(S({ statut: 'brouillon' }))).toBe(false);
    expect(placeDisponible(S({ statut: 'terminee' }))).toBe(false);
  });
});

describe('transitionAutorisee', () => {
  it('autorise réservée → payée et réservée → annulée', () => {
    expect(transitionAutorisee('reservee', 'payee')).toBe(true);
    expect(transitionAutorisee('reservee', 'annulee')).toBe(true);
  });
  it('autorise payée → présente et payée → absente', () => {
    expect(transitionAutorisee('payee', 'presente')).toBe(true);
    expect(transitionAutorisee('payee', 'absente')).toBe(true);
  });
  it('REFUSE annulée → payée : une place annulée ne se paie pas après coup', () => {
    expect(transitionAutorisee('annulee', 'payee')).toBe(false);
  });
  it('refuse réservée → présente : on ne marque présent que ce qui est payé', () => {
    expect(transitionAutorisee('reservee', 'presente')).toBe(false);
  });
});
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `cd frontend && npx vitest run lib/formations/regles.test.ts`
Attendu : ÉCHEC, « Failed to resolve import "./regles" ».

- [ ] **Étape 3 : écrire l'implémentation minimale**

```ts
// frontend/lib/formations/regles.ts
/**
 * Règles pures des formations live. Aucune I/O : tout se teste sans base.
 *
 * Trois décisions y vivent, et elles protègent de l'encaissement fautif :
 *  · un prix absent rend `null` — l'appelant REFUSE la réservation plutôt que
 *    de retomber sur un autre montant, sans quoi on encaisserait un prix que
 *    personne n'a choisi ;
 *  · une séance qui n'est pas `ouverte` n'a jamais de place, même vide ;
 *  · une place annulée ne devient jamais payée : la transition est refusée ici,
 *    et la base ne laisse écrire le statut qu'à la clé de service.
 */

export type StatutSession = 'brouillon' | 'ouverte' | 'complete' | 'annulee' | 'terminee';
export type StatutInscription = 'reservee' | 'payee' | 'annulee' | 'presente' | 'absente';

export interface SessionTarif {
  prix: number | null;
  prix_abonne: number | null;
  places: number;
  places_prises: number;
  statut: StatutSession;
}

export function prixApplicable(s: SessionTarif, estAbonne: boolean): number | null {
  if (estAbonne && s.prix_abonne != null) return Number(s.prix_abonne);
  return s.prix == null ? null : Number(s.prix);
}

export function placeDisponible(s: SessionTarif): boolean {
  return s.statut === 'ouverte' && s.places_prises < s.places;
}

const TRANSITIONS: Record<StatutInscription, StatutInscription[]> = {
  reservee: ['payee', 'annulee'],
  payee: ['presente', 'absente', 'annulee'],
  annulee: [],
  presente: [],
  absente: [],
};

export function transitionAutorisee(de: StatutInscription, vers: StatutInscription): boolean {
  return TRANSITIONS[de].includes(vers);
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

Commande : `cd frontend && npx vitest run lib/formations/regles.test.ts`
Attendu : `Tests  11 passed (11)`.

- [ ] **Étape 5 : commit**

```bash
git add frontend/lib/formations/regles.ts frontend/lib/formations/regles.test.ts
git commit -m "feat(formations): règles pures — prix applicable, place disponible, transitions"
```

---

### Tâche 2 : migration des tables, de la vue et de la rétention

**Fichiers :**
- Créer : `supabase/migrations/0137_formations_live.sql`

- [ ] **Étape 1 : écrire la migration**

```sql
-- 0137 — Formations live payantes.
-- Spec : docs/superpowers/specs/2026-09-23-formations-live-design.md
--
-- RGPD : aucune donnée personnelle nouvelle — l'inscription pointe le compte
-- existant. Conservation : 3 ans après la séance (purge_rgpd_retention).

create table if not exists public.formation_sessions (
  id           uuid primary key default gen_random_uuid(),
  niveau       text not null check (niveau in ('debutant', 'intermediaire', 'avance')),
  titre        text not null check (char_length(titre) between 3 and 120),
  description  text check (char_length(description) <= 2000),
  debut_at     timestamptz not null,
  duree_min    int not null check (duree_min between 30 and 600),
  modalite     text not null check (modalite in ('presentiel', 'visio')),
  lieu         text,
  -- Jamais exposé publiquement : voir la vue ci-dessous.
  lien_visio   text,
  places       int not null check (places > 0),
  places_prises int not null default 0 check (places_prises >= 0),
  prix         numeric not null check (prix >= 0),
  prix_abonne  numeric check (prix_abonne is null or prix_abonne >= 0),
  statut       text not null default 'brouillon'
               check (statut in ('brouillon', 'ouverte', 'complete', 'annulee', 'terminee')),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- La surréservation devient impossible au niveau de la BASE : un comptage
  -- applicatif laisserait passer deux inscriptions simultanées sur la dernière place.
  constraint formation_sessions_places check (places_prises <= places)
);

create index if not exists formation_sessions_a_venir_idx
  on public.formation_sessions (debut_at)
  where statut in ('ouverte', 'complete');

create table if not exists public.formation_inscriptions (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.formation_sessions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  statut        text not null default 'reservee'
                check (statut in ('reservee', 'payee', 'annulee', 'presente', 'absente')),
  transaction_id uuid references public.billing_transactions(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint formation_inscriptions_unicite unique (session_id, user_id)
);

create index if not exists formation_inscriptions_session_idx on public.formation_inscriptions (session_id);
create index if not exists formation_inscriptions_user_idx on public.formation_inscriptions (user_id);

-- Distinguer une vente de formation d'un abonnement : sans cela, le bouton de
-- confirmation de /admin/payments activerait un Premium par effet de bord.
alter table public.billing_transactions
  add column if not exists objet text not null default 'abonnement';
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.billing_transactions'::regclass
                   and conname = 'billing_transactions_objet_check') then
    alter table public.billing_transactions
      add constraint billing_transactions_objet_check check (objet in ('abonnement', 'formation'));
  end if;
end $$;

-- Compteur de places tenu par la base, dans la même transaction que l'insertion.
create or replace function public.formation_places_maj()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.statut <> 'annulee' then
      update public.formation_sessions set places_prises = places_prises + 1, updated_at = now() where id = new.session_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.statut <> 'annulee' and new.statut = 'annulee' then
      update public.formation_sessions set places_prises = greatest(places_prises - 1, 0), updated_at = now() where id = new.session_id;
    elsif old.statut = 'annulee' and new.statut <> 'annulee' then
      update public.formation_sessions set places_prises = places_prises + 1, updated_at = now() where id = new.session_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.statut <> 'annulee' then
      update public.formation_sessions set places_prises = greatest(places_prises - 1, 0), updated_at = now() where id = old.session_id;
    end if;
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.formation_places_maj() from public, anon, authenticated;

drop trigger if exists formation_inscriptions_places on public.formation_inscriptions;
create trigger formation_inscriptions_places
  after insert or update or delete on public.formation_inscriptions
  for each row execute function public.formation_places_maj();

create or replace function public.formations_touch()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$ begin new.updated_at = now(); return new; end $$;
revoke execute on function public.formations_touch() from public, anon, authenticated;

drop trigger if exists formation_sessions_touch on public.formation_sessions;
create trigger formation_sessions_touch before update on public.formation_sessions
  for each row execute function public.formations_touch();
drop trigger if exists formation_inscriptions_touch on public.formation_inscriptions;
create trigger formation_inscriptions_touch before update on public.formation_inscriptions
  for each row execute function public.formations_touch();

-- RLS : les tables ne sont PAS lisibles publiquement.
alter table public.formation_sessions enable row level security;
alter table public.formation_inscriptions enable row level security;

drop policy if exists "formation_inscriptions_owner_read" on public.formation_inscriptions;
create policy "formation_inscriptions_owner_read"
  on public.formation_inscriptions for select
  to authenticated
  using (user_id = auth.uid());
-- Aucune policy insert/update/delete : seule la clé de service écrit. Sans
-- cela, un inscrit pourrait se déclarer « payee » et ouvrir le lien de visio.

-- Vue publique SANS lien_visio : une colonne de lien dans une table à lecture
-- publique, c'est une salle ouverte à tous.
drop view if exists public.formation_sessions_publiques;
create view public.formation_sessions_publiques
with (security_invoker = true) as
  select id, niveau, titre, description, debut_at, duree_min, modalite, lieu,
         places, places_prises, prix, prix_abonne, statut
    from public.formation_sessions
   where statut in ('ouverte', 'complete');

drop policy if exists "formation_sessions_public_read" on public.formation_sessions;
create policy "formation_sessions_public_read"
  on public.formation_sessions for select
  to anon, authenticated
  using (statut in ('ouverte', 'complete'));

revoke all on public.formation_sessions from anon, authenticated;
grant select (id, niveau, titre, description, debut_at, duree_min, modalite, lieu,
              places, places_prises, prix, prix_abonne, statut)
  on public.formation_sessions to anon, authenticated;
grant select on public.formation_sessions_publiques to anon, authenticated;

-- Rétention : 3 ans après la séance.
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
end;
$function$;
revoke execute on function public.purge_rgpd_retention() from public, anon, authenticated;
```

- [ ] **Étape 2 : appliquer la migration**

Commande : `cd .. && MSYS_NO_PATHCONV=1 npx --yes supabase@latest db query --linked --file supabase/migrations/0137_formations_live.sql`
Attendu : `"rows": []`, sans bloc `error`.

- [ ] **Étape 3 : vérifier la RLS à la clé anon — le lien de visio ne doit JAMAIS sortir**

```bash
# Depuis frontend/. Remplacer <URL> et <ANON> par les valeurs de .env.local.
curl -s -H "apikey: <ANON>" -H "User-Agent: westbourse-qa/1.0" \
  "<URL>/rest/v1/formation_sessions?select=lien_visio&limit=1"
# Attendu : une erreur de permission sur la colonne, PAS une valeur.
curl -s -H "apikey: <ANON>" -H "User-Agent: westbourse-qa/1.0" \
  "<URL>/rest/v1/formation_inscriptions?select=*"
# Attendu : [] (aucune ligne visible sans session).
curl -s -X POST -H "apikey: <ANON>" -H "Content-Type: application/json" -H "User-Agent: westbourse-qa/1.0" \
  -d '{"session_id":"00000000-0000-0000-0000-000000000000","user_id":"00000000-0000-0000-0000-000000000000"}' \
  "<URL>/rest/v1/formation_inscriptions"
# Attendu : 42501 (écriture refusée).
```

- [ ] **Étape 4 : lancer le scan de sécurité**

Utiliser l'outil `get_advisors` (type `security`) et vérifier qu'aucun nouvel avis ne concerne `formation_sessions`, `formation_inscriptions` ni `formation_sessions_publiques`.

- [ ] **Étape 5 : commit**

```bash
git add supabase/migrations/0137_formations_live.sql
git commit -m "feat(formations): tables, vue publique sans lien de visio, rétention 3 ans"
```

---

### Tâche 3 : lecture serveur des séances

> ⚠️ Le fichier  EXISTE DÉJÀ pour le catalogue des
> replays : ne pas l'écraser. Les séances vivent dans .

**Fichiers :**
- Créer : `frontend/lib/formations/sessions.ts`

- [ ] **Étape 1 : écrire le module**

```ts
// frontend/lib/formations/sessions.ts
import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import type { StatutSession } from './regles';

/**
 * Lecture des séances. La liste publique passe par la VUE, qui ne porte pas
 * `lien_visio` : impossible de le divulguer par inadvertance depuis une page.
 */

export interface SessionPublique {
  id: string;
  niveau: 'debutant' | 'intermediaire' | 'avance';
  titre: string;
  description: string | null;
  debut_at: string;
  duree_min: number;
  modalite: 'presentiel' | 'visio';
  lieu: string | null;
  places: number;
  places_prises: number;
  prix: number;
  prix_abonne: number | null;
  statut: StatutSession;
}

const COLONNES = 'id, niveau, titre, description, debut_at, duree_min, modalite, lieu, places, places_prises, prix, prix_abonne, statut';

export async function listerSessionsAVenir(): Promise<SessionPublique[]> {
  const sb = createPublicClient();
  const { data } = await sb
    .from('formation_sessions_publiques')
    .select(COLONNES)
    .gte('debut_at', new Date().toISOString())
    .order('debut_at', { ascending: true });
  return (data ?? []) as SessionPublique[];
}

export async function lireSessionPublique(id: string): Promise<SessionPublique | null> {
  const sb = createPublicClient();
  const { data } = await sb
    .from('formation_sessions_publiques')
    .select(COLONNES)
    .eq('id', id)
    .maybeSingle();
  return (data as SessionPublique | null) ?? null;
}
```

- [ ] **Étape 2 : vérifier les types**

Commande : `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '^.next-prod'`
Attendu : aucune ligne.

- [ ] **Étape 3 : commit**

```bash
git add frontend/lib/formations/sessions.ts
git commit -m "feat(formations): lecture des séances par la vue publique"
```

---

### Tâche 4 : réservation (action serveur)

**Fichiers :**
- Créer : `frontend/app/formations/sessions/actions.ts`

- [ ] **Étape 1 : écrire l'action**

```ts
// frontend/app/formations/sessions/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { prixApplicable, placeDisponible, type SessionTarif } from '@/lib/formations/regles';

export interface ResultatReservation {
  ok: boolean;
  message: string;
}

/**
 * Réserve une place. Exige un compte : c'est ce qui fait de la formation un
 * moteur d'acquisition plutôt qu'une liste de contacts.
 *
 * L'ordre compte : on crée la transaction AVANT l'inscription, pour qu'une
 * inscription ne puisse jamais exister sans trace d'encaissement attendu.
 * Si l'inscription échoue (séance pleine : la contrainte de base tranche), la
 * transaction est supprimée — sinon elle traînerait dans /admin/payments.
 */
export async function reserverPlace(sessionId: string): Promise<ResultatReservation> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, message: 'Connectez-vous pour réserver une place.' };

  const db = getServiceClient();
  const { data: session } = await db
    .from('formation_sessions')
    .select('id, titre, prix, prix_abonne, places, places_prises, statut')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return { ok: false, message: 'Séance introuvable.' };
  if (!placeDisponible(session as unknown as SessionTarif)) {
    return { ok: false, message: 'Cette séance est complète ou n’est plus ouverte.' };
  }

  const { data: profil } = await db.from('profiles').select('is_premium').eq('id', user.id).maybeSingle();
  const montant = prixApplicable(session as unknown as SessionTarif, Boolean(profil?.is_premium));
  if (montant == null) return { ok: false, message: 'Tarif indisponible pour cette séance.' };

  const { data: deja } = await db
    .from('formation_inscriptions')
    .select('id, statut')
    .eq('session_id', sessionId).eq('user_id', user.id).maybeSingle();
  if (deja && deja.statut !== 'annulee') return { ok: false, message: 'Vous êtes déjà inscrit à cette séance.' };

  const { data: txn, error: errTxn } = await db
    .from('billing_transactions')
    .insert({
      user_id: user.id, subscription_id: null, objet: 'formation',
      provider: 'manual', status: 'pending', amount: montant, currency: 'XOF',
    })
    .select('id').single();
  if (errTxn || !txn) return { ok: false, message: 'Réservation impossible pour le moment.' };

  const { error: errIns } = await db
    .from('formation_inscriptions')
    .insert({ session_id: sessionId, user_id: user.id, statut: 'reservee', transaction_id: txn.id });
  if (errIns) {
    await db.from('billing_transactions').delete().eq('id', txn.id);
    return { ok: false, message: 'Cette séance vient d’être complète.' };
  }

  revalidatePath('/formations/sessions');
  revalidatePath('/compte/formations');
  return { ok: true, message: 'Place réservée. Elle sera confirmée dès réception du paiement.' };
}
```

- [ ] **Étape 2 : vérifier les types**

Commande : `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '^.next-prod'`
Attendu : aucune ligne. Si `@/lib/billing/serviceClient` n'exporte pas `getServiceClient`, ouvrir `frontend/lib/billing/serviceClient.ts` et utiliser le nom réellement exporté.

- [ ] **Étape 3 : commit**

```bash
git add frontend/app/formations/sessions/actions.ts
git commit -m "feat(formations): réservation — compte requis, transaction avant inscription"
```

---

### Tâche 5 : page publique de liste

**Fichiers :**
- Créer : `frontend/app/formations/sessions/page.tsx`
- Modifier : `frontend/lib/supabase/middleware.ts` (liste `PUBLIC_PREFIXES`)

- [ ] **Étape 1 : écrire la page**

```tsx
// frontend/app/formations/sessions/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';
import PublicShell from '@/components/public/PublicShell';
import { SectionHeader, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import { listerSessionsAVenir } from '@/lib/formations/sessions';

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.westbourse.com';

export const metadata: Metadata = {
  title: 'Formations en direct — Bourse et BRVM',
  description:
    'Sessions de formation animées en direct sur la Bourse et la BRVM : dates, places limitées, tarifs. Places réservées depuis votre compte WESTBOURSE.',
  alternates: { canonical: SITE_URL + '/formations/sessions' },
};

const NIVEAUX: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
const fmtPrix = (v: number) => `${v.toLocaleString('fr-FR')} FCFA`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default async function SessionsPage() {
  const sessions = await listerSessionsAVenir();

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <SectionHeader
          kicker="Formations"
          title="Se former en direct, avec un formateur"
          subtitle="Des sessions à date fixe, en petit groupe. Le parcours Academy reste gratuit et sert de préparation."
        />
        {sessions.length === 0 ? (
          <EmptyStatePremium
            title="Aucune session programmée"
            hint="Les prochaines dates seront annoncées ici. En attendant, l’Academy est accessible librement."
            action={{ href: '/formations/academy', label: 'Ouvrir l’Academy' }}
          />
        ) : (
          <ul className="space-y-4">
            {sessions.map((s) => {
              const restantes = s.places - s.places_prises;
              return (
                <li key={s.id}>
                  <PremiumPanel className="space-y-2 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatPill tone="sapphire">{NIVEAUX[s.niveau] ?? s.niveau}</StatPill>
                      <StatPill tone="neutral">{s.modalite === 'visio' ? 'En ligne' : 'Présentiel'}</StatPill>
                      {restantes <= 3 && restantes > 0 && <StatPill tone="amber">{restantes} place{restantes > 1 ? 's' : ''} restante{restantes > 1 ? 's' : ''}</StatPill>}
                      {restantes <= 0 && <StatPill tone="neutral">Complet</StatPill>}
                    </div>
                    <h2 className="font-display text-lg text-ivory">{s.titre}</h2>
                    <p className="text-sm text-muted">{fmtDate(s.debut_at)} · {Math.round(s.duree_min / 60)} h{s.lieu ? ` · ${s.lieu}` : ''}</p>
                    <p className="tabular text-sm text-ivory">
                      {fmtPrix(Number(s.prix))}
                      {s.prix_abonne != null && <span className="text-muted"> · {fmtPrix(Number(s.prix_abonne))} pour les abonnés</span>}
                    </p>
                    <Link href={`/formations/sessions/${s.id}`} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-accent-ink hover:underline">
                      Voir la séance et réserver →
                    </Link>
                  </PremiumPanel>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PublicShell>
  );
}
```

- [ ] **Étape 2 : ouvrir la route au public**

Dans `frontend/lib/supabase/middleware.ts`, ajouter `'/formations'` aux `PUBLIC_PREFIXES` (la valeur exacte `'/formations'` figure déjà dans `PUBLIC_EXACT` ; le préfixe ouvre les sous-routes). Remplacer :

```ts
const PUBLIC_PREFIXES = [
  '/societes',   // fiches sociétés (SEO)
```

par :

```ts
const PUBLIC_PREFIXES = [
  '/formations', // hub, Academy publique et sessions en direct (SEO)
  '/societes',   // fiches sociétés (SEO)
```

- [ ] **Étape 3 : vérifier que l'Academy reste protégée**

L'Academy est gardée **dans la page** par `canAccess('formations')` (voir `app/formations/academy/examen/[niveau]/page.tsx`), pas par le middleware. Vérifier après le déploiement de preview :

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "x-vercel-protection-bypass: <SECRET>" "<PREVIEW>/formations/sessions"
# Attendu : 200
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "x-vercel-protection-bypass: <SECRET>" "<PREVIEW>/formations/academy/examen/debutant"
# Attendu : 307 vers /login, OU 200 avec une page qui n'affiche PAS de questions.
```

Si la seconde commande expose des questions d'examen, retirer `'/formations'` des préfixes publics et n'ouvrir que `'/formations/sessions'`.

- [ ] **Étape 4 : commit**

```bash
git add frontend/app/formations/sessions/page.tsx frontend/lib/supabase/middleware.ts
git commit -m "feat(formations): liste publique des sessions à venir"
```

---

### Tâche 6 : page de détail et réservation

**Fichiers :**
- Créer : `frontend/app/formations/sessions/[id]/page.tsx`
- Créer : `frontend/app/formations/sessions/[id]/BoutonReserver.tsx`

- [ ] **Étape 1 : écrire le bouton (composant client)**

```tsx
// frontend/app/formations/sessions/[id]/BoutonReserver.tsx
'use client';
import { useState, useTransition } from 'react';
import { reserverPlace } from '../actions';

export default function BoutonReserver({ sessionId, libelle }: { sessionId: string; libelle: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending || ok}
        onClick={() => start(async () => {
          const r = await reserverPlace(sessionId);
          setMessage(r.message);
          setOk(r.ok);
        })}
        className="inline-flex min-h-[48px] items-center rounded-lg bg-accent px-5 text-sm font-semibold text-obsidian transition active:scale-95 disabled:opacity-50"
      >
        {pending ? 'Réservation…' : libelle}
      </button>
      {message && (
        <p role="status" className={`text-sm ${ok ? 'text-up' : 'text-down'}`}>{message}</p>
      )}
    </div>
  );
}
```

- [ ] **Étape 2 : écrire la page de détail**

```tsx
// frontend/app/formations/sessions/[id]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PublicShell from '@/components/public/PublicShell';
import { SectionHeader, PremiumPanel, StatPill } from '@/components/ui/premium';
import { createClient } from '@/lib/supabase/server';
import { lireSessionPublique } from '@/lib/formations/sessions';
import { placeDisponible, type SessionTarif } from '@/lib/formations/regles';
import BoutonReserver from './BoutonReserver';

// La disponibilité et l'état de connexion changent à chaque visite : pas de cache.
export const dynamic = 'force-dynamic';

const NIVEAUX: Record<string, string> = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };
const fmtPrix = (v: number) => `${v.toLocaleString('fr-FR')} FCFA`;

export default async function SessionPage({ params }: { params: { id: string } }) {
  const s = await lireSessionPublique(params.id);
  if (!s) notFound();

  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  const restantes = s.places - s.places_prises;
  const ouverte = placeDisponible(s as unknown as SessionTarif);

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <SectionHeader
          kicker={NIVEAUX[s.niveau] ?? s.niveau}
          title={s.titre}
          subtitle={new Date(s.debut_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        />

        <PremiumPanel className="space-y-3 p-5">
          <div className="flex flex-wrap gap-2">
            <StatPill tone="neutral">{s.modalite === 'visio' ? 'En ligne' : 'Présentiel'}</StatPill>
            <StatPill tone="neutral">{Math.round(s.duree_min / 60)} h</StatPill>
            <StatPill tone={restantes > 0 ? 'emerald' : 'neutral'}>
              {restantes > 0 ? `${restantes} place${restantes > 1 ? 's' : ''} sur ${s.places}` : 'Complet'}
            </StatPill>
          </div>
          {s.description && <p className="whitespace-pre-line text-sm text-muted">{s.description}</p>}
          {s.lieu && <p className="text-sm text-muted">{s.modalite === 'visio' ? 'Lien transmis après confirmation du paiement.' : s.lieu}</p>}
          <p className="tabular text-lg text-ivory">
            {fmtPrix(Number(s.prix))}
            {s.prix_abonne != null && <span className="text-sm text-muted"> · {fmtPrix(Number(s.prix_abonne))} pour les abonnés</span>}
          </p>
        </PremiumPanel>

        <PremiumPanel className="space-y-3 p-5">
          {!ouverte ? (
            <p className="text-sm text-muted">Cette séance n’accepte plus d’inscription.</p>
          ) : user ? (
            <BoutonReserver sessionId={s.id} libelle="Réserver ma place" />
          ) : (
            <>
              <p className="text-sm text-muted">La réservation se fait depuis votre compte. Il est gratuit et sans carte bancaire.</p>
              <Link
                href={`/signup?next=${encodeURIComponent(`/formations/sessions/${s.id}`)}`}
                className="inline-flex min-h-[48px] items-center rounded-lg bg-accent px-5 text-sm font-semibold text-obsidian"
              >
                Créer mon compte et réserver
              </Link>
            </>
          )}
          <p className="text-xs text-faint">
            La place est confirmée à réception du paiement (Wave, Orange Money ou virement). Une session enseigne une
            méthode ; elle ne constitue pas un conseil en investissement.
          </p>
        </PremiumPanel>
      </div>
    </PublicShell>
  );
}
```

- [ ] **Étape 3 : vérifier les types**

Commande : `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '^.next-prod'`
Attendu : aucune ligne. Si `StatPill` n'accepte pas le ton `amber`, remplacer par `'neutral'` (voir `components/ui/premium.tsx`).

- [ ] **Étape 4 : commit**

```bash
git add frontend/app/formations/sessions/\[id\]
git commit -m "feat(formations): page de séance et réservation"
```

---

### Tâche 7 : mes inscriptions, avec le lien de visio

**Fichiers :**
- Créer : `frontend/app/compte/formations/page.tsx`

- [ ] **Étape 1 : écrire la page**

```tsx
// frontend/app/compte/formations/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader, PremiumPanel, EmptyStatePremium, StatPill } from '@/components/ui/premium';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mes formations' };

const LIBELLE: Record<string, string> = {
  reservee: 'Réservée — en attente de paiement',
  payee: 'Confirmée',
  annulee: 'Annulée',
  presente: 'Suivie',
  absente: 'Absent',
};

export default async function MesFormationsPage() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login?next=%2Fcompte%2Fformations');

  // Clé de service : le lien de visio n'est PAS lisible par la clé anon, et il
  // n'est servi qu'aux inscriptions payées de CET utilisateur.
  const db = getServiceClient();
  const { data } = await db
    .from('formation_inscriptions')
    .select('id, statut, session:formation_sessions(id, titre, debut_at, modalite, lieu, lien_visio)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  type Ligne = { id: string; statut: string; session: { id: string; titre: string; debut_at: string; modalite: string; lieu: string | null; lien_visio: string | null } | null };
  const lignes = (data ?? []) as unknown as Ligne[];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <SectionHeader kicker="Mon compte" title="Mes formations" subtitle="Vos inscriptions aux sessions en direct." />
      {lignes.length === 0 ? (
        <EmptyStatePremium
          title="Aucune inscription"
          hint="Les prochaines sessions sont annoncées sur la page des formations."
          action={{ href: '/formations/sessions', label: 'Voir les sessions' }}
        />
      ) : (
        <ul className="space-y-3">
          {lignes.map((l) => (
            <li key={l.id}>
              <PremiumPanel className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatPill tone={l.statut === 'payee' ? 'emerald' : 'neutral'}>{LIBELLE[l.statut] ?? l.statut}</StatPill>
                </div>
                <h2 className="font-display text-base text-ivory">{l.session?.titre ?? 'Séance supprimée'}</h2>
                {l.session && (
                  <p className="text-sm text-muted">
                    {new Date(l.session.debut_at).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {l.session.modalite === 'presentiel' && l.session.lieu ? ` · ${l.session.lieu}` : ''}
                  </p>
                )}
                {l.statut === 'payee' && l.session?.modalite === 'visio' && l.session.lien_visio && (
                  <a href={l.session.lien_visio} target="_blank" rel="noopener" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-accent-ink hover:underline">
                    Rejoindre la session →
                  </a>
                )}
                {l.statut === 'reservee' && (
                  <p className="text-xs text-faint">Votre place sera confirmée dès réception du paiement.</p>
                )}
              </PremiumPanel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Étape 2 : vérifier les types**

Commande : `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '^.next-prod'`
Attendu : aucune ligne.

- [ ] **Étape 3 : commit**

```bash
git add frontend/app/compte/formations/page.tsx
git commit -m "feat(formations): mes inscriptions, lien de visio réservé aux places payées"
```

---

### Tâche 8 : confirmation du paiement, distincte des abonnements

**Fichiers :**
- Créer : `frontend/lib/formations/confirmer.ts`
- Modifier : `frontend/app/admin/payments/` (l'action de confirmation existante)

- [ ] **Étape 1 : écrire la confirmation**

```ts
// frontend/lib/formations/confirmer.ts
import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { transitionAutorisee, type StatutInscription } from './regles';

/**
 * Confirme l'encaissement d'une place de formation.
 *
 * Volontairement SÉPARÉ de `activateSubscription` : confirmer une formation ne
 * doit jamais activer un abonnement Premium par effet de bord. C'est la raison
 * d'être de la colonne `billing_transactions.objet`.
 */
export async function confirmerPlaceFormation(transactionId: string): Promise<{ ok: boolean; message: string }> {
  const db = getServiceClient();

  const { data: txn } = await db
    .from('billing_transactions')
    .select('id, objet, status')
    .eq('id', transactionId)
    .maybeSingle();
  if (!txn) return { ok: false, message: 'Transaction introuvable.' };
  if (txn.objet !== 'formation') return { ok: false, message: 'Cette transaction n’est pas une formation.' };

  const { data: inscription } = await db
    .from('formation_inscriptions')
    .select('id, statut')
    .eq('transaction_id', transactionId)
    .maybeSingle();
  if (!inscription) return { ok: false, message: 'Aucune inscription liée à cette transaction.' };
  if (!transitionAutorisee(inscription.statut as StatutInscription, 'payee')) {
    return { ok: false, message: `Une inscription « ${inscription.statut} » ne peut pas passer à « payée ».` };
  }

  const { error: e1 } = await db
    .from('billing_transactions')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', transactionId);
  if (e1) return { ok: false, message: 'Mise à jour de la transaction refusée.' };

  const { error: e2 } = await db
    .from('formation_inscriptions')
    .update({ statut: 'payee' })
    .eq('id', inscription.id);
  if (e2) return { ok: false, message: 'Mise à jour de l’inscription refusée.' };

  return { ok: true, message: 'Place confirmée.' };
}
```

- [ ] **Étape 2 : router la confirmation selon l'objet**

Ouvrir le fichier d'actions de `frontend/app/admin/payments/` (repérer la fonction appelée par le bouton « Confirmer », qui invoque `activateSubscription`). Au début de cette fonction, après le contrôle de permission, insérer :

```ts
  // Une transaction de formation ne passe PAS par l'activation d'abonnement.
  const { data: t } = await db.from('billing_transactions').select('objet').eq('id', transactionId).maybeSingle();
  if (t?.objet === 'formation') {
    const r = await confirmerPlaceFormation(transactionId);
    if (r.ok) revalidatePath('/admin/payments');
    return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.message };
  }
```

et ajouter l'import `import { confirmerPlaceFormation } from '@/lib/formations/confirmer';`. Adapter la forme de la valeur de retour à celle qu'utilisent déjà les autres actions du fichier.

- [ ] **Étape 3 : vérifier les types**

Commande : `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '^.next-prod'`
Attendu : aucune ligne.

- [ ] **Étape 4 : commit**

```bash
git add frontend/lib/formations/confirmer.ts frontend/app/admin/payments
git commit -m "feat(formations): confirmation d'une place, sans activer d'abonnement"
```

---

### Tâche 9 : console d'administration des séances

**Fichiers :**
- Créer : `frontend/app/admin/formations/page.tsx`
- Créer : `frontend/app/admin/formations/actions.ts`
- Créer : `frontend/app/admin/formations/SessionForm.tsx`
- Modifier : `frontend/lib/admin-nav.ts`

- [ ] **Étape 1 : écrire les actions**

```ts
// frontend/app/admin/formations/actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/server/rbac';
import { recordAudit } from '@/lib/server/audit';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { transitionAutorisee, type StatutInscription } from '@/lib/formations/regles';

export interface Resultat { ok: boolean; message: string }

export async function creerSession(formData: FormData): Promise<Resultat> {
  const ctx = await requirePermission('content.write');
  const db = getServiceClient();

  const titre = String(formData.get('titre') ?? '').trim();
  const niveau = String(formData.get('niveau') ?? 'debutant');
  const debut = String(formData.get('debut_at') ?? '');
  const duree = Number(formData.get('duree_min') ?? 240);
  const modalite = String(formData.get('modalite') ?? 'visio');
  const places = Number(formData.get('places') ?? 20);
  const prix = Number(formData.get('prix') ?? 0);
  const prixAbonneBrut = String(formData.get('prix_abonne') ?? '').trim();

  if (titre.length < 3) return { ok: false, message: 'Titre : 3 caractères au minimum.' };
  if (!debut || Number.isNaN(Date.parse(debut))) return { ok: false, message: 'Date de début invalide.' };
  if (!Number.isFinite(places) || places <= 0) return { ok: false, message: 'Nombre de places invalide.' };
  if (!Number.isFinite(prix) || prix < 0) return { ok: false, message: 'Prix invalide.' };

  const { data, error } = await db.from('formation_sessions').insert({
    titre, niveau, debut_at: new Date(debut).toISOString(), duree_min: duree, modalite,
    lieu: String(formData.get('lieu') ?? '').trim() || null,
    lien_visio: String(formData.get('lien_visio') ?? '').trim() || null,
    description: String(formData.get('description') ?? '').trim() || null,
    places, prix,
    prix_abonne: prixAbonneBrut === '' ? null : Number(prixAbonneBrut),
    statut: 'brouillon',
    created_by: ctx.userId,
  }).select('id').single();
  if (error || !data) return { ok: false, message: `Création refusée : ${error?.message ?? 'inconnue'}` };

  await recordAudit(ctx, { action: 'formation.session_create', resourceType: 'formation_sessions', resourceId: data.id, severity: 'info' });
  revalidatePath('/admin/formations');
  revalidatePath('/formations/sessions');
  return { ok: true, message: 'Séance créée en brouillon.' };
}

export async function changerStatutSession(id: string, statut: string): Promise<Resultat> {
  const ctx = await requirePermission('content.write');
  if (!['brouillon', 'ouverte', 'complete', 'annulee', 'terminee'].includes(statut)) {
    return { ok: false, message: 'Statut inconnu.' };
  }
  const db = getServiceClient();
  const { error } = await db.from('formation_sessions').update({ statut }).eq('id', id);
  if (error) return { ok: false, message: 'Mise à jour refusée.' };

  // Annuler une séance annule les inscriptions : le trigger remet les places.
  if (statut === 'annulee') {
    await db.from('formation_inscriptions').update({ statut: 'annulee' }).eq('session_id', id).in('statut', ['reservee', 'payee']);
  }
  await recordAudit(ctx, { action: 'formation.session_statut', resourceType: 'formation_sessions', resourceId: id, severity: statut === 'annulee' ? 'warn' : 'info' });
  revalidatePath('/admin/formations');
  revalidatePath('/formations/sessions');
  return { ok: true, message: 'Statut mis à jour.' };
}

export async function marquerPresence(inscriptionId: string, statut: 'presente' | 'absente'): Promise<Resultat> {
  const ctx = await requirePermission('content.write');
  const db = getServiceClient();
  const { data: ins } = await db.from('formation_inscriptions').select('id, statut').eq('id', inscriptionId).maybeSingle();
  if (!ins) return { ok: false, message: 'Inscription introuvable.' };
  if (!transitionAutorisee(ins.statut as StatutInscription, statut)) {
    return { ok: false, message: `Une inscription « ${ins.statut} » ne peut pas passer à « ${statut} ».` };
  }
  const { error } = await db.from('formation_inscriptions').update({ statut }).eq('id', inscriptionId);
  if (error) return { ok: false, message: 'Mise à jour refusée.' };
  await recordAudit(ctx, { action: 'formation.presence', resourceType: 'formation_inscriptions', resourceId: inscriptionId, severity: 'info' });
  revalidatePath('/admin/formations');
  return { ok: true, message: 'Présence enregistrée.' };
}
```

- [ ] **Étape 2 : écrire le formulaire (composant client)**

```tsx
// frontend/app/admin/formations/SessionForm.tsx
'use client';
import { useState, useTransition } from 'react';
import { creerSession } from './actions';

const INPUT = 'mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ivory';

export default function SessionForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) => start(async () => { const r = await creerSession(fd); setMessage(r.message); setOk(r.ok); })}
      className="grid grid-cols-1 gap-3 rounded-panel border border-border bg-surface p-5 md:grid-cols-2"
    >
      <label className="text-xs text-muted md:col-span-2">Titre *
        <input name="titre" required maxLength={120} className={INPUT} placeholder="Initiation à la Bourse et à la BRVM" />
      </label>
      <label className="text-xs text-muted">Niveau
        <select name="niveau" className={INPUT} defaultValue="debutant">
          <option value="debutant">Débutant</option>
          <option value="intermediaire">Intermédiaire</option>
          <option value="avance">Avancé</option>
        </select>
      </label>
      <label className="text-xs text-muted">Modalité
        <select name="modalite" className={INPUT} defaultValue="visio">
          <option value="visio">En ligne</option>
          <option value="presentiel">Présentiel</option>
        </select>
      </label>
      <label className="text-xs text-muted">Début *
        <input name="debut_at" type="datetime-local" required className={INPUT} />
      </label>
      <label className="text-xs text-muted">Durée (minutes)
        <input name="duree_min" type="number" min={30} max={600} defaultValue={240} className={INPUT} />
      </label>
      <label className="text-xs text-muted">Places
        <input name="places" type="number" min={1} defaultValue={20} className={INPUT} />
      </label>
      <label className="text-xs text-muted">Lieu
        <input name="lieu" className={INPUT} placeholder="Abidjan, Plateau — ou « En ligne »" />
      </label>
      <label className="text-xs text-muted md:col-span-2">Lien de visioconférence (jamais public)
        <input name="lien_visio" type="url" className={INPUT} placeholder="https://…" />
      </label>
      <label className="text-xs text-muted">Prix (FCFA) *
        <input name="prix" type="number" min={0} required className={INPUT} />
      </label>
      <label className="text-xs text-muted">Prix abonné (vide = pas de remise)
        <input name="prix_abonne" type="number" min={0} className={INPUT} />
      </label>
      <label className="text-xs text-muted md:col-span-2">Description
        <textarea name="description" rows={4} maxLength={2000} className={INPUT} />
      </label>
      <div className="md:col-span-2">
        <button type="submit" disabled={pending} className="min-h-[44px] rounded-lg bg-accent px-5 text-sm font-semibold text-obsidian disabled:opacity-50">
          {pending ? 'Création…' : 'Créer la séance'}
        </button>
        {message && <p role="status" className={`mt-2 text-sm ${ok ? 'text-up' : 'text-down'}`}>{message}</p>}
      </div>
    </form>
  );
}
```

- [ ] **Étape 3 : écrire la page d'administration**

```tsx
// frontend/app/admin/formations/page.tsx
import { requirePermission } from '@/lib/server/rbac';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { SectionHeader, PremiumPanel, MetricCard, EmptyStatePremium, StatPill } from '@/components/ui/premium';
import SessionForm from './SessionForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Formations — administration' };

export default async function AdminFormationsPage() {
  await requirePermission('content.read');
  const db = getServiceClient();

  const { data: sessions } = await db
    .from('formation_sessions')
    .select('id, titre, niveau, debut_at, modalite, places, places_prises, prix, statut')
    .order('debut_at', { ascending: false });

  const { data: inscriptions } = await db
    .from('formation_inscriptions')
    .select('id, statut, session_id, user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const lignes = (sessions ?? []) as { id: string; titre: string; niveau: string; debut_at: string; modalite: string; places: number; places_prises: number; prix: number; statut: string }[];
  const ins = (inscriptions ?? []) as { id: string; statut: string; session_id: string }[];
  const payees = ins.filter((i) => i.statut === 'payee').length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <SectionHeader kicker="Administration" title="Formations en direct" subtitle="Séances, places et inscriptions." />
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Séances" value={String(lignes.length)} accent="sapphire" />
        <MetricCard label="Inscriptions" value={String(ins.length)} accent="neutral" />
        <MetricCard label="Places payées" value={String(payees)} accent="emerald" />
      </div>

      <SessionForm />

      {lignes.length === 0 ? (
        <EmptyStatePremium title="Aucune séance" hint="Créez une séance ci-dessus : elle démarre en brouillon." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Séance</th>
                <th scope="col" className="px-4 py-3 font-medium">Début</th>
                <th scope="col" className="px-4 py-3 font-medium">Places</th>
                <th scope="col" className="px-4 py-3 font-medium">Prix</th>
                <th scope="col" className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-ivory">{s.titre}</th>
                  <td className="px-4 py-2.5 tabular text-xs text-muted">{new Date(s.debut_at).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-2.5 tabular">{s.places_prises} / {s.places}</td>
                  <td className="px-4 py-2.5 tabular">{Number(s.prix).toLocaleString('fr-FR')} FCFA</td>
                  <td className="px-4 py-2.5"><StatPill tone={s.statut === 'ouverte' ? 'emerald' : 'neutral'}>{s.statut}</StatPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </div>
  );
}
```

- [ ] **Étape 4 : ajouter l'entrée de navigation**

Dans `frontend/lib/admin-nav.ts`, ajouter à la liste existante (copier la forme exacte des entrées voisines, par exemple celle de `/admin/landing`) :

```ts
  { href: '/admin/formations', label: 'Formations' },
```

- [ ] **Étape 5 : vérifier les types**

Commande : `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '^.next-prod'`
Attendu : aucune ligne.

- [ ] **Étape 6 : commit**

```bash
git add frontend/app/admin/formations frontend/lib/admin-nav.ts
git commit -m "feat(formations): console d'administration des séances"
```

---

### Tâche 10 : export RGPD

**Fichiers :**
- Modifier : `frontend/app/api/account/export/route.ts`

- [ ] **Étape 1 : ajouter la table à l'export**

Dans le tableau de requêtes parallèles (repérer la ligne `supabase.from('dossier_envois').select('*').eq('user_id', user.id),`), ajouter juste après :

```ts
    supabase.from('formation_inscriptions').select('*').eq('user_id', user.id),
```

Ajouter la variable correspondante dans la déstructuration du `Promise.all` (suivre la forme exacte des voisines, par exemple `formationInscriptions`), puis dans l'objet retourné, après `dossier_envois: dossierEnvois.data ?? [],` :

```ts
    formation_inscriptions: formationInscriptions.data ?? [],
```

- [ ] **Étape 2 : vérifier les types**

Commande : `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '^.next-prod'`
Attendu : aucune ligne.

- [ ] **Étape 3 : commit**

```bash
git add frontend/app/api/account/export/route.ts
git commit -m "feat(formations): inscriptions incluses dans l'export RGPD"
```

---

### Tâche 11 : entrée sur le hub des formations

**Fichiers :**
- Modifier : `frontend/app/formations/page.tsx`

- [ ] **Étape 1 : ajouter le bloc**

Dans `frontend/app/formations/page.tsx`, au-dessus du lien vers `/formations/academy` (repérer `<Link href="/formations/academy"`), insérer un bloc de la même forme que les blocs voisins, pointant vers `/formations/sessions` :

```tsx
      <Link
        href="/formations/sessions"
        className="group block rounded-panel border border-border bg-surface p-6 transition hover:border-accent/40"
      >
        <div className="flex flex-wrap gap-2">
          <StatPill tone="sapphire">En direct</StatPill>
          <StatPill tone="neutral">Places limitées</StatPill>
        </div>
        <h2 className="mt-2 font-display text-xl text-ivory transition-colors group-hover:text-accent">
          Sessions animées par un formateur
        </h2>
        <p className="mt-1 max-w-xl text-sm text-muted leading-relaxed">
          Quatre heures en petit groupe, en ligne ou en présentiel, sur des cas réels de la BRVM.
          L’Academy reste gratuite et sert de préparation.
        </p>
      </Link>
```

- [ ] **Étape 2 : vérifier les types**

Commande : `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '^.next-prod'`
Attendu : aucune ligne.

- [ ] **Étape 3 : commit et pousser**

```bash
git add frontend/app/formations/page.tsx
git commit -m "feat(formations): entrée « sessions en direct » sur le hub"
git push origin landing-bis
```

---

### Tâche 12 : recette de bout en bout sur la preview

**Fichiers :** aucun (vérification).

- [ ] **Étape 1 : attendre la construction de la preview**

```bash
cd frontend
until s=$(gh api repos/ebouak/brvm-analyst-pro/commits/$(git rev-parse --short HEAD)/status --jq '.statuses[] | select(.context=="Vercel") | .state'); \
  [ "$s" = "success" ] || [ "$s" = "failure" ] || [ "$s" = "error" ]; do sleep 20; done; echo "Vercel: $s"
```
Attendu : `Vercel: success`.

- [ ] **Étape 2 : créer une séance de test depuis `/admin/formations`**

Titre « Séance de recette », niveau débutant, en ligne, début dans 7 jours, 2 places, prix 1000, lien de visio `https://example.invalid/recette`. Passer son statut à `ouverte`.

- [ ] **Étape 3 : vérifier que le lien de visio ne fuit pas**

```bash
curl -s -H "apikey: <ANON>" -H "User-Agent: westbourse-qa/1.0" \
  "<URL>/rest/v1/formation_sessions_publiques?select=*&limit=1" | grep -c lien_visio
```
Attendu : `0`.

- [ ] **Étape 4 : réserver, confirmer, vérifier**

1. Depuis un compte non premium, ouvrir `/formations/sessions`, puis la séance, puis réserver. Attendu : « Place réservée ».
2. Vérifier dans `/admin/payments` qu'une transaction `pending` de 1000 FCFA est apparue avec `objet = formation`.
3. La confirmer. Attendu : « Place confirmée ».
4. Vérifier que le compte n'est **pas** devenu premium :

```bash
cd .. && MSYS_NO_PATHCONV=1 npx --yes supabase@latest db query --linked \
  "select 'premium=' || is_premium::text as l from profiles where id = '<UUID_DU_COMPTE_DE_TEST>';"
```
Attendu : `premium=false`.
5. Ouvrir `/compte/formations` : la séance est « Confirmée » et le lien « Rejoindre la session » apparaît.

- [ ] **Étape 5 : vérifier que la surréservation est impossible**

Réserver avec deux autres comptes. Le troisième doit être refusé par « Cette séance est complète ou n’est plus ouverte. », et `places_prises` doit valoir exactement 2.

- [ ] **Étape 6 : nettoyer la séance de recette**

```bash
cd .. && MSYS_NO_PATHCONV=1 npx --yes supabase@latest db query --linked \
  "delete from public.billing_transactions where id in (select transaction_id from public.formation_inscriptions i join public.formation_sessions s on s.id = i.session_id where s.titre = 'Séance de recette' and i.transaction_id is not null); delete from public.formation_sessions where titre = 'Séance de recette';"
```

---

## Hors de ce plan, volontairement

Rappels J-2 et J-0, liste d'attente, attestation de participation en PDF, paiement en ligne (CinetPay), sessions intra-entreprise, replay vidéo. Voir §8 de la spec.
