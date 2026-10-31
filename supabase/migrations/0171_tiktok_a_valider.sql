-- TikTok : chaque publication passe par un ÉCRAN DE VALIDATION.
--
-- Les règles de TikTok pour la publication directe auditée (Content Sharing
-- Guidelines) exigent, à chaque envoi : le nom du compte affiché, une
-- visibilité CHOISIE à la main (aucune par défaut), les réglages
-- commentaires/duo/collage décochés, la déclaration commerciale, un aperçu et
-- un clic de consentement. Un cron qui publie seul ne passe pas l'audit.
--
-- Les workers ne publient donc plus sur TikTok : ils déposent une ligne
-- `a_valider` avec le contenu préparé (`contenu`), et l'exploitant publie
-- depuis /admin/reseaux/tiktok. La clé primaire reste le verrou : une ligne par
-- (cible, cible_id, reseau), jamais deux publications du même contenu.

alter table public.publications_sociales drop constraint if exists publications_sociales_statut_check;
alter table public.publications_sociales
  add constraint publications_sociales_statut_check
  check (statut in ('a_valider', 'en_cours', 'publie', 'echec', 'ignore'));

-- { type: 'video'|'photo', titre, description, media: [url…], lien, duree_s }
alter table public.publications_sociales add column if not exists contenu jsonb;
