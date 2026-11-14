-- 0237 — Academy : simulateurs dans toutes les leçons où une notion se manipule (2026-11-14).
--
-- 23 simulateurs ajoutés dans 23 leçons des quatre niveaux (frais d'un ordre,
-- rendement total, valeur future, PER, P/B × ROE, banque, DPS, rendement net
-- d'IRVM, obligation, frais d'OPCVM, indicateurs techniques sur série réelle,
-- chandelier, taille de position, souscription à une introduction, affectation
-- du résultat, change euro – FCFA, répartition par secteur).
--
-- ⚠️ À APPLIQUER APRÈS le déploiement du frontend : le schéma zod des leçons
-- (frontend/lib/academy/types.ts) doit déjà connaître les nouveaux types de
-- simulation, sinon courseContentSchema.safeParse échoue et le cours ENTIER
-- renvoie 404. Les routes /api/academy/serie et /api/academy/ratios doivent
-- aussi être en ligne (simulateurs techniques, mode « valeur cotée »).
--
-- Fusion CIBLÉE : seule la clé `simulation` d'une section est posée
-- (jsonb_set) ; le texte des leçons, relu par ailleurs, n'est pas touché.
-- Gardes : slug + titre de la leçon + titre de la section, et section encore
-- sans simulation (idempotente : une seconde application ne change rien).
-- Aucun chiffre de marché : hypothèses écrites dans la leçon ; les données
-- réelles (clôtures, comptes) sont lues au rendu par les routes en lecture seule.
-- Source : frontend/lib/academy/contenus/**/*.json (testés :
-- contenus/schema-contenus.test.ts, contenus/simulations-contenus.test.ts).

-- academy-niveau-1-initiation · Leçon 3 — Combien faut-il pour investir à la BRVM ? · section « Les frais, l’ennemi des petits ordres » → frais_ordre
update public.academy_courses
   set content = jsonb_set(content, '{lessons,2,sections,2,simulation}', $wb${"type":"frais_ordre","consigne":"Modifiez la quantité et ajoutez un minimum de frais : sur un petit ordre, le minimum pèse bien plus que le taux affiché.","cours":2500,"quantite":10,"taux_frais_pct":1.5,"minimum_fcfa":0}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-1-initiation'
   and content->'lessons'->2->>'titre' = $wb$Leçon 3 — Combien faut-il pour investir à la BRVM ?$wb$
   and content->'lessons'->2->'sections'->2->>'titre' = $wb$Les frais, l’ennemi des petits ordres$wb$
   and coalesce(content #> '{lessons,2,sections,2,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-1-initiation · Leçon 4 — Les 3 façons de gagner à la BRVM · section « Les calculer » → rendement_total
update public.academy_courses
   set content = jsonb_set(content, '{lessons,3,sections,1,simulation}', $wb${"type":"rendement_total","consigne":"Les trois formules réunies : changez le prix de revente ou le dividende, et regardez la part de chacun dans le résultat.","prix_achat":5000,"prix_vente":5600,"actions":200,"dividendes_par_action":400,"annees":1}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-1-initiation'
   and content->'lessons'->3->>'titre' = $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$
   and content->'lessons'->3->'sections'->1->>'titre' = $wb$Les calculer$wb$
   and coalesce(content #> '{lessons,3,sections,1,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-1-initiation · Leçon 7 — Cas pratique : financer la scolarité de vos enfants · section « Les erreurs à éviter » → valeur_future
update public.academy_courses
   set content = jsonb_set(content, '{lessons,6,sections,5,simulation}', $wb${"type":"valeur_future","consigne":"Ajoutez un versement mensuel ou un capital visé : le simulateur compare aussi avec un départ trois ans plus tard.","capital_initial":200000,"versement_mensuel":0,"taux_pct":8,"annees":10,"objectif":0}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-1-initiation'
   and content->'lessons'->6->>'titre' = $wb$Leçon 7 — Cas pratique : financer la scolarité de vos enfants$wb$
   and content->'lessons'->6->'sections'->5->>'titre' = $wb$Les erreurs à éviter$wb$
   and coalesce(content #> '{lessons,6,sections,5,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-1-initiation · Leçon 8 — Trois stratégies d’investissement à la BRVM · section « Valeur : lire le PER » → per
update public.academy_courses
   set content = jsonb_set(content, '{lessons,7,sections,3,simulation}', $wb${"type":"per","consigne":"Calculez un PER sur l’exemple de la leçon, puis sur une valeur cotée, à partir de ses derniers comptes publiés.","cours":10000,"bpa":1250,"croissance_pct":0,"annees":3,"codes":["SNTS","SGBC","BOAB"]}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-1-initiation'
   and content->'lessons'->7->>'titre' = $wb$Leçon 8 — Trois stratégies d’investissement à la BRVM$wb$
   and content->'lessons'->7->'sections'->3->>'titre' = $wb$Valeur : lire le PER$wb$
   and coalesce(content #> '{lessons,7,sections,3,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-1-initiation · Leçon 9 — Ouvrir un compte et passer son premier ordre · section « Le coût réel d’un premier achat » → frais_ordre
update public.academy_courses
   set content = jsonb_set(content, '{lessons,8,sections,3,simulation}', $wb${"type":"frais_ordre","consigne":"Reprenez l’exemple, puis réduisez la quantité : avec un minimum de frais, le coût d’un très petit ordre grimpe vite.","cours":10000,"quantite":20,"taux_frais_pct":1,"minimum_fcfa":0}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-1-initiation'
   and content->'lessons'->8->>'titre' = $wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$
   and content->'lessons'->8->'sections'->3->>'titre' = $wb$Le coût réel d’un premier achat$wb$
   and coalesce(content #> '{lessons,8,sections,3,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-1-initiation · Leçon 10 — Investir depuis l’étranger (diaspora) · section « Le change euro – franc CFA » → change
update public.academy_courses
   set content = jsonb_set(content, '{lessons,9,sections,1,simulation}', $wb${"type":"change","consigne":"Renseignez les frais de votre banque : la parité ne bouge pas, mais les frais réduisent ce qui arrive sur le compte.","montant_eur":500,"frais_pct":0,"frais_fixes_eur":0,"cours_action":0}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-1-initiation'
   and content->'lessons'->9->>'titre' = $wb$Leçon 10 — Investir depuis l’étranger (diaspora)$wb$
   and content->'lessons'->9->'sections'->1->>'titre' = $wb$Le change euro – franc CFA$wb$
   and coalesce(content #> '{lessons,9,sections,1,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-1-initiation · Leçon 11 — BRVM ou autres placements : une comparaison objective · section « Comparer sur la bonne durée » → rendement_total
update public.academy_courses
   set content = jsonb_set(content, '{lessons,10,sections,2,simulation}', $wb${"type":"rendement_total","consigne":"Comparez avec et sans dividende, puis allongez la durée : le rendement annuel moyen se compare d’un placement à l’autre.","prix_achat":10000,"prix_vente":10600,"actions":1,"dividendes_par_action":400,"annees":1}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-1-initiation'
   and content->'lessons'->10->>'titre' = $wb$Leçon 11 — BRVM ou autres placements : une comparaison objective$wb$
   and content->'lessons'->10->'sections'->2->>'titre' = $wb$Comparer sur la bonne durée$wb$
   and coalesce(content #> '{lessons,10,sections,2,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 1 — Lire un rapport annuel · section « Le mécanisme : du chiffre d’affaires au dividende » → distribution
update public.academy_courses
   set content = jsonb_set(content, '{lessons,0,sections,1,simulation}', $wb${"type":"distribution","consigne":"Déplacez le curseur comme le ferait l’assemblée : la part distribuée va aux actionnaires, le reste renforce les fonds propres.","resultat_net":2000000000,"actions":10000000,"taux_distribution_pct":50}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-2-fondamental'
   and content->'lessons'->0->>'titre' = $wb$Leçon 1 — Lire un rapport annuel$wb$
   and content->'lessons'->0->'sections'->1->>'titre' = $wb$Le mécanisme : du chiffre d’affaires au dividende$wb$
   and coalesce(content #> '{lessons,0,sections,1,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 2 — Le PER : évaluer la cherté d’une action · section « Ce que le PER raconte » → per
update public.academy_courses
   set content = jsonb_set(content, '{lessons,1,sections,1,simulation}', $wb${"type":"per","consigne":"Fixez une progression du bénéfice : un PER de 20 payé aujourd’hui redevient un PER de 10 si le bénéfice double. Essayez aussi une valeur cotée.","cours":4000,"bpa":200,"croissance_pct":0,"annees":3,"codes":["SNTS","ORAC","ONTBF"]}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-2-fondamental'
   and content->'lessons'->1->>'titre' = $wb$Leçon 2 — Le PER : évaluer la cherté d’une action$wb$
   and content->'lessons'->1->'sections'->1->>'titre' = $wb$Ce que le PER raconte$wb$
   and coalesce(content #> '{lessons,1,sections,1,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 3 — P/B, ROE et rendement : les ratios complémentaires · section « Une lecture croisée » → pb_roe
update public.academy_courses
   set content = jsonb_set(content, '{lessons,2,sections,3,simulation}', $wb${"type":"pb_roe","consigne":"Modifiez le ROE de chaque société à PER égal, puis vérifiez le lien sur une valeur cotée.","societes":[{"nom":"Société A","per":12,"roe_pct":25},{"nom":"Société B","per":12,"roe_pct":6}],"codes":["NTLC","PALC","SNTS","SGBC"]}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-2-fondamental'
   and content->'lessons'->2->>'titre' = $wb$Leçon 3 — P/B, ROE et rendement : les ratios complémentaires$wb$
   and content->'lessons'->2->'sections'->3->>'titre' = $wb$Une lecture croisée$wb$
   and coalesce(content #> '{lessons,2,sections,3,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 4 — Analyser une banque cotée · section « Un exemple publié : la SIB en 2025 » → banque
update public.academy_courses
   set content = jsonb_set(content, '{lessons,3,sections,2,simulation}', $wb${"type":"banque","consigne":"Chiffres publiés par la SIB pour 2025 ; les frais généraux sont déduits du coefficient publié (38,59 % de 108,7 Md). Faites varier le coût du risque.","pnb":108.7,"frais_generaux":41.9,"cout_risque":3.6,"unite":"Md FCFA"}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-2-fondamental'
   and content->'lessons'->3->>'titre' = $wb$Leçon 4 — Analyser une banque cotée$wb$
   and content->'lessons'->3->'sections'->2->>'titre' = $wb$Un exemple publié : la SIB en 2025$wb$
   and coalesce(content #> '{lessons,3,sections,2,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 5 — Diversification et allocation d’actifs · section « Les quatre dimensions de la répartition » → allocation
update public.academy_courses
   set content = jsonb_set(content, '{lessons,4,sections,2,simulation}', $wb${"type":"allocation","capital":3000000,"secteurs":[{"nom":"Banques","pct":60},{"nom":"Télécoms","pct":10},{"nom":"Distribution","pct":10},{"nom":"Agro-industrie","pct":10},{"nom":"Services publics","pct":10}],"seuil_secteur_pct":33}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-2-fondamental'
   and content->'lessons'->4->>'titre' = $wb$Leçon 5 — Diversification et allocation d’actifs$wb$
   and content->'lessons'->4->'sections'->2->>'titre' = $wb$Les quatre dimensions de la répartition$wb$
   and coalesce(content #> '{lessons,4,sections,2,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 6 — Les droits préférentiels de souscription (DPS) · section « Calculer la valeur d’un droit » → dps
update public.academy_courses
   set content = jsonb_set(content, '{lessons,5,sections,1,simulation}', $wb${"type":"dps","consigne":"Changez la parité, le prix d’émission ou le nombre d’actions : la valeur se conserve, mais votre part du capital dépend de votre choix.","cours":6000,"prix_emission":4500,"parite":4,"actions":4}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-2-fondamental'
   and content->'lessons'->5->>'titre' = $wb$Leçon 6 — Les droits préférentiels de souscription (DPS)$wb$
   and content->'lessons'->5->'sections'->1->>'titre' = $wb$Calculer la valeur d’un droit$wb$
   and coalesce(content #> '{lessons,5,sections,1,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 8 — La fiscalité des revenus boursiers · section « L’impôt est retenu avant le versement » → rendement_net
update public.academy_courses
   set content = jsonb_set(content, '{lessons,7,sections,0,simulation}', $wb${"type":"rendement_net","consigne":"Choisissez le pays de la société : pour un même dividende brut, le montant net change.","dividende_brut":1000,"cours":16000,"pays":"CI","euros":false}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-2-fondamental'
   and content->'lessons'->7->>'titre' = $wb$Leçon 8 — La fiscalité des revenus boursiers$wb$
   and content->'lessons'->7->'sections'->0->>'titre' = $wb$L’impôt est retenu avant le versement$wb$
   and coalesce(content #> '{lessons,7,sections,0,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 9 — Les obligations cotées à la BRVM · section « Prix, coupon couru et rendement » → obligation
update public.academy_courses
   set content = jsonb_set(content, '{lessons,8,sections,1,simulation}', $wb${"type":"obligation","consigne":"Changez le prix payé ou le taux des nouveaux emprunts : le rendement réel dépend du prix, et le prix des taux.","nominal":10000,"taux_nominal_pct":6.5,"prix":9800,"annees_restantes":5,"jours_ecoules":0,"taux_marche_pct":7}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-2-fondamental'
   and content->'lessons'->8->>'titre' = $wb$Leçon 9 — Les obligations cotées à la BRVM$wb$
   and content->'lessons'->8->'sections'->1->>'titre' = $wb$Prix, coupon couru et rendement$wb$
   and coalesce(content #> '{lessons,8,sections,1,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 10 — Les OPCVM : investir par des fonds collectifs · section « Ce que coûte un fonds » → opcvm_frais
update public.academy_courses
   set content = jsonb_set(content, '{lessons,9,sections,2,simulation}', $wb${"type":"opcvm_frais","consigne":"Ajoutez des frais de sortie ou une performance : le simulateur indique ce que le fonds doit gagner pour seulement compenser ses frais.","montant":1000000,"annees":5,"frais_entree_pct":2,"frais_gestion_pct":1.5,"frais_sortie_pct":0,"performance_pct":0}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-2-fondamental'
   and content->'lessons'->9->>'titre' = $wb$Leçon 10 — Les OPCVM : investir par des fonds collectifs$wb$
   and content->'lessons'->9->'sections'->2->>'titre' = $wb$Ce que coûte un fonds$wb$
   and coalesce(content #> '{lessons,9,sections,2,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-3-technique · Leçon 1 — Lire un graphique de cours · section « Les trois échelles de temps » → technique
update public.academy_courses
   set content = jsonb_set(content, '{lessons,0,sections,1,simulation}', $wb${"type":"technique","indicateur":"variation","consigne":"Choisissez une valeur : sa variation est mesurée sur quatre horizons, à partir de ses clôtures réelles.","codes":["SNTS","SGBC","ORAC","PALC"]}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-3-technique'
   and content->'lessons'->0->>'titre' = $wb$Leçon 1 — Lire un graphique de cours$wb$
   and content->'lessons'->0->'sections'->1->>'titre' = $wb$Les trois échelles de temps$wb$
   and coalesce(content #> '{lessons,0,sections,1,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-3-technique · Leçon 2 — Les chandeliers japonais · section « L’anatomie d’une bougie » → chandelier
update public.academy_courses
   set content = jsonb_set(content, '{lessons,1,sections,0,simulation}', $wb${"type":"chandelier","consigne":"Saisissez quatre prix : la bougie se dessine et sa forme est décrite. Essayez un doji, un marteau, une étoile filante.","ouverture":1000,"haut":1060,"bas":980,"cloture":1040}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-3-technique'
   and content->'lessons'->1->>'titre' = $wb$Leçon 2 — Les chandeliers japonais$wb$
   and content->'lessons'->1->'sections'->0->>'titre' = $wb$L’anatomie d’une bougie$wb$
   and coalesce(content #> '{lessons,1,sections,0,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-3-technique · Leçon 3 — Les moyennes mobiles · section « Moyenne courte et moyenne longue » → technique
update public.academy_courses
   set content = jsonb_set(content, '{lessons,2,sections,1,simulation}', $wb${"type":"technique","indicateur":"moyennes","consigne":"Raccourcissez ou allongez les moyennes sur une série réelle : plus elles sont courtes, plus elles suivent le cours de près.","codes":["SNTS","ORAC","SGBC","ETIT","SIBC"],"courte":20,"longue":50}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-3-technique'
   and content->'lessons'->2->>'titre' = $wb$Leçon 3 — Les moyennes mobiles$wb$
   and content->'lessons'->2->'sections'->1->>'titre' = $wb$Moyenne courte et moyenne longue$wb$
   and coalesce(content #> '{lessons,2,sections,1,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-3-technique · Leçon 4 — Le RSI : mesurer les excès de marché · section « Les trois zones » → technique
update public.academy_courses
   set content = jsonb_set(content, '{lessons,3,sections,1,simulation}', $wb${"type":"technique","indicateur":"rsi","consigne":"Changez la période et les seuils : la zone extrême décrit l’intensité d’un mouvement récent, pas sa fin.","codes":["SNTS","BOAC","NTLC","SDCC","TTLC"],"periode":14,"seuil_haut":70,"seuil_bas":30}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-3-technique'
   and content->'lessons'->3->>'titre' = $wb$Leçon 4 — Le RSI : mesurer les excès de marché$wb$
   and content->'lessons'->3->'sections'->1->>'titre' = $wb$Les trois zones$wb$
   and coalesce(content #> '{lessons,3,sections,1,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-3-technique · Leçon 5 — Le MACD : l’élan d’une tendance · section « Lire l’histogramme » → technique
update public.academy_courses
   set content = jsonb_set(content, '{lessons,4,sections,2,simulation}', $wb${"type":"technique","indicateur":"macd","consigne":"Le MACD 12, 26, 9 calculé sur une valeur réelle : l’histogramme est lu selon son signe et son évolution, comme dans le tableau.","codes":["SNTS","ORAC","SGBC","SIBC"]}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-3-technique'
   and content->'lessons'->4->>'titre' = $wb$Leçon 5 — Le MACD : l’élan d’une tendance$wb$
   and content->'lessons'->4->'sections'->2->>'titre' = $wb$Lire l’histogramme$wb$
   and coalesce(content #> '{lessons,4,sections,2,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-3-technique · Leçon 7 — Stop-loss, objectif et taille de position · section « Les calculs » → position
update public.academy_courses
   set content = jsonb_set(content, '{lessons,6,sections,1,simulation}', $wb${"type":"position","consigne":"Déplacez le stop ou le risque accepté : la taille de la position en découle, et l’objectif donne le rapport gain sur risque.","portefeuille":5000000,"risque_pct":1,"prix_achat":2000,"stop":1800,"objectif":2500}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-3-technique'
   and content->'lessons'->6->>'titre' = $wb$Leçon 7 — Stop-loss, objectif et taille de position$wb$
   and content->'lessons'->6->'sections'->1->>'titre' = $wb$Les calculs$wb$
   and coalesce(content #> '{lessons,6,sections,1,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-4-expert · Leçon 4 — Pourquoi une société entre en bourse · section « Un exemple récent : Bridge Bank Group Côte d’Ivoire » → souscription_ipo
update public.academy_courses
   set content = jsonb_set(content, '{lessons,3,sections,2,simulation}', $wb${"type":"souscription_ipo","consigne":"Chiffres publiés de l’offre BBGC. Indiquez le nombre de titres que vous auriez demandés : la réduction suit ici une règle proportionnelle.","titres_offerts":10000000,"prix":6750,"taux_souscription_pct":142,"demande":100}$wb$::jsonb, true),
       updated_at = now()
 where slug = 'academy-niveau-4-expert'
   and content->'lessons'->3->>'titre' = $wb$Leçon 4 — Pourquoi une société entre en bourse$wb$
   and content->'lessons'->3->'sections'->2->>'titre' = $wb$Un exemple récent : Bridge Bank Group Côte d’Ivoire$wb$
   and coalesce(content #> '{lessons,3,sections,2,simulation}', 'null'::jsonb) = 'null'::jsonb;

-- Vérification (à lancer après application) : nombre de sections portant un
-- simulateur, par cours. Attendu (0235 et antérieures appliquées) : niveau 1 → 12, niveau 2 → 11, niveau 3 → 6, niveau 4 → 1.
-- select slug, count(*) from public.academy_courses c,
--   jsonb_array_elements(c.content->'lessons') l, jsonb_array_elements(l->'sections') s
--  where slug like 'academy-niveau-%' and (s ? 'simulation') and s->'simulation' <> 'null'::jsonb
--  group by slug order by slug;
