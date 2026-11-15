-- 0242 — Academy : retrait de la publication du cours « Dangote et la BRVM :
-- chronologie d'une introduction en bourse (2026) » (2026-11-15).
--
-- Décision de l'exploitant. Relu en 0241, ce cours est une chronologie datée au
-- 15/11/2026 : l'allocation (17/11) puis la cotation au Nigerian Exchange
-- (attendue début décembre) la rendront fausse si personne ne la tient à jour.
-- Le cours débutant « L'introduction en bourse de Dangote : un cas pratique,
-- hors BRVM » reste publié.
--
-- Rien n'est supprimé : le contenu relu reste en base et dans le dépôt
-- (frontend/lib/academy/contenus/autres/suivi-dangote-brvm-ipo.json) ; repasser
-- `published` à true suffit à le republier. Aucune progression d'élève sur ce
-- cours au 2026-11-15. La page renvoie 404 une fois dépubliée (getCard ne lit
-- que les cours publiés). Idempotent.

update public.academy_courses
   set published = false,
       updated_at = now()
 where slug = 'suivi-dangote-brvm-ipo'
   and published;

-- Vérification : attendu published = false.
-- select slug, published from public.academy_courses where slug = 'suivi-dangote-brvm-ipo';
