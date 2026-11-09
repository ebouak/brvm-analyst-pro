-- 0196 : pays de six sociétés cotées (format ISO 3166-1 alpha-2, comme SNTS='SN', SGBC='CI').
-- Règle : pays vérifié sur une source officielle, jamais déduit du ticker ou du nom seul.
-- `AND pays IS NULL` : ne réécrit jamais une valeur déjà curée. Vérifié le 2026-11-07.

-- ORGT (Oragroup SA) : la fiche BRVM classe l'émetteur sous Togo (siège de l'émetteur, pas du groupe).
-- https://www.brvm.org/fr/emetteurs/societes-cotees/oragroup-sa
update brvm_instruments set pays = 'TG' where code = 'ORGT' and pays is null;

-- ECOC (ECOBANK CI) : fiche BRVM, Côte d'Ivoire. Ne pas confondre avec ETIT (Ecobank Transnational, Togo).
-- https://www.brvm.org/fr/emetteurs/societes-cotees/ecobank-ci
update brvm_instruments set pays = 'CI' where code = 'ECOC' and pays is null;

-- NSBC (NSIA Banque CI) : fiche BRVM, Côte d'Ivoire.
-- https://www.brvm.org/fr/emetteurs/societes-cotees/nsia-banque-ci
update brvm_instruments set pays = 'CI' where code = 'NSBC' and pays is null;

-- CBIBF (CORIS Bank International) : fiche BRVM, Burkina Faso.
-- https://www.brvm.org/fr/emetteurs/societes-cotees/coris-bank-international
update brvm_instruments set pays = 'BF' where code = 'CBIBF' and pays is null;

-- BICB (BIIC) : communiqué BRVM d'admission, « troisième société béninoise à se faire coter à la BRVM ».
-- https://www.brvm.org/fr/mediacentre/actualites/la-banque-internationale-pour-lindustrie-et-le-commerce-du-benin-biic-admise
update brvm_instruments set pays = 'BJ' where code = 'BICB' and pays is null;

-- BBGC (Bridge Bank Group Côte d'Ivoire) : AUCUNE LIGNE. Pas de fiche BRVM publiée au 2026-11-07
-- (absente des listes), et la presse ne donne que Abidjan comme lieu d'annonce, pas le siège.
-- Le pays reste NULL (« — ») tant qu'une fiche BRVM ou un document de l'émetteur ne le confirme pas.
