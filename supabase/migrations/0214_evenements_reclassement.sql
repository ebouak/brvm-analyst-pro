-- 0214 — Reclassement des événements et retrait des rattachements périmés.
--
-- 1. Nouveaux types d'événement (scraper/src/events/classify.ts) : `notation`,
--    `liquidite`, `gouvernance`, et les « PMT DVD » en `dividende`. Les règles
--    sont appliquées dans le MÊME ORDRE que le classifieur : une notation ou un
--    bilan de contrat de liquidité n'est jamais un « résultat ».
--    Comptes au 12/11/2026 : 313 notations, 213 contrats de liquidité,
--    71 changements de direction, 1 paiement de dividende.
--
-- 2. Rattachements d'émetteur périmés. Le worker ne faisait qu'AJOUTER des lignes
--    au pivot : quand une publication était réattribuée (« BIIC BN » rattachée à
--    BICC puis corrigée en BICB), l'événement passait à BICB mais le lien BICC
--    restait. Six liens au 12/11/2026. Le worker synchronise désormais le pivot
--    (repository.ts) ; cette migration nettoie l'existant. Seuls les liens
--    `emetteur` contredits par `market_events.instrument_code` sont retirés.
--
-- Données de marché publiques, aucune donnée personnelle.

update public.market_events
   set event_type = 'notation'
 where event_type <> 'notation'
   and title ~* 'notation';

update public.market_events
   set event_type = 'liquidite'
 where event_type not in ('notation', 'liquidite')
   and title ~* 'contrat de liquidit';

update public.market_events
   set event_type = 'dividende'
 where event_type not in ('notation', 'liquidite', 'dividende')
   and title ~* '\mdvd\M';

update public.market_events
   set event_type = 'gouvernance'
 where event_type not in ('notation', 'liquidite', 'dividende', 'gouvernance')
   and title ~* '(changement important dans la direction|\mnomination\M|d[ée]mission|changement de (directeur|dirigeant|pr[ée]sident))';

delete from public.market_event_instruments p
 using public.market_events e
 where e.id = p.event_id
   and p.relation_type = 'emetteur'
   and e.instrument_code is not null
   and p.instrument_code <> e.instrument_code;
