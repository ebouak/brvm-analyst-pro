-- 0101 — Réparation de `cours_precedent` (corrompu depuis juin 2026).
--
-- ── LE BUG ──
-- brvm.org fait ROULER sa colonne « Cours veille » vers le cours du jour après la
-- clôture. Le cron intraday tourne toutes les 15 min et chaque passage ÉCRASE le
-- précédent : la dernière capture de la journée attrapait la valeur déjà roulée.
-- Résultat : `cours_precedent == cours_jour` sur 27 titres / 47.
--
-- Visible à l'écran : « Clôture préc. 53 735 » + variation absolue « 0 FCFA » +
-- badge « +6,41 % ». Trois chiffres qui se contredisent sous les yeux du client.
--
-- Le scraper est corrigé (resoudreVeille + 7 tests). Reste à réparer l'existant.
--
-- ── LA RÉPARATION ──
-- On ne DÉRIVE pas la veille depuis la variation (ce serait une approximation, la
-- source arrondissant à 2 décimales). On prend la VRAIE clôture de la séance
-- précédente, qu'on possède déjà dans notre propre table. C'est exact.
--
-- Prudence : on ne touche QUE les lignes manifestement fausses — celles où
-- cours_precedent == cours_jour ALORS QUE la variation n'est pas nulle. Une veille
-- égale au cours avec une variation nulle est parfaitement normale sur la BRVM
-- (la plupart des titres ne bougent pas), et ne doit surtout pas être « corrigée ».

with veille_reelle as (
  select
    id,
    code,
    date_marche,
    lag(cours_jour) over (partition by code order by date_marche) as cloture_precedente
  from public.brvm_actions_daily
)
update public.brvm_actions_daily d
   set cours_precedent = v.cloture_precedente,
       updated_at      = now()
  from veille_reelle v
 where d.id = v.id
   and v.cloture_precedente is not null
   and v.cloture_precedente > 0
   -- Symptôme du bug : veille == cours du jour MALGRÉ une variation non nulle.
   and d.cours_jour is not null
   and d.cours_precedent is not null
   and abs(d.cours_precedent - d.cours_jour) < 0.01
   and d.variation_pct is not null
   and abs(d.variation_pct) > 0.01;

-- ── Contrôle ────────────────────────────────────────────────────────────────
-- Doit renvoyer 0 : plus aucune ligne où la veille égale le cours alors que la
-- variation dit le contraire.
select count(*) as lignes_encore_incoherentes
  from public.brvm_actions_daily
 where cours_jour is not null
   and cours_precedent is not null
   and abs(cours_precedent - cours_jour) < 0.01
   and variation_pct is not null
   and abs(variation_pct) > 0.01;
