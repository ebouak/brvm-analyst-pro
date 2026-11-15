-- 0243 — Academy : schémas et graphiques dans les leçons (2026-11-15).
--
-- Demande de l'exploitant : « ajouter des graphiques et images illustratifs sur
-- l'analyse fondamentale et le reste des projets ». 18 schémas pédagogiques
-- (nouveau bloc `illustration` de section : cascade, bilan, décomposition,
-- échéancier, avant/après) et 3 graphiques de leçon (`charts`), priorité au
-- niveau 2 (analyse fondamentale), plus les niveaux 1 et 3 et le cours
-- « Comprendre le PER ». Source : frontend/lib/academy/contenus/**/*.json,
-- testés par lib/academy/illustrations.test.ts (schéma, rendu, concordance avec
-- les simulateurs et le texte) et contenus/schema-contenus.test.ts.
--
-- ⚠️ À APPLIQUER APRÈS le déploiement du frontend : le schéma zod des sections
-- (frontend/lib/academy/types.ts) doit connaître `illustration`. Appliquée avant,
-- la clé serait ignorée à la lecture (zod retire une clé inconnue) : rien ne
-- casserait, mais rien ne s'afficherait.
--
-- MÉTHODE : jsonb_set CIBLÉ, une clé par instruction. Le texte, la clé
-- `sections` et les simulateurs ne sont JAMAIS réécrits. Gardes : slug + titre
-- de la leçon (à sa position) + titre de la section (retrouvée par son titre,
-- pas par sa position), et clé encore vide (illustration absente ou null,
-- charts absent ou []). Une garde non satisfaite laisse la leçon intacte, sans
-- erreur. Un second passage ne change rien.
-- Aucun chiffre de marché : exemples fictifs annoncés comme tels, sauf la
-- cascade SIB 2025 (chiffres publiés par la banque, source dans le bloc).
-- Aucune donnée personnelle. Ne touche pas à academy_progress.

-- comprendre-le-per-et-la-valorisation-a-la-brvm · Qu’est-ce que le PER ? Définition et calcul · section « Définition » → decomposition
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text, 'illustration'], $wb${"gabarit":"decomposition","titre":"Le calcul du PER (exemple fictif de la leçon)","operation":"quotient","resultat":{"label":"PER","valeur":10},"facteurs":[{"label":"Cours de l’action","valeur":5000,"unite":"FCFA"},{"label":"Bénéfice par action (BPA)","valeur":500,"unite":"FCFA"}],"note":"L’acheteur paie 10 fois le bénéfice annuel par action. Si ce bénéfice restait constant, il faudrait 10 années de bénéfices pour égaler le prix payé."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'comprendre-le-per-et-la-valorisation-a-la-brvm' and e.v->>'titre' = $wb$Définition$wb$) s
 where c.slug = 'comprendre-le-per-et-la-valorisation-a-la-brvm'
   and c.content->'lessons'->0->>'titre' = $wb$Qu’est-ce que le PER ? Définition et calcul$wb$
   and coalesce(c.content #> array['lessons','0','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- comprendre-le-per-et-la-valorisation-a-la-brvm · PER et croissance : le PEG · section « Exemple chiffré (sociétés fictives) » → decomposition
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','2','sections', s.idx::text, 'illustration'], $wb${"gabarit":"decomposition","titre":"Le PEG de « Mali Tech », société fictive","operation":"quotient","resultat":{"label":"PEG","valeur":0.8},"facteurs":[{"label":"PER","valeur":20},{"label":"Croissance des bénéfices, en %","valeur":25}],"note":"Le PEG divise le PER par la croissance exprimée en nombre (25, et non 0,25). Malgré un PER de 20, Mali Tech ressort à 0,8 : un repère qui ne vaut que si cette croissance se maintient."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->2->'sections') with ordinality as e(v, o)
         where c2.slug = 'comprendre-le-per-et-la-valorisation-a-la-brvm' and e.v->>'titre' = $wb$Exemple chiffré (sociétés fictives)$wb$) s
 where c.slug = 'comprendre-le-per-et-la-valorisation-a-la-brvm'
   and c.content->'lessons'->2->>'titre' = $wb$PER et croissance : le PEG$wb$
   and coalesce(c.content #> array['lessons','2','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-1-initiation · Leçon 11 — BRVM ou autres placements : une comparaison objective · section « Comparer sur la bonne durée » → decomposition
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','10','sections', s.idx::text, 'illustration'], $wb${"gabarit":"decomposition","titre":"Un an de bourse : dividende et hausse du cours (exemple de la leçon)","operation":"somme","resultat":{"label":"Rendement total sur un an","valeur":10,"pourcentage":true},"facteurs":[{"label":"Dividende (400 FCFA)","valeur":4,"pourcentage":true},{"label":"Hausse du cours (600 FCFA)","valeur":6,"pourcentage":true}],"note":"Pour une action achetée 10 000 FCFA, le même placement afficherait 6 % sans le dividende au lieu de 10 % : comparez toujours dividendes compris."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->10->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' = $wb$Comparer sur la bonne durée$wb$) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->10->>'titre' = $wb$Leçon 11 — BRVM ou autres placements : une comparaison objective$wb$
   and coalesce(c.content #> array['lessons','10','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-1-initiation · Leçon 3 — Combien faut-il pour investir à la BRVM ? · section « Ne pas mettre tous ses œufs dans le même panier » → avant_apres
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','2','sections', s.idx::text, 'illustration'], $wb${"gabarit":"avant_apres","titre":"50 000 FCFA et une valeur qui baisse de 20 % (exemple pédagogique)","unite":"FCFA","colonnes":[{"label":"Tout sur une seule valeur","segments":[{"label":"Ce qui reste","valeur":40000},{"label":"Perte","valeur":10000}]},{"label":"Réparti sur cinq valeurs","segments":[{"label":"Ce qui reste","valeur":48000},{"label":"Perte","valeur":2000}]}],"note":"La même baisse coûte 10 000 FCFA quand tout est placé sur une valeur, et 2 000 FCFA, soit 4 % du portefeuille, quand le budget est réparti en cinq parts égales et qu’une seule des cinq baisse."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->2->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' = $wb$Ne pas mettre tous ses œufs dans le même panier$wb$) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->2->>'titre' = $wb$Leçon 3 — Combien faut-il pour investir à la BRVM ?$wb$
   and coalesce(c.content #> array['lessons','2','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-1-initiation · Leçon 4 — Dividende et plus-value : les deux sources de gain · section « Les calculer » → decomposition
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text, 'illustration'], $wb${"gabarit":"decomposition","titre":"Le rendement total additionne dividende et plus-value (exemple pédagogique)","operation":"somme","resultat":{"label":"Rendement total","valeur":20,"pourcentage":true},"facteurs":[{"label":"Dividendes reçus (80 000 FCFA)","valeur":8,"pourcentage":true},{"label":"Plus-value (120 000 FCFA)","valeur":12,"pourcentage":true}],"note":"Sur 1 000 000 FCFA investis, les deux sources de gain s’additionnent. La plus-value n’est acquise qu’à la revente ; le dividende, lui, est encaissé au paiement."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' = $wb$Les calculer$wb$) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' = $wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$
   and coalesce(c.content #> array['lessons','3','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-1-initiation · Leçon 6 — Ouvrir un compte et passer son premier ordre · section « Le coût réel d’un premier achat » → decomposition
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','5','sections', s.idx::text, 'illustration'], $wb${"gabarit":"decomposition","titre":"Le coût d’un achat : les titres, plus les frais (exemple pédagogique)","operation":"somme","unite":"FCFA","resultat":{"label":"Coût total de l’ordre","valeur":202000},"facteurs":[{"label":"20 actions à 10 000 FCFA","valeur":200000},{"label":"Frais (1 %)","valeur":2000}],"note":"Avec 1 % de frais, 20 actions à 10 000 FCFA coûtent 202 000 FCFA. Sur un très petit ordre, un minimum de frais peut peser bien plus que 1 % : le simulateur ci-dessous le montre."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->5->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' = $wb$Le coût réel d’un premier achat$wb$) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->5->>'titre' = $wb$Leçon 6 — Ouvrir un compte et passer son premier ordre$wb$
   and coalesce(c.content #> array['lessons','5','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 1 — Lire un rapport annuel · section « Les quatre pièces d’un rapport annuel » → bilan
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text, 'illustration'], $wb${"gabarit":"bilan","titre":"Un bilan en deux colonnes : ce que la société possède, et qui l’a financé (exemple fictif)","unite":"Md FCFA","actif":[{"label":"Immobilisations","valeur":30},{"label":"Stocks et créances","valeur":15},{"label":"Trésorerie","valeur":5}],"passif":[{"label":"Fonds propres","valeur":20,"nature":"fonds_propres"},{"label":"Dettes financières","valeur":18,"nature":"dettes"},{"label":"Fournisseurs et autres","valeur":12,"nature":"dettes"}],"note":"Les deux colonnes ont toujours le même total : tout ce que la société possède a été financé par quelqu’un. Ici, 50 Md FCFA d’actifs sont financés à 40 % par les actionnaires (fonds propres) et à 60 % par des dettes."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' = $wb$Les quatre pièces d’un rapport annuel$wb$) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->0->>'titre' = $wb$Leçon 1 — Lire un rapport annuel$wb$
   and coalesce(c.content #> array['lessons','0','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 1 — Lire un rapport annuel · section « Le mécanisme : du chiffre d’affaires au dividende » → cascade
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text, 'illustration'], $wb${"gabarit":"cascade","titre":"Du chiffre d’affaires au résultat net (exemple fictif)","unite":"Md FCFA","depart":{"label":"Chiffre d’affaires","valeur":20},"etapes":[{"label":"Achats et charges externes","valeur":-11},{"label":"Salaires","valeur":-4},{"label":"Amortissements","valeur":-1.5},{"label":"Intérêts de la dette","valeur":-0.5},{"label":"Impôt sur le résultat","valeur":-1}],"arrivee":"Résultat net","note":"Sur 20 Md FCFA de ventes, il reste 2 Md FCFA de résultat net, soit 10 FCFA pour 100 FCFA vendus. C’est ce résultat, le même que dans le simulateur ci-dessous, que l’assemblée générale répartit entre dividende et réserves."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' = $wb$Le mécanisme : du chiffre d’affaires au dividende$wb$) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->0->>'titre' = $wb$Leçon 1 — Lire un rapport annuel$wb$
   and coalesce(c.content #> array['lessons','0','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 2 — Le PER : évaluer la cherté d’une action · section « Trois formules » → decomposition
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','1','sections', s.idx::text, 'illustration'], $wb${"gabarit":"decomposition","titre":"Le PER, cours divisé par bénéfice par action (exemple fictif)","operation":"quotient","resultat":{"label":"PER","valeur":15},"facteurs":[{"label":"Cours de l’action","valeur":3000,"unite":"FCFA"},{"label":"Bénéfice par action (BPA)","valeur":200,"unite":"FCFA"}],"note":"À 3 000 FCFA l’action, l’acheteur paie 15 fois le bénéfice annuel par action. Le rendement bénéficiaire en est l’inverse : 1 ÷ 15, environ 6,7 %."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->1->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' = $wb$Trois formules$wb$) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->1->>'titre' = $wb$Leçon 2 — Le PER : évaluer la cherté d’une action$wb$
   and coalesce(c.content #> array['lessons','1','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 2 — Le PER : évaluer la cherté d’une action · section « Quand le PER trompe » → avant_apres
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','1','sections', s.idx::text, 'illustration'], $wb${"gabarit":"avant_apres","titre":"Une plus-value exceptionnelle gonfle le résultat (exemple fictif)","unite":"Md FCFA","colonnes":[{"label":"Année habituelle","segments":[{"label":"Activité courante","valeur":2}]},{"label":"Année de la cession","segments":[{"label":"Activité courante","valeur":2},{"label":"Plus-value du terrain","valeur":3}]}],"note":"Le résultat net passe de 2 à 5 Md FCFA et le PER est divisé par 2,5, alors que l’activité n’a pas changé. La plus-value ne se répétera pas l’année suivante : le PER retrouvera son niveau habituel."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->1->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' = $wb$Quand le PER trompe$wb$) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->1->>'titre' = $wb$Leçon 2 — Le PER : évaluer la cherté d’une action$wb$
   and coalesce(c.content #> array['lessons','1','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 2 — Le PER : évaluer la cherté d’une action · graphique(s) de leçon
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,1,charts}', $wb$[{"type":"bar","titre":"PER payé au cours de 4 000 FCFA, selon le bénéfice par action (exemple)","labels":["BPA de 200 FCFA","BPA de 300 FCFA","BPA de 400 FCFA"],"valeurs":[20,13.3,10],"unite":"fois","reel":false,"note":"Valeurs d’exemple, reprises du simulateur de la leçon : au même cours, un bénéfice qui double divise le PER par deux. Payer un PER de 20 suppose donc que cette hausse du bénéfice ait de bonnes raisons de se produire."}]$wb$::jsonb, true),
       updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->1->>'titre' = $wb$Leçon 2 — Le PER : évaluer la cherté d’une action$wb$
   and coalesce(c.content #> '{lessons,1,charts}', '[]'::jsonb) = '[]'::jsonb;

-- academy-niveau-2-fondamental · Leçon 3 — P/B, ROE et rendement : les ratios complémentaires · section « Le lien qui explique tout » → decomposition
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','2','sections', s.idx::text, 'illustration'], $wb${"gabarit":"decomposition","titre":"Le P/B se décompose en PER et ROE (exemple de la leçon)","operation":"produit","resultat":{"label":"P/B (cours ÷ valeur comptable)","valeur":2.5},"facteurs":[{"label":"PER","valeur":10},{"label":"ROE","valeur":25,"pourcentage":true}],"note":"À PER égal, c’est la rentabilité des fonds propres qui fixe le P/B. Avec un ROE de 5 %, le même PER de 10 donnerait un P/B de 0,5 : la moitié de la valeur comptable."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->2->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' = $wb$Le lien qui explique tout$wb$) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->2->>'titre' = $wb$Leçon 3 — P/B, ROE et rendement : les ratios complémentaires$wb$
   and coalesce(c.content #> array['lessons','2','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 3 — P/B, ROE et rendement : les ratios complémentaires · section « Les erreurs fréquentes » → avant_apres
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','2','sections', s.idx::text, 'illustration'], $wb${"gabarit":"avant_apres","titre":"Même bénéfice de 4 Md FCFA, deux façons de se financer (exemple fictif)","unite":"Md FCFA","part_du_premier":true,"colonnes":[{"label":"Première société","segments":[{"label":"Fonds propres","valeur":40}]},{"label":"Seconde société","segments":[{"label":"Fonds propres","valeur":10},{"label":"Dettes","valeur":30}]}],"note":"Les deux sociétés gagnent 4 Md FCFA. Rapporté à 40 Md FCFA de fonds propres, cela fait un ROE de 10 % ; rapporté à 10 Md FCFA, 40 %. L’écart vient de la dette, pas d’une meilleure gestion : la seconde est plus fragile si ses ventes baissent."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->2->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' = $wb$Les erreurs fréquentes$wb$) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->2->>'titre' = $wb$Leçon 3 — P/B, ROE et rendement : les ratios complémentaires$wb$
   and coalesce(c.content #> array['lessons','2','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 4 — Analyser une banque cotée · section « Un exemple publié : la SIB en 2025 » → cascade
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text, 'illustration'], $wb${"gabarit":"cascade","titre":"SIB, exercice 2025 : du produit net bancaire au résultat net","unite":"Md FCFA","reel":true,"source":"Rapport d’activité 2025 de la SIB, publié en avril 2026","depart":{"label":"Produit net bancaire","valeur":108.7},"etapes":[{"label":"Frais généraux","valeur":-41.9},{"label":"Coût du risque","valeur":-3.6},{"label":"Impôt et autres (par différence)","valeur":-7.6}],"arrivee":"Résultat net 2025","note":"Le produit net bancaire, le coût du risque et le résultat net sont publiés par la banque. Les frais généraux sont déduits du coefficient d’exploitation publié (38,59 % de 108,7 Md), comme dans le simulateur ; la ligne « impôt et autres » est obtenue par différence et n’est pas un chiffre publié."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' = $wb$Un exemple publié : la SIB en 2025$wb$) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->3->>'titre' = $wb$Leçon 4 — Analyser une banque cotée$wb$
   and coalesce(c.content #> array['lessons','3','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 6 — Les droits préférentiels de souscription (DPS) · section « Les trois choix de l’actionnaire » → avant_apres
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','5','sections', s.idx::text, 'illustration'], $wb${"gabarit":"avant_apres","titre":"Votre part du capital selon votre choix (exemple fictif : 1 action nouvelle pour 4)","unite":"actions","part_du_premier":true,"colonnes":[{"label":"Avant l’opération","segments":[{"label":"Vos actions","valeur":400},{"label":"Autres actionnaires","valeur":600}]},{"label":"Vous ne souscrivez pas","segments":[{"label":"Vos actions","valeur":400},{"label":"Autres actionnaires","valeur":850}]},{"label":"Vous souscrivez","segments":[{"label":"Vos actions","valeur":500},{"label":"Autres actionnaires","valeur":750}]}],"note":"La société fictive compte 1 000 actions et en émet 250. Sans souscrire, vos 400 actions ne pèsent plus que 32 % du capital au lieu de 40 % : c’est cette dilution que la vente des droits compense. En souscrivant vos 100 actions nouvelles, vous gardez 40 %."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->5->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' = $wb$Les trois choix de l’actionnaire$wb$) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->5->>'titre' = $wb$Leçon 6 — Les droits préférentiels de souscription (DPS)$wb$
   and coalesce(c.content #> array['lessons','5','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 7 — Simulation de portefeuille sur 3 ans · graphique(s) de leçon
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,6,charts}', $wb$[{"type":"bar","titre":"Part des obligations dans les trois portefeuilles d’exemple","labels":["Prudent","Équilibré","Dynamique"],"valeurs":[50,25,0],"unite":"%","reel":false,"note":"Répartitions d’exemple, fictives, du tableau de la leçon : la part d’obligations baisse à mesure que le profil accepte plus de variations. Un profil se choisit d’après l’horizon et la baisse supportable, pas d’après le rendement espéré."}]$wb$::jsonb, true),
       updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->6->>'titre' = $wb$Leçon 7 — Simulation de portefeuille sur 3 ans$wb$
   and coalesce(c.content #> '{lessons,6,charts}', '[]'::jsonb) = '[]'::jsonb;

-- academy-niveau-2-fondamental · Leçon 8 — La fiscalité des revenus boursiers · section « L’impôt est retenu avant le versement » → decomposition
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text, 'illustration'], $wb${"gabarit":"decomposition","titre":"Un dividende brut, deux destinataires (exemple fictif, IRVM de 12 %)","operation":"somme","unite":"FCFA","resultat":{"label":"Dividende brut","valeur":1000},"facteurs":[{"label":"Dividende net versé","valeur":880},{"label":"IRVM retenu à la source","valeur":120}],"note":"Au taux ivoirien de 12 % pour une personne physique, la société retient 120 FCFA et vous verse 880 FCFA. C’est sur ces 880 FCFA que se calcule le rendement net."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' = $wb$L’impôt est retenu avant le versement$wb$) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->7->>'titre' = $wb$Leçon 8 — La fiscalité des revenus boursiers$wb$
   and coalesce(c.content #> array['lessons','7','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 8 — La fiscalité des revenus boursiers · graphique(s) de leçon
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,7,charts}', $wb$[{"type":"bar","titre":"Rendement net de deux obligations (exemple)","labels":["État, 6 % exonéré","Société, 6,5 % brut"],"valeurs":[6,5.85],"unite":"%","reel":false,"note":"Exemple fictif de la leçon : l’obligation de société affiche le taux le plus haut, mais une retenue de 10 % la ramène à 5,85 % net, sous l’obligation d’État exonérée."}]$wb$::jsonb, true),
       updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->7->>'titre' = $wb$Leçon 8 — La fiscalité des revenus boursiers$wb$
   and coalesce(c.content #> '{lessons,7,charts}', '[]'::jsonb) = '[]'::jsonb;

-- academy-niveau-2-fondamental · Leçon 9 — Les obligations cotées à la BRVM · section « Prix, coupon couru et rendement » → echeancier
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','8','sections', s.idx::text, 'illustration'], $wb${"gabarit":"echeancier","titre":"Ce que verse une obligation in fine : 10 000 FCFA à 6,5 % sur 5 ans (exemple fictif)","unite":"FCFA","nominal":10000,"taux_pct":6.5,"annees":5,"mode":"in_fine","prix_achat":9800,"note":"Mêmes hypothèses que le simulateur ci-dessous : acheté 9 800 FCFA, le titre verse 650 FCFA de coupon chaque année, puis rend le nominal de 10 000 FCFA avec le dernier coupon. Les 200 FCFA gagnés au remboursement s’ajoutent aux coupons : le rendement réel dépasse donc le rendement courant."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->8->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' = $wb$Prix, coupon couru et rendement$wb$) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->8->>'titre' = $wb$Leçon 9 — Les obligations cotées à la BRVM$wb$
   and coalesce(c.content #> array['lessons','8','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-2-fondamental · Leçon 10 — Les OPCVM : investir par des fonds collectifs · section « Ce que coûte un fonds » → cascade
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','9','sections', s.idx::text, 'illustration'], $wb${"gabarit":"cascade","titre":"Ce que les frais retirent à 1 000 000 FCFA placés cinq ans (exemple fictif)","unite":"FCFA","depart":{"label":"Somme placée","valeur":1000000},"etapes":[{"label":"Frais d’entrée (2 %)","valeur":-20000},{"label":"Frais de gestion sur 5 ans (1,5 % l’an)","valeur":-71328}],"arrivee":"Valeur après 5 ans, sans performance","note":"Mêmes hypothèses que le simulateur, sans performance des titres : les frais coûtent environ 91 300 FCFA, soit 9,1 % de la somme placée. Les frais de gestion portent sur un encours qui diminue chaque année : ils restent un peu sous les 75 000 FCFA d’un encours stable."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->9->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' = $wb$Ce que coûte un fonds$wb$) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->9->>'titre' = $wb$Leçon 10 — Les OPCVM : investir par des fonds collectifs$wb$
   and coalesce(c.content #> array['lessons','9','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;

-- academy-niveau-3-technique · Leçon 7 — Stop-loss, objectif et taille de position · section « Les calculs » → decomposition
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','6','sections', s.idx::text, 'illustration'], $wb${"gabarit":"decomposition","titre":"La taille de la position découle du risque accepté (exemple fictif)","operation":"quotient","resultat":{"label":"Nombre d’actions","valeur":250,"unite":"actions"},"facteurs":[{"label":"Perte maximale (1 % du portefeuille)","valeur":50000,"unite":"FCFA"},{"label":"Risque par action (prix − stop)","valeur":200,"unite":"FCFA"}],"note":"250 actions à 2 000 FCFA, soit 500 000 FCFA investis : 10 % du portefeuille pour 1 % de risque. La taille vient de l’écart jusqu’au stop, pas de la somme disponible."}$wb$::jsonb, true),
       updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->6->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' = $wb$Les calculs$wb$) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->6->>'titre' = $wb$Leçon 7 — Stop-loss, objectif et taille de position$wb$
   and coalesce(c.content #> array['lessons','6','sections', s.idx::text, 'illustration'], 'null'::jsonb) = 'null'::jsonb;
