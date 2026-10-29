-- Envoi d'un article PUBLIÉ aux abonnés confirmés de la newsletter.
--
-- Une ligne par article, au plus : la clé primaire sert de verrou. L'action
-- d'envoi INSÈRE d'abord la ligne (statut `en_cours`) ; un second clic, un
-- double onglet ou une relance réseau tombent sur la contrainte d'unicité et
-- n'envoient rien. Seul un échec TOTAL (`echec`, aucun email parti) peut être
-- relancé.
--
-- Pourquoi pas la colonne `articles.diffuse` : le scraper ne diffuse sur
-- WhatsApp/Telegram que les articles dont `diffuse` est NULL, puis la RÉÉCRIT
-- entière. Y ranger l'envoi email aurait privé l'article de diffusion sociale,
-- et la diffusion sociale aurait effacé la trace de l'email (donc permis un
-- second envoi aux mêmes abonnés).
--
-- RGPD : aucune adresse ici, seulement des comptes. Qui a lancé l'envoi est
-- dans `admin_audit_logs`. Lecture et écriture : service_role uniquement.

create table if not exists public.article_campagnes (
  article_id    uuid primary key references public.articles (id) on delete cascade,
  statut        text not null default 'en_cours'
                  check (statut in ('en_cours', 'envoye', 'partiel', 'echec')),
  destinataires integer,
  envoyes       integer,
  erreur        text,
  lance_le      timestamptz not null default now(),
  termine_le    timestamptz
);

alter table public.article_campagnes enable row level security;
-- Aucune policy : ni anon ni authenticated ne lisent ni n'écrivent.
revoke all on public.article_campagnes from anon, authenticated;
