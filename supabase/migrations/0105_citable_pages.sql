-- 0105 — Pages « citables » (GEO/AEO) : data-auto ET éditoriales, la même table.
--
-- OBJECTIF : être CITÉ par les moteurs génératifs (Perplexity, ChatGPT). Ils
-- privilégient la donnée fraîche, sourcée, reproductible, structurée autour d'une
-- QUESTION précise avec réponse en tête. On sert deux formes avec une seule table :
--
--   kind = 'data'      → un TABLEAU généré en direct depuis nos données
--                        (data_source) + un calque éditable (intro, commentaire,
--                        image) posé par-dessus. Toujours frais, jamais périmé.
--   kind = 'editorial' → une page écrite à la main (méthodo, glossaire, guide),
--                        entièrement dans la table.
--
-- Dans les DEUX cas : auteur + date de mise à jour + sources = les signaux de
-- confiance que les moteurs valorisent. Et des ZONES IMAGE (hero + inline).

create table if not exists public.citable_pages (
  slug           text primary key,               -- ex. 'rendement-dividende'
  kind           text not null default 'editorial'
                   check (kind in ('data', 'editorial')),
  -- Pour kind='data' : quelle table auto rendre. Null pour l'éditorial.
  data_source    text check (data_source in ('dividend_yield', 'sgi_cout', 'budget')),

  -- Structure GEO : une question, une réponse courte EN TÊTE.
  title          text not null,                  -- <title> + H1
  question       text not null,                  -- la question à laquelle on répond
  short_answer   text not null,                  -- réponse en 2-4 phrases (le + cité)

  -- Contenu éditable (markdown léger). Le calque des pages data OU le corps éditorial.
  intro_md       text,                           -- avant le tableau
  commentary_md  text,                           -- après le tableau
  methodology_md text,                           -- méthode de calcul reproductible
  sources        jsonb not null default '[]',    -- [{label, url}] — sources PRIMAIRES
  faq            jsonb not null default '[]',     -- [{q, a}] — FAQ réellement utile

  -- Zones image (URL ; upload admin ou /public). Alt pour l'accessibilité + SEO.
  hero_image_url text,
  hero_image_alt text,

  -- Confiance éditoriale.
  author         text not null default 'La rédaction WESTBOURSE',
  author_role    text,                           -- ex. « Analyse de marché BRVM »

  published      boolean not null default false,
  published_at   timestamptz,
  updated_at     timestamptz not null default now()
);

comment on table public.citable_pages is
  'Pages optimisées pour la citation par moteurs génératifs (GEO/AEO). data = tableau live + calque éditable ; editorial = page écrite. Rendu public sur /analyses/[slug].';

-- Donnée PUBLIQUE et non personnelle : lecture ouverte AUX SEULES pages publiées,
-- écriture réservée au service_role (admin server-side). Pas de policy d'écriture
-- => personne d'autre n'écrit.
alter table public.citable_pages enable row level security;

drop policy if exists citable_pages_read on public.citable_pages;
create policy citable_pages_read
  on public.citable_pages
  for select
  using (published = true);

create index if not exists idx_citable_pages_published
  on public.citable_pages (published, updated_at desc);
