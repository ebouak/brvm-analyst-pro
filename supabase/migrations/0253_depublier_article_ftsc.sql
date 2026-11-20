-- 0253 — Dépublier l'article « séance FTSC » du 2026-11-19 (décision de l'exploitant, 2026-11-20).
--
-- Le dividende cité est EXACT (1 726,56 FCFA net, exercice 2024, payé le 30/09/2025 ;
-- Bulletin officiel du 09/10/2026, Sika Finance, avis d'AG FTSC du 23/05/2025 :
-- distribution exceptionnelle, dividende + part de prime de fusion). Mais l'article
-- le divisait par le cours du jour 14 mois plus tard (« 108,59 % au cours du jour »),
-- ce qui présente un rendement trompeur. Même effet que le bouton « Dépublier » de
-- /admin/articles (statut 'rejete'). Ciblé par id ET par statut : sans effet si
-- l'article a déjà été dépublié ou modifié entre-temps.
update public.articles
   set statut = 'rejete',
       raison_blocage = 'Dépublié le 2026-11-20 : rendement trompeur (dividende exceptionnel de l''exercice 2024, versé il y a 14 mois, rapporté au cours du jour).'
 where id = '8a7d83b1-9906-4a4e-8571-9d561f644506'
   and slug = 'seance-ftsc-2026-11-19'
   and statut = 'publie';
