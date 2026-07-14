-- 0102 — Réparation COMPLÈTE de `cours_precedent` (0101 ne traitait qu'un symptôme).
--
-- ── POURQUOI 0101 NE SUFFISAIT PAS ──
-- Elle ne corrigeait que les lignes où `cours_precedent == cours_jour`. Or il
-- existe des lignes simplement FAUSSES sans être égales : UNLC le 2026-07-07
-- portait cours_precedent = 53 750 alors que la clôture de la veille était 50 000
-- (et que la variation, +7,47 %, confirme bien 50 000). Traquer un symptôme laisse
-- passer les autres formes du même mal.
--
-- ── LA RÈGLE, plutôt que le symptôme ──
-- `cours_precedent` doit satisfaire l'identité qui le définit :
--     cours_jour / cours_precedent − 1 = variation_pct
-- Toute ligne qui la viole est fausse, quelle que soit sa forme.
--
-- ── LE PIÈGE : les jours de détachement de dividende ──
-- Ce jour-là, le cours de référence est LÉGITIMEMENT abaissé du montant du
-- dividende : la veille n'est PAS la clôture précédente, et c'est normal. Forcer
-- `cours_precedent = clôture précédente` casserait ces séances et rendrait la
-- variation incohérente à son tour.
--
-- D'où la règle en deux temps :
--   1. si la clôture précédente est COHÉRENTE avec la variation → on la prend
--      (c'est la valeur exacte, au franc près) ;
--   2. sinon → on DÉRIVE de la variation (cas du détachement, ou clôture
--      précédente absente). La dérivée porte l'arrondi de la source (~0,1 FCFA),
--      ce qui est sans commune mesure avec l'erreur corrigée (des milliers).
--
-- On ne touche QUE les lignes qui violent l'identité. Une veille égale au cours
-- avec une variation nulle est parfaitement normale sur la BRVM (la plupart des
-- titres ne bougent pas) et reste intacte.

with base as (
  select
    id,
    cours_jour,
    cours_precedent,
    variation_pct,
    lag(cours_jour) over (partition by code order by date_marche) as cloture_precedente
  from public.brvm_actions_daily
),
calc as (
  select
    id,
    cours_jour,
    cours_precedent,
    variation_pct,
    cloture_precedente,
    -- Référence implicite dans la variation publiée.
    (cours_jour / (1 + variation_pct / 100.0))                        as derivee,
    -- Tolérance : 0,5 % du cours, ou 1 FCFA au minimum (la source arrondit).
    greatest(1.0, cours_jour * 0.005)                                 as tol
  from base
  where cours_jour is not null
    and cours_jour > 0
    and variation_pct is not null
    and variation_pct > -100          -- -100 % : division par zéro
)
update public.brvm_actions_daily d
   set cours_precedent = case
         -- 1. La clôture précédente colle à la variation → c'est la valeur exacte.
         when c.cloture_precedente is not null
          and c.cloture_precedente > 0
          and abs(c.cloture_precedente - c.derivee) <= c.tol
           then c.cloture_precedente
         -- 2. Sinon (détachement de dividende, ou pas d'historique) → on dérive.
         else round(c.derivee::numeric, 2)
       end,
       updated_at = now()
  from calc c
 where d.id = c.id
   -- Uniquement les lignes qui VIOLENT l'identité de définition.
   and (
        c.cours_precedent is null
     or c.cours_precedent <= 0
     or abs(c.cours_precedent - c.derivee) > c.tol
   );

-- ── Contrôle ────────────────────────────────────────────────────────────────
-- Doit renvoyer 0 : plus aucune ligne où cours_jour / cours_precedent − 1
-- contredit la variation publiée.
select count(*) as lignes_incoherentes
  from public.brvm_actions_daily
 where cours_jour is not null and cours_jour > 0
   and cours_precedent is not null and cours_precedent > 0
   and variation_pct is not null and variation_pct > -100
   and abs(cours_precedent - (cours_jour / (1 + variation_pct / 100.0)))
       > greatest(1.0, cours_jour * 0.005);
