-- 0099 — Assainissement de la table `dividends`.
--
-- ── CE QUI ÉTAIT CASSÉ ──
-- 1. 90 lignes de PUR BRUIT : `montant` == `exercice`. L'ancien parser lisait
--    « Dividende au titre de l'exercice 2012 » avec la regex
--    /dividende[^\d]*([\d ,.]+)/ et retenait **2012 comme montant**. Il n'avait en
--    réalité rien à lire : les événements BDFIN ne sont que des TITRES de PDF
--    (« Paiement de dividendes - CFAO MOTORS CI »), les montants sont dans les PDF.
--    Ces lignes annonçaient un dividende de 2 012 FCFA pour l'exercice 2012.
--
-- 2. 29 couples (code, exercice) en DOUBLON CONTRADICTOIRE. BOAM 2025 portait
--    QUATRE valeurs (305,04 / 450 / 397 / 305), ETIT 2025 quatre aussi. Aucun
--    moyen d'arbitrer : on ne garde pas un chiffre au hasard.
--
-- ── CE QU'ON FAIT ──
-- Purge du bruit, déduplication, puis contrainte d'unicité pour que la table ne
-- puisse PLUS accueillir deux montants pour le même exercice. La commande
-- `dividends:history` la réalimente ensuite depuis les fiches sociétés
-- Sikafinance : une source unique, une valeur par exercice, 5 ans d'historique.

-- ── 1. Purge du bruit ───────────────────────────────────────────────────────
delete from public.dividends
 where exercice is not null
   and abs(montant - exercice) < 0.01;

-- ── 2. Déduplication ────────────────────────────────────────────────────────
-- On garde UNE ligne par (code, exercice). Priorité à celle qui porte une
-- `ex_date` (elle alimente le calendrier des dividendes et ne doit pas
-- disparaître), puis à la plus récente. Le montant, lui, sera de toute façon
-- réécrit par la source de référence — l'important ici est de ne garder qu'une
-- ligne pour que la contrainte d'unicité puisse être posée.
delete from public.dividends
 where id in (
   select id from (
     select id,
            row_number() over (
              partition by code, exercice
              order by (ex_date is not null) desc, created_at desc
            ) as rn
       from public.dividends
      where exercice is not null
   ) t
   where t.rn > 1
 );

-- ── 3. Verrou : plus jamais deux montants pour un même exercice ─────────────
-- Index PARTIEL : `exercice is null` reste toléré (dividendes annoncés dont
-- l'exercice n'est pas encore identifié — ils vivent dans le calendrier).
create unique index if not exists dividends_code_exercice_uniq
  on public.dividends (code, exercice)
  where exercice is not null;

-- ── Contrôle ────────────────────────────────────────────────────────────────
-- Doit renvoyer 0 ligne :
--   select code, exercice, count(*) from public.dividends
--    where exercice is not null group by 1,2 having count(*) > 1;
-- Doit renvoyer 0 ligne (plus aucun montant == exercice) :
--   select * from public.dividends where exercice is not null and abs(montant - exercice) < 0.01;
