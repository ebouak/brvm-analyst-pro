-- BBGC — Bridge Bank Group Côte d'Ivoire
--
-- 48e société admise à la cote de la BRVM, première cotation le 24/09/2026 sur
-- le compartiment principal, au terme d'une OPV de 10 000 000 d'actions à
-- 6 750 FCFA souscrite à 142 %.
--
-- POURQUOI CETTE MIGRATION, alors que le scraper sait désormais s'auto-réparer.
-- `ensureActionInstruments` (voir persistence/repository.ts) crée l'instrument
-- manquant avec la SEULE désignation publiée par brvm.org : c'est tout ce que
-- la page des cours prouve. Le secteur, le pays et la famille comptable n'y
-- figurent pas — ce sont des valeurs CURÉES, et les faire deviner au scraper
-- produirait un « secteur Inconnu » affiché comme un fait.
--
-- Insensible à l'ordre : que la ligne ait déjà été créée par le scraper ou pas,
-- elle finit identique. Idempotente : rejouable sans effet de bord.
--
-- Le secteur retenu est « Services financiers », libellé de la classification
-- ICB utilisée en vigueur (refdata/runSecteurs.ts et lib/brvmSectors.json), et
-- non le « Finances » du seed historique 0019 que runSecteurs écrase chaque jour.

insert into public.brvm_instruments (code, designation, type, secteur, pays, actif)
values (
  'BBGC',
  'Bridge Bank Group Côte d''Ivoire',
  'action',
  'Services financiers',
  'Côte d''Ivoire',
  true
)
on conflict (code) do update set
  designation = excluded.designation,
  type        = excluded.type,
  secteur     = excluded.secteur,
  pays        = excluded.pays,
  actif       = true,
  updated_at  = now();

-- Banque commerciale : les états financiers suivent le référentiel BCEAO
-- (PNB, dépôts, crédits, coefficient d'exploitation…), pas le SYSCOHADA.
update public.brvm_instruments
   set famille_comptable = 'banque'
 where code = 'BBGC';
