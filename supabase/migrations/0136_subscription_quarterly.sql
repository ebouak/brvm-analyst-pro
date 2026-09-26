-- 0136 — Palier trimestriel et nouvelle grille tarifaire Premium.
--
-- Pourquoi : le concurrent de référence (sikafinance) n'a AUCUN mensuel — son
-- entrée engage 3 mois. Notre mensuel restait seul face à l'annuel, et le
-- rapport mensuel/annuel décourageait l'engagement. Décision du responsable
-- du projet, 2026-09-22 : 10 000 F/mois, 25 000 F/trimestre, 90 000 F/an.
--
-- L'échelle reste monotone, ce qui est la seule contrainte non négociable :
--   mensuel 10 000/mois  >  trimestriel 8 333/mois  >  annuel 7 500/mois.
-- Un annuel plus cher au mois que le trimestriel ferait fuir l'engagement long.
--
-- RGPD : aucune donnée personnelle. Les transactions déjà encaissées gardent
-- leur montant historique (`billing_transactions.amount`), on ne réécrit pas
-- le passé.

alter table public.subscription_plans
  add column if not exists price_quarterly numeric;

comment on column public.subscription_plans.price_quarterly is
  'Prix pour 3 mois. NULL = le plan n''offre pas de palier trimestriel.';

update public.subscription_plans
   set price_monthly = 10000, price_quarterly = 25000, price_yearly = 90000
 where code = 'premium';

-- Le plan gratuit n'a pas de palier trimestriel : rester à NULL plutôt qu'à 0,
-- qui se lirait comme « une offre à zéro franc » dans l'interface.
update public.subscription_plans set price_quarterly = null where code = 'free';
