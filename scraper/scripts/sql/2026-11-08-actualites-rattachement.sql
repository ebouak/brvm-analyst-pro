-- 2026-11-08 : rattachements erronés à STAC (SETAO CI) dans brvm_news.
-- Cause : flux Google News « SITAS transport aérien » (config veille, mauvaise
-- société) dont tous les résultats étaient étiquetés STAC sans vérification, et
-- mot-clé nu « STAC » en sous-chaîne (« obstacle »). Voir veille/brvm_pipeline.py.
--
-- NE SUPPRIME AUCUN ARTICLE : retire seulement le code STAC de ticker_codes.
-- instrument_code est déjà NULL sur ces lignes. NON EXÉCUTÉ : à relire d'abord.
--
-- 27 lignes, toutes sans mention de SETAO ni de STAC (titre ni résumé) :
--   5fbdf1eb-84f4-42bc-a892-c51445f98d93  2026-06-27  Au Mali, la souveraineté commence à l’école
--   3bc5952f-ce1c-448a-8f2f-aad701606868  2017-10-20  Les compagnies aériennes africaines à Abidjan pour débattre de la modernisation de leur flotte - new
--   b4bd44fb-0acd-41d7-a439-0dfbfdd67ac2  2022-01-25  Pascal Tigahiré: « Pourquoi Colombes Airlines revient » - L'economiste du faso
--   3b9904c0-1d1e-4e28-859c-a0c217391a1d  2017-06-28  Aéroport d’Abidjan: la construction de "11 nouveaux parkings" avions prévue d’ici à 2019 - news.abid
--   8cc263bc-b18c-404d-9da1-48a2e1c64f15  2010-03-11  Transport aérien : Asky ouvre son capital aux investisseurs nationaux - leFaso.net - L'actualité au 
--   b4ef0419-8df7-4bfe-bad1-4735880bcd46  2017-10-08  Côte d’Ivoire : le regain dans le transport aérien dope les résultats semestriels de Servair - AGENC
--   62bfeec8-32fa-4821-86af-c4c4d1caf80b  2017-07-20  Achat de l’A 320 pour Air Côte d’Ivoire: Ce que cela va changer dans le transport aérien - Abidjan.n
--   9931c7ef-2d2c-4e9d-8ee7-f849c0b4fcd4  2010-03-11  Transport aérien : Asky ouvre son capital aux investisseurs nationaux - lefaso.net
--   706b94a0-b1ea-42a3-8420-7be2a14b2f8a  2022-01-25  Pascal Tigahiré: « Pourquoi Colombes Airlines revient » - leconomistedufaso.com
--   895b8444-d8eb-430b-8c3c-15d7ceb20045  2018-05-29  Le Groupe Deloitte promet de contribuer à la sécurité des marchés financiers - Abidjan.net News
--   919a2b05-deae-400b-98f8-2b9080483347  2017-06-28  Aéroport d’Abidjan: la construction de "11 nouveaux parkings" avions prévue d’ici à 2019 - Abidjan.n
--   24ae7325-2aad-4604-b959-9fd3a017c9c1  2026-01-09  Secteur financier : L’École de la Bourse marque ses 10 ans et affiche une croissance de son audience
--   ff8dabe8-9743-45db-95b9-5d8b51ccec25  2017-07-20  Achat de l’A 320 pour Air Côte d’Ivoire: Ce que cela va changer dans le transport aérien - news.abid
--   78e2b894-3e5b-403f-a43e-b4142a2d9e46  2015-12-09  Transport aérien: Communiqué de presse d’AERIA - news.abidjan.net
--   fa0e66d5-26ce-479a-a57f-a3b1e09c4261  2021-09-25  Transport aérien : Air France baisse ses prix à destination de l’Europe et de l’Amérique jusqu’au 12
--   78a9a0c3-377b-4974-867a-3b07fcce4997  2017-01-31  L’aéroport Félix Houphouët-Boigny d’Abidjan a accueilli près de 2 millions de passagers en 2016 - ne
--   3f672764-21ae-46e4-8950-4d0013838ffa  2017-01-31  L’aéroport Félix Houphouët-Boigny d’Abidjan a accueilli près de 2 millions de passagers en 2016 - Ab
--   279da00b-f0ea-4f2b-826d-ddda28ece474  2015-12-09  Transport aérien: Communiqué de presse d’AERIA - Abidjan.net News
--   ea4b5153-8ee9-4ec9-9920-fa4af3607285  2017-07-18  Transport aérien : Air Côte d’Ivoire réceptionne son 1er Airbus A320 à Toulouse - Abidjan.net News
--   126bc766-2c0c-4b35-8b1a-517fda387664  2017-08-04  Le nouvel Airbus A320 de Air Côte d’Ivoire reflète l’ambition d’imposer un nouveau standard de quali
--   400cdddf-4db2-4256-a888-fc5a0ada6e68  2017-10-20  Les compagnies aériennes africaines à Abidjan pour débattre de la modernisation de leur flotte - Abi
--   93f3fde6-9ff5-4dd0-aecf-8602a9c99038  2018-05-29  Le Groupe Deloitte promet de contribuer à la sécurité des marchés financiers - news.abidjan.net
--   891ffb9c-b4b5-4528-ab34-1228d2503cb2  2021-09-25  Transport aérien : Air France baisse ses prix à destination de l’Europe et de l’Amérique jusqu’au 12
--   e482c17f-97f0-469e-9582-83f90d4dc0cf  2017-11-15  Transport aérien: beau temps dans le ciel d’Abidjan - news.abidjan.net
--   ac9d5a2f-38f2-4a71-a457-94e62c420cf3  2017-08-04  Le nouvel Airbus A320 de Air Côte d’Ivoire reflète l’ambition d’imposer un nouveau standard de quali
--   ab9f3606-1935-4989-8f39-1556d41221c4  2017-07-18  Transport aérien : Air Côte d’Ivoire réceptionne son 1er Airbus A320 à Toulouse - news.abidjan.net
--   ec74f3bb-c5cd-465d-a983-d7388bc964a1  2017-11-15  Transport aérien: beau temps dans le ciel d’Abidjan - Abidjan.net News

-- 1) AVANT
select count(*) as avant from public.brvm_news where 'STAC' = any(ticker_codes);  -- attendu : 27

-- 2) CORRECTION
update public.brvm_news
   set ticker_codes = array_remove(ticker_codes, 'STAC')
 where id in (
    '5fbdf1eb-84f4-42bc-a892-c51445f98d93',
    '3bc5952f-ce1c-448a-8f2f-aad701606868',
    'b4bd44fb-0acd-41d7-a439-0dfbfdd67ac2',
    '3b9904c0-1d1e-4e28-859c-a0c217391a1d',
    '8cc263bc-b18c-404d-9da1-48a2e1c64f15',
    'b4ef0419-8df7-4bfe-bad1-4735880bcd46',
    '62bfeec8-32fa-4821-86af-c4c4d1caf80b',
    '9931c7ef-2d2c-4e9d-8ee7-f849c0b4fcd4',
    '706b94a0-b1ea-42a3-8420-7be2a14b2f8a',
    '895b8444-d8eb-430b-8c3c-15d7ceb20045',
    '919a2b05-deae-400b-98f8-2b9080483347',
    '24ae7325-2aad-4604-b959-9fd3a017c9c1',
    'ff8dabe8-9743-45db-95b9-5d8b51ccec25',
    '78e2b894-3e5b-403f-a43e-b4142a2d9e46',
    'fa0e66d5-26ce-479a-a57f-a3b1e09c4261',
    '78a9a0c3-377b-4974-867a-3b07fcce4997',
    '3f672764-21ae-46e4-8950-4d0013838ffa',
    '279da00b-f0ea-4f2b-826d-ddda28ece474',
    'ea4b5153-8ee9-4ec9-9920-fa4af3607285',
    '126bc766-2c0c-4b35-8b1a-517fda387664',
    '400cdddf-4db2-4256-a888-fc5a0ada6e68',
    '93f3fde6-9ff5-4dd0-aecf-8602a9c99038',
    '891ffb9c-b4b5-4528-ab34-1228d2503cb2',
    'e482c17f-97f0-469e-9582-83f90d4dc0cf',
    'ac9d5a2f-38f2-4a71-a457-94e62c420cf3',
    'ab9f3606-1935-4989-8f39-1556d41221c4',
    'ec74f3bb-c5cd-465d-a983-d7388bc964a1'
 )
   and 'STAC' = any(ticker_codes);  -- attendu : 27 lignes

-- 3) APRÈS (attendu : 0 ; les articles existent toujours)
select count(*) as apres from public.brvm_news where 'STAC' = any(ticker_codes);
select count(*) as articles_conserves from public.brvm_news
 where id in (
    '5fbdf1eb-84f4-42bc-a892-c51445f98d93',
    '3bc5952f-ce1c-448a-8f2f-aad701606868',
    'b4bd44fb-0acd-41d7-a439-0dfbfdd67ac2',
    '3b9904c0-1d1e-4e28-859c-a0c217391a1d',
    '8cc263bc-b18c-404d-9da1-48a2e1c64f15',
    'b4ef0419-8df7-4bfe-bad1-4735880bcd46',
    '62bfeec8-32fa-4821-86af-c4c4d1caf80b',
    '9931c7ef-2d2c-4e9d-8ee7-f849c0b4fcd4',
    '706b94a0-b1ea-42a3-8420-7be2a14b2f8a',
    '895b8444-d8eb-430b-8c3c-15d7ceb20045',
    '919a2b05-deae-400b-98f8-2b9080483347',
    '24ae7325-2aad-4604-b959-9fd3a017c9c1',
    'ff8dabe8-9743-45db-95b9-5d8b51ccec25',
    '78e2b894-3e5b-403f-a43e-b4142a2d9e46',
    'fa0e66d5-26ce-479a-a57f-a3b1e09c4261',
    '78a9a0c3-377b-4974-867a-3b07fcce4997',
    '3f672764-21ae-46e4-8950-4d0013838ffa',
    '279da00b-f0ea-4f2b-826d-ddda28ece474',
    'ea4b5153-8ee9-4ec9-9920-fa4af3607285',
    '126bc766-2c0c-4b35-8b1a-517fda387664',
    '400cdddf-4db2-4256-a888-fc5a0ada6e68',
    '93f3fde6-9ff5-4dd0-aecf-8602a9c99038',
    '891ffb9c-b4b5-4528-ab34-1228d2503cb2',
    'e482c17f-97f0-469e-9582-83f90d4dc0cf',
    'ac9d5a2f-38f2-4a71-a457-94e62c420cf3',
    'ab9f3606-1935-4989-8f39-1556d41221c4',
    'ec74f3bb-c5cd-465d-a983-d7388bc964a1'
 );  -- attendu : 27

-- ─────────────────────────────────────────────────────────────────────────
-- OPTIONNEL, NON MODIFIÉ (à décider) : les articles réellement consacrés à
-- SETAO sont rangés sous le code inexistant « SETC » (34 lignes, flux
-- « Google News – SETAO »). 26 nomment SETAO/STAC dans le titre ; 8 n'ont
-- aucun rapport (dette du Ghana, Ecobank Nigeria, autres sociétés...).
-- Remise sur le bon code, preuve dans le titre seulement :
--
-- update public.brvm_news
--    set ticker_codes = array_append(array_remove(ticker_codes, 'SETC'), 'STAC')
--  where 'SETC' = any(ticker_codes)
--    and titre ~* '(^|[^[:alnum:]])(setao|stac)([^[:alnum:]]|$)';
