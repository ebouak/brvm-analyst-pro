-- 0255 — Publication de l'article « résultats CBIBF 2025 » (Coris Bank International BF).
--
-- Brouillon `a_valider` produit par le scraper le 2026-11-17 (slug resultats-cbibf-2025).
-- Relu le 2026-11-21 contre le PDF officiel BRVM « Etats financiers - Exercice 2025 -
-- CORIS BANK INTERNATIONAL BF » (communiqué du 2026-07-07) : les onze montants concordent
-- (compte de résultat p. 46 : PNB 138 986, RBE 88 412, coût du risque 16 454, résultat net
-- 65 495 contre 47 937 ; bilan p. 1-2 : total 2 997 779, crédits 1 326 977, dépôts
-- 2 015 284, capitaux propres 330 548 ; créances en souffrance p. 16 : 125 725, en M FCFA).
--
-- Deux corrections de texte avant publication :
--   * chapô : « publie ses comptes l'exercice » -> « publie ses comptes de l'exercice » ;
--   * corps : le document est le bilan SOCIAL de l'établissement, pas un bilan consolidé.
--
-- Même geste que PATCH /api/admin/articles/[id] (statut, publie_le, updated_at).
-- Idempotent : ne touche la ligne que tant qu'elle est encore `a_valider`.
-- Retour arrière : update articles set statut = 'a_valider', publie_le = null
--                  where id = '8903594b-2c7c-476f-beec-9da83e5c06dc';

update public.articles
set chapo      = replace(chapo, 'publie ses comptes l’exercice', 'publie ses comptes de l’exercice'),
    corps_md   = replace(corps_md, 'L''ensemble des actifs et passifs consolidés au bilan ressort', 'Le total du bilan de l''établissement ressort'),
    statut     = 'publie',
    publie_le  = now(),
    updated_at = now()
where id = '8903594b-2c7c-476f-beec-9da83e5c06dc'
  and slug = 'resultats-cbibf-2025'
  and statut = 'a_valider';
