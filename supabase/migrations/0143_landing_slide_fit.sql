-- 0143 — Cadrage des visuels de diapositive.
--
-- POURQUOI. Les deux emplacements ont des formes très différentes : le bandeau
-- fait 1600×300 (16:3, très large) et le carrousel du hero 900×672 (~4:3).
-- Le rendu appliquait `object-fit: cover` sans le dire : une affiche large
-- posée dans le carrousel perdait ses bords, et le titre de l'annonceur pouvait
-- se retrouver coupé — constaté en production sur une annonce BGFI, dont le
-- début du titre « ...pel Public à l'Épargne » était rogné.
--
-- `cover` reste le défaut : c'est le comportement actuel, et le changer
-- rétroactivement déformerait les annonces en cours de diffusion.
-- `contain` affiche l'image ENTIÈRE, avec des bandes de part et d'autre —
-- moins spectaculaire, mais rien n'est amputé. Le choix appartient à
-- l'exploitant, qui voit désormais les deux rendus avant d'enregistrer.

alter table public.landing_slides
  add column if not exists image_fit text not null default 'cover'
    check (image_fit in ('cover', 'contain'));

comment on column public.landing_slides.image_fit is
  'Cadrage du visuel : cover = remplit le cadre en rognant ; contain = image entière, bandes autour. Défaut cover (comportement historique).';
