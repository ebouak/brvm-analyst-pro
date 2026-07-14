-- 0104 — Valorisation (DCF) en premium.
--
-- Le bloc « Valorisation » de la fiche action suit le flag `dcf`. Or celui-ci
-- valait 'free' : la section serait restée ouverte alors que TOUT l'analytique de
-- la fiche passe en premium. Un verrou incohérent ne verrouille rien.
--
-- `paper_trading` reste GRATUIT : c'est un produit d'appel, il ne coûte rien en
-- calcul et il fait entrer des utilisateurs.
--
-- Réversible en un clic depuis /admin/features.

update public.feature_flags
   set acces      = 'premium',
       updated_at = now()
 where code = 'dcf'
   and acces = 'free';   -- garde-fou : si un admin l'a déjà réglé autrement, on n'y touche pas

-- Contrôle
select code, label, acces from public.feature_flags order by acces, code;
