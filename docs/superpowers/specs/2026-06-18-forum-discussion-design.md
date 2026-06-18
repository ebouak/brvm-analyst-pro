# Forum de discussion BRVM — Design

> Statut : validé en brainstorming le 2026-06-18. Prêt pour le plan d'implémentation.

## 1. Objectif

Ajouter un **forum de discussion communautaire** à WESTBOURSE : lecture publique,
publication réservée aux comptes connectés. Les utilisateurs créent des **sujets**
(libres) qu'ils peuvent rattacher optionnellement à **une action, une obligation
ou un événement de marché**. La fiche d'un instrument affiche les sujets qui lui
sont liés.

Module **100 % additif** : aucune table ni route existante n'est modifiée de façon
destructive. Respecte les conventions du dépôt (Supabase RLS, flag `hidden` de la
migration `0044_content_moderation`, console admin, RGPD by design §12 de CLAUDE.md).

## 2. Décisions (issues du brainstorming)

| Sujet | Décision |
|---|---|
| Accès | Lecture **publique** (SEO/découverte) ; publication = **compte connecté** |
| Modération | **Post-modération** : publication immédiate + **signalement** → masquage admin (`hidden`) |
| Structure | **Sujets libres** + rattachement **optionnel** à 1 instrument **xor** 1 événement (sinon « général ») |
| Identité | **Pseudonyme** (`profiles.display_name`) ; jamais le nom réel ni l'email |
| Suppression compte | **Anonymisation** : `author_id → null`, affichage « Utilisateur supprimé », contenu conservé |
| Périmètre v1 | **MVP épuré** : sujets + réponses (fil plat) + signalement + édition/suppression perso + lecture paginée. Pas de votes/notifs/imbrication |

## 3. Modèle de données — migration `0047_forum.sql` (additive)

### 3.1 `profiles.display_name`
```sql
alter table public.profiles add column if not exists display_name text;
```
Pseudonyme choisi par l'utilisateur (réglable dans `/parametres/compte`). Repli
d'affichage si null : **« Membre »** (jamais l'email ni le nom réel). Minimisation RGPD.

### 3.2 `forum_topics`
```sql
create table public.forum_topics (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid references auth.users(id) on delete set null,
  title            text not null,
  body             text not null,
  instrument_code  text references public.brvm_instruments(code) on update cascade,
  event_id         uuid references public.market_events(id) on delete set null,
  hidden           boolean not null default false,
  created_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  -- au plus un rattachement : instrument XOR événement (ou aucun = général)
  constraint forum_topic_single_link check (instrument_code is null or event_id is null)
);
create index idx_forum_topics_instrument on public.forum_topics (instrument_code) where instrument_code is not null;
create index idx_forum_topics_event on public.forum_topics (event_id) where event_id is not null;
create index idx_forum_topics_activity on public.forum_topics (last_activity_at desc) where hidden = false;
```

### 3.3 `forum_posts`
```sql
create table public.forum_posts (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references public.forum_topics(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  body       text not null,
  hidden     boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);
create index idx_forum_posts_topic on public.forum_posts (topic_id, created_at) where hidden = false;
```

### 3.4 `forum_reports`
```sql
create table public.forum_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('topic','post')),
  target_id   uuid not null,
  reason      text,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index idx_forum_reports_open on public.forum_reports (created_at desc) where resolved = false;
```

## 4. RLS

```sql
alter table public.forum_topics  enable row level security;
alter table public.forum_posts   enable row level security;
alter table public.forum_reports enable row level security;

-- Lecture publique (convention 0044 : hidden = false)
create policy "forum_topics_public_read" on public.forum_topics for select using (hidden = false);
create policy "forum_posts_public_read"  on public.forum_posts  for select using (hidden = false);

-- Insert : connecté, auteur = soi
create policy "forum_topics_insert" on public.forum_topics for insert
  with check (auth.uid() = author_id);
create policy "forum_posts_insert" on public.forum_posts for insert
  with check (auth.uid() = author_id);

-- Update/Delete : auteur seulement (le masquage admin passe par service_role / route serveur)
create policy "forum_topics_owner_modify" on public.forum_topics for update using (auth.uid() = author_id);
create policy "forum_topics_owner_delete" on public.forum_topics for delete using (auth.uid() = author_id);
create policy "forum_posts_owner_modify"  on public.forum_posts  for update using (auth.uid() = author_id);
create policy "forum_posts_owner_delete"  on public.forum_posts  for delete using (auth.uid() = author_id);

-- Signalements : insert connecté, lecture admin uniquement (via service_role côté serveur)
create policy "forum_reports_insert" on public.forum_reports for insert with check (auth.uid() = reporter_id);
```

Le **masquage admin** (`hidden = true`) et la **lecture des signalements** se font
côté serveur avec la clé `service_role` (jamais exposée au client), via la console
admin protégée par `requirePermission('content.write')`.

## 5. Pages & API (App Router)

### Pages publiques / connectées
- **`/forum`** — liste paginée des sujets (`last_activity_at desc`), filtre par
  catégorie (général / instrument / événement) et recherche ; bouton « Nouveau
  sujet » visible si connecté.
- **`/forum/[id]`** — sujet + réponses (fil plat, paginé), zone de réponse
  (connecté), boutons « Signaler », « Modifier »/« Supprimer » sur ses propres
  messages.
- **`/forum/nouveau`** — formulaire de création (titre, corps, rattachement
  optionnel via sélecteur instrument/événement). Connecté requis.

### Intégration fiche instrument
- Section **« Discussions »** sur la fiche action/obligation : liste des sujets liés
  (`instrument_code = code`) + CTA « Démarrer une discussion ».

### Admin
- **`/admin/forum`** — file des signalements ouverts (`forum_reports` non résolus),
  actions **Masquer / Démasquer** (topic ou post) et **Marquer résolu**. Protégé
  `requirePermission('content.write')`. Journalisé dans `admin_audit_logs`.

### Route handlers / server actions
- Création sujet / réponse, édition, suppression : server actions (auth via
  `createClient`), validation par `lib/forum/validation.ts`.
- Signalement : insert `forum_reports`.
- Masquage admin : route serveur `service_role` + audit log.
- À chaque réponse : mise à jour `forum_topics.last_activity_at`.

## 6. UI

Kit premium existant (`@/components/ui/premium`), thème DeFi cyan, prose française.
Composants : `ForumTopicList`, `ForumTopicCard`, `ForumThread` (sujet + réponses),
`ForumReplyForm`, `ForumNewTopicForm`, `ReportButton`, `ForumModerationQueue` (admin).
États vides honnêtes (« Aucune discussion pour le moment — lancez la première »).
Entrée de navigation « Forum » dans `lib/nav.ts`, groupe **Découverte** (à côté de Sociétés/Brief).

## 7. RGPD (by design — §12)

- **Donnée collectée** : pseudonyme, contenu des messages, horodatage, auteur.
  Finalité : discussion communautaire. Base légale : intérêt légitime + action
  volontaire de l'utilisateur.
- **Export** (`GET /api/account/export`) : ajouter les `forum_topics` et
  `forum_posts` de l'utilisateur.
- **Suppression** (`DELETE /api/account/delete`) : `update forum_topics/forum_posts
  set author_id = null where author_id = <user>` (anonymisation ; contenu conservé,
  affichage « Utilisateur supprimé »). Les `forum_reports.reporter_id` passent aussi
  à null.
- **Rétention** : contenu conservé jusqu'à suppression par l'auteur ou masquage
  admin. Documenter dans `docs/RGPD.md` (nouvelle entrée d'inventaire).
- **Modération** : signalement utilisateur + masquage admin (responsabilité éditeur).
- **Sécurité** : `service_role` server-only ; aucun traceur tiers ; pas de secret en log.
- **Information** : mention du forum et de ses traitements dans la politique de
  confidentialité.

## 8. Logique pure & tests (vitest)

`lib/forum/validation.ts` (fonctions pures, testées) :
- `validateTopicInput({ title, body })` : longueurs (titre 5–140, corps 10–10 000),
  trim, rejet vide.
- `validatePostInput({ body })` : longueur (2–10 000).
- `resolveTopicLink({ instrumentCode, eventId })` : garantit le **xor** (au plus un
  rattachement) ; retourne la catégorie dérivée (`'instrument' | 'evenement' | 'general'`).
- `displayName(profile)` : pseudonyme ou repli « Membre » (jamais email/nom réel).

Cas limites testés : titre trop court/long, double rattachement rejeté, body vide,
profil sans `display_name`.

## 9. Hors périmètre v1 (YAGNI)

Votes/réactions, notifications (email/in-app), réponses imbriquées, mentions,
pièces jointes, recherche plein-texte avancée, réputation/badges. À reconsidérer en v2.

## 10. Risques & limites

- **Spam/abus** : publication connectée + signalement + masquage admin + **anti-flood
  léger v1** : délai minimal serveur entre deux publications d'un même utilisateur
  (≥ 20 s) et plafond (≤ 5 sujets / heure). Vérifié côté serveur via la date du
  dernier `forum_posts`/`forum_topics` de l'auteur ; message clair si dépassé.
  Fonction pure `lib/forum/rateLimit.ts` testée.
- **Responsabilité éditoriale** : la post-modération implique un délai de réaction ;
  acceptable pour une petite communauté.
- **`display_name` non renseigné** : repli « Membre » ; proposer de le définir à la
  première publication.
