-- 0238 — Academy, niveaux 1 à 4 : corrections de la relecture (2026-11-14).
--
-- Relecture complète des 33 leçons : 3 points BLOQUANTS (DPS présentés comme
-- un gain en N1 L4 ; tableau de dividendes affiché sous « le prix de 20 actions »
-- en N1 L9 ; rejeu du score présenté sans horizon, sans taille d'échantillon
-- indépendant ni réserve sur 2024-2026 en N3 L1 et L4), points IMPORTANTS et
-- MINEURS, et options de quiz réécrites pour que la longueur ne trahisse plus
-- la bonne réponse (53 % → 23 % des questions).
-- Source : frontend/lib/academy/contenus/**/*.json (testés, relecture.test.ts).
-- Sauvegarde (texte source avant correction) :
--   docs/academy/sauvegardes/2026-11-14-academy-relecture-avant.json
--
-- MÉTHODE : une mise à jour par champ de texte modifié, et rien d'autre.
-- La clé `sections` n'est JAMAIS remplacée en entier : 0237 y ajoute des
-- simulateurs. Chaque section est retrouvée par son titre (ancien OU nouveau),
-- pas par sa position ; chaque leçon par son titre (ancien OU nouveau) ; chaque
-- question par son énoncé (ancien OU nouveau). Rejouer la migration ne change
-- rien (garde « is distinct from »). Une seule clé est retirée : les `stats`
-- dupliquées de la section RSI (N3 L4), le bloc chiffré restant en N3 L1.
--
-- ⚠️ ORDRE : APRÈS 0236 et 0237 (0237 réécrit des leçons entières par fusion `||`
-- à partir de ses propres JSON : appliquée après, elle remettrait l'ancien
-- texte). Le frontend n'a pas besoin d'être déployé avant : aucun schéma ne change.
-- Vérification après application : relire une leçon par niveau et comparer à
-- son JSON ; une garde non satisfaite (titre différent en base) laisse la
-- leçon intacte sans erreur.
-- Aucune donnée personnelle.

-- academy-niveau-1-initiation · Leçon 1 — Qu’est-ce que la BRVM et comment ça marche ?  (lecon1-brvm.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text] || '{etapes,3,detail}'::text[], $wb$"Le Dépositaire central (DC/BR) dénoue l’échange entre intermédiaires ; votre SGI inscrit ensuite les titres sur votre compte-titres."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Comment se forme le prix d’une action$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Qu’est-ce que la BRVM et comment ça marche ?$wb$)
   and c.content #> (array['lessons','0','sections', s.idx::text] || '{etapes,3,detail}'::text[]) is distinct from $wb$"Le Dépositaire central (DC/BR) dénoue l’échange entre intermédiaires ; votre SGI inscrit ensuite les titres sur votre compte-titres."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text] || '{contenu}'::text[], $wb$"Un indice résume en un chiffre l’évolution d’un ensemble d’actions. Le BRVM Composite suit toutes les actions cotées ; le BRVM 30 suit trente des valeurs les plus échangées.\nLe BRVM Composite et le BRVM 30 sont calculés sur les seuls cours : les dividendes n’y entrent pas. Une année où l’indice stagne peut donc avoir rapporté de l’argent aux actionnaires qui ont touché leurs dividendes."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Les indices, thermomètre du marché$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Qu’est-ce que la BRVM et comment ça marche ?$wb$)
   and c.content #> (array['lessons','0','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Un indice résume en un chiffre l’évolution d’un ensemble d’actions. Le BRVM Composite suit toutes les actions cotées ; le BRVM 30 suit trente des valeurs les plus échangées.\nLe BRVM Composite et le BRVM 30 sont calculés sur les seuls cours : les dividendes n’y entrent pas. Une année où l’indice stagne peut donc avoir rapporté de l’argent aux actionnaires qui ont touché leurs dividendes."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,0,quiz,3,options}', $wb$["Oui, l’indice mesure tout le gain", "Non : il ignore les dividendes", "Non : l’indice ne compte que les banques", "Oui, sauf pour les détenteurs d’obligations"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Qu’est-ce que la BRVM et comment ça marche ?$wb$)
   and c.content #>> '{lessons,0,quiz,3,question}' in ($wb$Le BRVM Composite progresse de 0 % sur une année. Les actionnaires ont-ils forcément gagné 0 % ?$wb$)
   and c.content #> '{lessons,0,quiz,3,options}' is distinct from $wb$["Oui, l’indice mesure tout le gain", "Non : il ignore les dividendes", "Non : l’indice ne compte que les banques", "Oui, sauf pour les détenteurs d’obligations"]$wb$::jsonb;

-- academy-niveau-1-initiation · Leçon 10 — Investir depuis l’étranger (diaspora)  (lecon10-diaspora.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','9','sections', s.idx::text] || '{flux,3,detail}'::text[], $wb$"En ligne, quand la SGI le propose."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->9->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Le parcours à distance$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->9->>'titre' in ($wb$Leçon 10 — Investir depuis l’étranger (diaspora)$wb$)
   and c.content #> (array['lessons','9','sections', s.idx::text] || '{flux,3,detail}'::text[]) is distinct from $wb$"En ligne, quand la SGI le propose."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','9','sections', s.idx::text] || '{contenu}'::text[], $wb$"Le franc CFA est lié à l’euro par une parité fixe : 1 euro vaut 655,957 FCFA. Pour un résident de la zone euro, ce change ne varie pas au jour le jour. Une modification de la parité reste possible, comme en 1994.\nPour les autres devises, comme le dollar, le cours varie : le rendement final dépend aussi du change."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->9->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Le change euro – franc CFA$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->9->>'titre' in ($wb$Leçon 10 — Investir depuis l’étranger (diaspora)$wb$)
   and c.content #> (array['lessons','9','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Le franc CFA est lié à l’euro par une parité fixe : 1 euro vaut 655,957 FCFA. Pour un résident de la zone euro, ce change ne varie pas au jour le jour. Une modification de la parité reste possible, comme en 1994.\nPour les autres devises, comme le dollar, le cours varie : le rendement final dépend aussi du change."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','9','sections', s.idx::text] || '{points,1,detail}'::text[], $wb$"Une parité fixe : le change ne varie pas au jour le jour depuis la zone euro. Une modification de parité reste possible, comme en 1994."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->9->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$L’essentiel$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->9->>'titre' in ($wb$Leçon 10 — Investir depuis l’étranger (diaspora)$wb$)
   and c.content #> (array['lessons','9','sections', s.idx::text] || '{points,1,detail}'::text[]) is distinct from $wb$"Une parité fixe : le change ne varie pas au jour le jour depuis la zone euro. Une modification de parité reste possible, comme en 1994."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,9,quiz,1,explication}', $wb$"La parité est fixe : 1 euro = 655,957 FCFA. Le change ne varie donc pas au jour le jour pour un investisseur de la zone euro ; une modification de parité reste possible, comme en 1994."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->9->>'titre' in ($wb$Leçon 10 — Investir depuis l’étranger (diaspora)$wb$)
   and c.content #>> '{lessons,9,quiz,1,question}' in ($wb$Pour un investisseur résidant dans la zone euro, la parité euro – franc CFA est :$wb$)
   and c.content #> '{lessons,9,quiz,1,explication}' is distinct from $wb$"La parité est fixe : 1 euro = 655,957 FCFA. Le change ne varie donc pas au jour le jour pour un investisseur de la zone euro ; une modification de parité reste possible, comme en 1994."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,9,quiz,3,options}', $wb$["Investir un petit montant pour tester d’abord", "Ne rien déposer, vérifier l’agrément", "Y investir si le rendement promis est très élevé", "Demander à un proche d’investir à votre place"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->9->>'titre' in ($wb$Leçon 10 — Investir depuis l’étranger (diaspora)$wb$)
   and c.content #>> '{lessons,9,quiz,3,question}' in ($wb$Une plateforme hors UEMOA vous propose des « actions africaines » sans agrément. Que faire ?$wb$)
   and c.content #> '{lessons,9,quiz,3,options}' is distinct from $wb$["Investir un petit montant pour tester d’abord", "Ne rien déposer, vérifier l’agrément", "Y investir si le rendement promis est très élevé", "Demander à un proche d’investir à votre place"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,9,quiz,4,options}', $wb$["Sont toujours exonérés d’impôt dans tous les pays", "Peuvent aussi être imposés là où vous résidez", "Ne peuvent jamais être virés hors de l’UEMOA", "Sont versés uniquement en euros, sans conversion"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->9->>'titre' in ($wb$Leçon 10 — Investir depuis l’étranger (diaspora)$wb$)
   and c.content #>> '{lessons,9,quiz,4,question}' in ($wb$Les dividendes perçus par un investisseur résidant à l’étranger :$wb$)
   and c.content #> '{lessons,9,quiz,4,options}' is distinct from $wb$["Sont toujours exonérés d’impôt dans tous les pays", "Peuvent aussi être imposés là où vous résidez", "Ne peuvent jamais être virés hors de l’UEMOA", "Sont versés uniquement en euros, sans conversion"]$wb$::jsonb;

-- academy-niveau-1-initiation · Leçon 11 — BRVM ou autres placements : une comparaison objective  (lecon11-comparaison.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,10,quiz,2,options}', $wb$["Parce que les dividendes ne sont versés qu’au bout de cinq ans", "Parce qu’une seule année peut être exceptionnelle", "Parce que la BRVM ne publie ses cours qu’une fois par an", "Parce que l’immobilier ne se vend qu’après dix ans"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->10->>'titre' in ($wb$Leçon 11 — BRVM ou autres placements : une comparaison objective$wb$)
   and c.content #>> '{lessons,10,quiz,2,question}' in ($wb$Pourquoi comparer les placements sur cinq à dix ans ?$wb$)
   and c.content #> '{lessons,10,quiz,2,options}' is distinct from $wb$["Parce que les dividendes ne sont versés qu’au bout de cinq ans", "Parce qu’une seule année peut être exceptionnelle", "Parce que la BRVM ne publie ses cours qu’une fois par an", "Parce que l’immobilier ne se vend qu’après dix ans"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,10,quiz,4,options}', $wb$["Un portefeuille d’actions diversifié", "Un bien immobilier en location", "Une épargne de précaution", "Un commerce de proximité"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->10->>'titre' in ($wb$Leçon 11 — BRVM ou autres placements : une comparaison objective$wb$)
   and c.content #>> '{lessons,10,quiz,4,question}' in ($wb$Par quoi commencer pour bâtir un patrimoine ?$wb$)
   and c.content #> '{lessons,10,quiz,4,options}' is distinct from $wb$["Un portefeuille d’actions diversifié", "Un bien immobilier en location", "Une épargne de précaution", "Un commerce de proximité"]$wb$::jsonb;

-- academy-niveau-1-initiation · Leçon 2 — Les 4 acteurs clés du marché  (lecon2-acteurs.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','1','sections', s.idx::text] || '{contenu}'::text[], $wb$"Chaque achat suit la même chaîne. Pour passer vos ordres, vous ne parlez qu’à votre SGI ; les autres acteurs travaillent derrière elle. La conservation des titres peut aussi être confiée à une banque teneur de compte-conservateur."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->1->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$De votre ordre à vos titres$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->1->>'titre' in ($wb$Leçon 2 — Les 4 acteurs clés du marché$wb$)
   and c.content #> (array['lessons','1','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Chaque achat suit la même chaîne. Pour passer vos ordres, vous ne parlez qu’à votre SGI ; les autres acteurs travaillent derrière elle. La conservation des titres peut aussi être confiée à une banque teneur de compte-conservateur."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,1,quiz,2,options}', $wb$["Fixer chaque jour le prix des actions cotées", "Tenir les titres et régler les échanges", "Conseiller les investisseurs particuliers", "Organiser les assemblées générales"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->1->>'titre' in ($wb$Leçon 2 — Les 4 acteurs clés du marché$wb$)
   and c.content #>> '{lessons,1,quiz,2,question}' in ($wb$Quel est le rôle du DC/BR ?$wb$)
   and c.content #> '{lessons,1,quiz,2,options}' is distinct from $wb$["Fixer chaque jour le prix des actions cotées", "Tenir les titres et régler les échanges", "Conseiller les investisseurs particuliers", "Organiser les assemblées générales"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,1,quiz,3,options}', $wb$["Vous versez une petite somme pour tester", "Vous refusez : rien n’est garanti", "Vous demandez une remise sur les frais d’entrée", "Vous attendez que l’offre expire pour décider"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->1->>'titre' in ($wb$Leçon 2 — Les 4 acteurs clés du marché$wb$)
   and c.content #>> '{lessons,1,quiz,3,question}' in ($wb$Un « conseiller » vous propose sur WhatsApp un placement garanti à 15 % par mois. Que faites-vous ?$wb$)
   and c.content #> '{lessons,1,quiz,3,options}' is distinct from $wb$["Vous versez une petite somme pour tester", "Vous refusez : rien n’est garanti", "Vous demandez une remise sur les frais d’entrée", "Vous attendez que l’offre expire pour décider"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,1,quiz,4,options}', $wb$["Sur votre compte-titres, chez votre SGI", "Sur un certificat papier envoyé chez vous", "Sur le site de la société", "Sur votre compte bancaire courant"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->1->>'titre' in ($wb$Leçon 2 — Les 4 acteurs clés du marché$wb$)
   and c.content #>> '{lessons,1,quiz,4,question}' in ($wb$Où sont inscrites les actions que vous achetez ?$wb$)
   and c.content #> '{lessons,1,quiz,4,options}' is distinct from $wb$["Sur votre compte-titres, chez votre SGI", "Sur un certificat papier envoyé chez vous", "Sur le site de la société", "Sur votre compte bancaire courant"]$wb$::jsonb;

-- academy-niveau-1-initiation · Leçon 3 — Combien faut-il pour investir à la BRVM ?  (lecon3-budget.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,2,quiz,2,options}', $wb$["La première est forcément la meilleure affaire", "La seconde est de meilleure qualité", "Rien : le cours dépend surtout du nombre de titres", "La première verse forcément un plus petit dividende"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->2->>'titre' in ($wb$Leçon 3 — Combien faut-il pour investir à la BRVM ?$wb$)
   and c.content #>> '{lessons,2,quiz,2,question}' in ($wb$Une action cote 1 800 FCFA, une autre 30 000 FCFA. Que peut-on en conclure ?$wb$)
   and c.content #> '{lessons,2,quiz,2,options}' is distinct from $wb$["La première est forcément la meilleure affaire", "La seconde est de meilleure qualité", "Rien : le cours dépend surtout du nombre de titres", "La première verse forcément un plus petit dividende"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,2,quiz,4,options}', $wb$["La BRVM refuse les ordres de moins de dix titres", "Le minimum de frais par ordre pèse lourd", "Ils ne donnent pas droit au dividende", "Ils sont toujours exécutés en dernier"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->2->>'titre' in ($wb$Leçon 3 — Combien faut-il pour investir à la BRVM ?$wb$)
   and c.content #>> '{lessons,2,quiz,4,question}' in ($wb$Pourquoi éviter de multiplier les très petits ordres ?$wb$)
   and c.content #> '{lessons,2,quiz,4,options}' is distinct from $wb$["La BRVM refuse les ordres de moins de dix titres", "Le minimum de frais par ordre pèse lourd", "Ils ne donnent pas droit au dividende", "Ils sont toujours exécutés en dernier"]$wb$::jsonb;

-- academy-niveau-1-initiation · Leçon 4 — Dividende et plus-value : les deux sources de gain  (lecon4-gagner.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,3,titre}', $wb$"Leçon 4 — Dividende et plus-value : les deux sources de gain"$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #> '{lessons,3,titre}' is distinct from $wb$"Leçon 4 — Dividende et plus-value : les deux sources de gain"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,3,sous_titre}', $wb$"Le dividende et la plus-value : deux sources de gain, deux logiques. Et un droit à protéger lors d’une augmentation de capital."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #> '{lessons,3,sous_titre}' is distinct from $wb$"Le dividende et la plus-value : deux sources de gain, deux logiques. Et un droit à protéger lors d’une augmentation de capital."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,3,resume}', $wb$"Une action peut rapporter de deux façons : par le dividende versé chaque année, et par la plus-value à la revente. Lors d’une augmentation de capital, les droits que vous recevez ne sont pas un gain : ils compensent la dilution de vos titres.\nCette leçon apprend à calculer ces gains, à les additionner, et à reconnaître ce qui n’est pas la norme."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #> '{lessons,3,resume}' is distinct from $wb$"Une action peut rapporter de deux façons : par le dividende versé chaque année, et par la plus-value à la revente. Lors d’une augmentation de capital, les droits que vous recevez ne sont pas un gain : ils compensent la dilution de vos titres.\nCette leçon apprend à calculer ces gains, à les additionner, et à reconnaître ce qui n’est pas la norme."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text] || '{titre}'::text[], $wb$"Deux sources de gain, un droit à protéger"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Deux sources de gain, un droit à protéger$wb$, $wb$Trois sources de gain$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #> (array['lessons','3','sections', s.idx::text] || '{titre}'::text[]) is distinct from $wb$"Deux sources de gain, un droit à protéger"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text] || '{contenu}'::text[], $wb$"Un actionnaire gagne de l’argent de deux manières, qui peuvent s’additionner. Un troisième élément, le droit de souscription, ne crée pas de gain : il protège ce que vous avez déjà."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Deux sources de gain, un droit à protéger$wb$, $wb$Trois sources de gain$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #> (array['lessons','3','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Un actionnaire gagne de l’argent de deux manières, qui peuvent s’additionner. Un troisième élément, le droit de souscription, ne crée pas de gain : il protège ce que vous avez déjà."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text] || '{points,2,detail}'::text[], $wb$"Lors d’une augmentation de capital, vous recevez des droits qui compensent la dilution de vos titres. Ils ne créent pas de gain : bien utilisés, ils évitent une perte."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Deux sources de gain, un droit à protéger$wb$, $wb$Trois sources de gain$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #> (array['lessons','3','sections', s.idx::text] || '{points,2,detail}'::text[]) is distinct from $wb$"Lors d’une augmentation de capital, vous recevez des droits qui compensent la dilution de vos titres. Ils ne créent pas de gain : bien utilisés, ils évitent une perte."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text] || '{contenu}'::text[], $wb$"Lors d’une augmentation de capital en numéraire, les actionnaires reçoivent en principe des DPS, en proportion des titres qu’ils détiennent, sauf si l’assemblée générale les a supprimés : la note d’information le précise.\nLe prix de souscription est fixé dans cette note. Au détachement des droits, le cours baisse d’environ leur valeur : c’est la dilution que les droits compensent."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Une augmentation de capital : trois choix$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #> (array['lessons','3','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Lors d’une augmentation de capital en numéraire, les actionnaires reçoivent en principe des DPS, en proportion des titres qu’ils détiennent, sauf si l’assemblée générale les a supprimés : la note d’information le précise.\nLe prix de souscription est fixé dans cette note. Au détachement des droits, le cours baisse d’environ leur valeur : c’est la dilution que les droits compensent."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text] || '{points,1,detail}'::text[], $wb$"Les DPS se négocient pendant la période de souscription : vendre vos droits compense la baisse du cours au détachement, sans rien débourser."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Une augmentation de capital : trois choix$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #> (array['lessons','3','sections', s.idx::text] || '{points,1,detail}'::text[]) is distinct from $wb$"Les DPS se négocient pendant la période de souscription : vendre vos droits compense la baisse du cours au détachement, sans rien débourser."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text] || '{points,2,detail}'::text[], $wb$"À la fin de la période, les droits non utilisés perdent leur valeur : vous subissez la dilution sans compensation. C’est le seul mauvais choix."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Une augmentation de capital : trois choix$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #> (array['lessons','3','sections', s.idx::text] || '{points,2,detail}'::text[]) is distinct from $wb$"À la fin de la période, les droits non utilisés perdent leur valeur : vous subissez la dilution sans compensation. C’est le seul mauvais choix."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text] || '{points,0,titre}'::text[], $wb$"Deux sources de gain, un droit à protéger"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$L’essentiel$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #> (array['lessons','3','sections', s.idx::text] || '{points,0,titre}'::text[]) is distinct from $wb$"Deux sources de gain, un droit à protéger"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text] || '{points,0,detail}'::text[], $wb$"Dividende et plus-value ; les droits de souscription compensent la dilution, ils ne s’ajoutent pas au gain."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$L’essentiel$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #> (array['lessons','3','sections', s.idx::text] || '{points,0,detail}'::text[]) is distinct from $wb$"Dividende et plus-value ; les droits de souscription compensent la dilution, ils ne s’ajoutent pas au gain."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,3,quiz,2,options}', $wb$["Exercer tous ses DPS", "Céder ses DPS sur le marché", "Les laisser expirer", "Céder une partie et exercer l’autre"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #>> '{lessons,3,quiz,2,question}' in ($wb$Une société lance une augmentation de capital. Quel choix fait perdre de l’argent à coup sûr ?$wb$)
   and c.content #> '{lessons,3,quiz,2,options}' is distinct from $wb$["Exercer tous ses DPS", "Céder ses DPS sur le marché", "Les laisser expirer", "Céder une partie et exercer l’autre"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,3,quiz,3,options}', $wb$["Vous gagnez le dividende sans aucune contrepartie", "Le cours baisse d’environ le dividende", "Le dividende vous est refusé par la société", "La société vous rembourse les frais d’achat"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #>> '{lessons,3,quiz,3,question}' in ($wb$Vous achetez une action la veille du détachement, juste pour toucher le dividende. Que se passe-t-il ?$wb$)
   and c.content #> '{lessons,3,quiz,3,options}' is distinct from $wb$["Vous gagnez le dividende sans aucune contrepartie", "Le cours baisse d’environ le dividende", "Le dividende vous est refusé par la société", "La société vous rembourse les frais d’achat"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,3,quiz,4,options}', $wb$["Le dividende est garanti pour l’an prochain", "Il peut baisser ou disparaître", "Il augmentera forcément l’an prochain", "La société ne peut plus le supprimer"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Dividende et plus-value : les deux sources de gain$wb$, $wb$Leçon 4 — Les 3 façons de gagner à la BRVM$wb$)
   and c.content #>> '{lessons,3,quiz,4,question}' in ($wb$Une société a versé un dividende chaque année depuis dix ans. Que pouvez-vous en déduire ?$wb$)
   and c.content #> '{lessons,3,quiz,4,options}' is distinct from $wb$["Le dividende est garanti pour l’an prochain", "Il peut baisser ou disparaître", "Il augmentera forcément l’an prochain", "La société ne peut plus le supprimer"]$wb$::jsonb;

-- academy-niveau-1-initiation · Leçon 5 — Les dividendes : se constituer un revenu régulier  (lecon5-dividendes.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,4,titre}', $wb$"Leçon 5 — Les dividendes : se constituer un revenu régulier"$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Les dividendes : construire un revenu passif grâce à la BRVM$wb$, $wb$Leçon 5 — Les dividendes : se constituer un revenu régulier$wb$)
   and c.content #> '{lessons,4,titre}' is distinct from $wb$"Leçon 5 — Les dividendes : se constituer un revenu régulier"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,4,resume}', $wb$"Un dividende est la part du bénéfice qu’une société cotée verse à ses actionnaires.\nBien compris, il peut devenir une source de revenus régulière, à condition de savoir le calculer, le lire et en mesurer les limites."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Les dividendes : construire un revenu passif grâce à la BRVM$wb$, $wb$Leçon 5 — Les dividendes : se constituer un revenu régulier$wb$)
   and c.content #> '{lessons,4,resume}' is distinct from $wb$"Un dividende est la part du bénéfice qu’une société cotée verse à ses actionnaires.\nBien compris, il peut devenir une source de revenus régulière, à condition de savoir le calculer, le lire et en mesurer les limites."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,4,quiz,2,options}', $wb$["Vendre ses actions dès réception du dividende", "Placer les dividendes sur un compte bancaire", "Réinvestir les dividendes en actions", "Attendre 5 ans avant de toucher à son portefeuille"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Les dividendes : construire un revenu passif grâce à la BRVM$wb$, $wb$Leçon 5 — Les dividendes : se constituer un revenu régulier$wb$)
   and c.content #>> '{lessons,4,quiz,2,question}' in ($wb$Quelle stratégie amplifie vos dividendes par effet boule de neige ?$wb$)
   and c.content #> '{lessons,4,quiz,2,options}' is distinct from $wb$["Vendre ses actions dès réception du dividende", "Placer les dividendes sur un compte bancaire", "Réinvestir les dividendes en actions", "Attendre 5 ans avant de toucher à son portefeuille"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,4,quiz,4,options}', $wb$["C’est forcément un excellent placement", "Le dividende va augmenter l’an prochain", "Il faut vérifier d’où vient ce chiffre", "La société est sûrement la plus rentable du marché"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Les dividendes : construire un revenu passif grâce à la BRVM$wb$, $wb$Leçon 5 — Les dividendes : se constituer un revenu régulier$wb$)
   and c.content #>> '{lessons,4,quiz,4,question}' in ($wb$Une action affiche un rendement de 15 %, bien au-dessus des autres. Que peut-on en conclure ?$wb$)
   and c.content #> '{lessons,4,quiz,4,options}' is distinct from $wb$["C’est forcément un excellent placement", "Le dividende va augmenter l’an prochain", "Il faut vérifier d’où vient ce chiffre", "La société est sûrement la plus rentable du marché"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','4','sections', s.idx::text] || '{contenu}'::text[], $wb$"Un investisseur détient 300 actions. La société verse 1 000 FCFA par action, et l’action cote 10 000 FCFA.\nIl perçoit 300 000 FCFA bruts dans l’année, soit un rendement de 10 % au cours de 10 000 FCFA. Ces chiffres sont pédagogiques : ils ne décrivent aucune société cotée.\nLe tableau qui suit applique le même calcul à quatre valeurs de la BRVM : dernier dividende enregistré, cours de la dernière séance, rendement, et revenu pour 300 actions.\nAttention : le tableau donne des montants nets d’impôt, tels que versés ; l’exemple ci-dessus est brut."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->4->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Un exemple chiffré$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Les dividendes : construire un revenu passif grâce à la BRVM$wb$, $wb$Leçon 5 — Les dividendes : se constituer un revenu régulier$wb$)
   and c.content #> (array['lessons','4','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Un investisseur détient 300 actions. La société verse 1 000 FCFA par action, et l’action cote 10 000 FCFA.\nIl perçoit 300 000 FCFA bruts dans l’année, soit un rendement de 10 % au cours de 10 000 FCFA. Ces chiffres sont pédagogiques : ils ne décrivent aucune société cotée.\nLe tableau qui suit applique le même calcul à quatre valeurs de la BRVM : dernier dividende enregistré, cours de la dernière séance, rendement, et revenu pour 300 actions.\nAttention : le tableau donne des montants nets d’impôt, tels que versés ; l’exemple ci-dessus est brut."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','4','sections', s.idx::text] || '{etapes,2,detail}'::text[], $wb$"Le dividende est versé sur le compte espèces associé à votre compte-titres, par votre SGI."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->4->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Les dates qui comptent$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Les dividendes : construire un revenu passif grâce à la BRVM$wb$, $wb$Leçon 5 — Les dividendes : se constituer un revenu régulier$wb$)
   and c.content #> (array['lessons','4','sections', s.idx::text] || '{etapes,2,detail}'::text[]) is distinct from $wb$"Le dividende est versé sur le compte espèces associé à votre compte-titres, par votre SGI."$wb$::jsonb;

-- academy-niveau-1-initiation · Leçon 6 — Les risques : apprendre avant d’investir  (lecon6-risques.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,5,titre}', $wb$"Leçon 6 — Les risques : apprendre avant d’investir"$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les risques : apprendre avant d'investir$wb$, $wb$Leçon 6 — Les risques : apprendre avant d’investir$wb$)
   and c.content #> '{lessons,5,titre}' is distinct from $wb$"Leçon 6 — Les risques : apprendre avant d’investir"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','5','sections', s.idx::text] || '{titre}'::text[], $wb$"Le dividende varie : quatre historiques réels"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->5->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Le dividende varie : quatre historiques réels$wb$, $wb$Quand le dividende baisse : des cas réels$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les risques : apprendre avant d'investir$wb$, $wb$Leçon 6 — Les risques : apprendre avant d’investir$wb$)
   and c.content #> (array['lessons','5','sections', s.idx::text] || '{titre}'::text[]) is distinct from $wb$"Le dividende varie : quatre historiques réels"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','5','sections', s.idx::text] || '{contenu}'::text[], $wb$"Un dividende dépend des bénéfices, de la trésorerie, des investissements à financer et de la décision de l’assemblée générale. Il n’est jamais garanti. Voici l’historique de quatre sociétés cotées, lu dans la base WestBourse à l’ouverture de la leçon.\nRepérez les années où le dividende a baissé, et celles où il a progressé.\nAvant de choisir une action pour son dividende, posez-vous quatre questions."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->5->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Le dividende varie : quatre historiques réels$wb$, $wb$Quand le dividende baisse : des cas réels$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les risques : apprendre avant d'investir$wb$, $wb$Leçon 6 — Les risques : apprendre avant d’investir$wb$)
   and c.content #> (array['lessons','5','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Un dividende dépend des bénéfices, de la trésorerie, des investissements à financer et de la décision de l’assemblée générale. Il n’est jamais garanti. Voici l’historique de quatre sociétés cotées, lu dans la base WestBourse à l’ouverture de la leçon.\nRepérez les années où le dividende a baissé, et celles où il a progressé.\nAvant de choisir une action pour son dividende, posez-vous quatre questions."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','5','sections', s.idx::text] || '{points,0,detail}'::text[], $wb$"Répartir entre plusieurs sociétés et secteurs. Repères pédagogiques pour un débutant : pas plus de 20 % sur une société, ni plus de 35 % sur un secteur."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->5->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Trois protections, et l’effet de la diversification$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les risques : apprendre avant d'investir$wb$, $wb$Leçon 6 — Les risques : apprendre avant d’investir$wb$)
   and c.content #> (array['lessons','5','sections', s.idx::text] || '{points,0,detail}'::text[]) is distinct from $wb$"Répartir entre plusieurs sociétés et secteurs. Repères pédagogiques pour un débutant : pas plus de 20 % sur une société, ni plus de 35 % sur un secteur."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,5,quiz,0,options}', $wb$["Parce que les dividendes y sont imposés à la source", "Parce que la bourse est réservée aux résidents ivoiriens", "Parce qu’il faudrait peut-être vendre en pleine baisse", "Parce que les SGI refusent les petits montants"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les risques : apprendre avant d'investir$wb$, $wb$Leçon 6 — Les risques : apprendre avant d’investir$wb$)
   and c.content #>> '{lessons,5,quiz,0,question}' in ($wb$Pourquoi ne faut-il pas investir son épargne d’urgence en bourse ?$wb$)
   and c.content #> '{lessons,5,quiz,0,options}' is distinct from $wb$["Parce que les dividendes y sont imposés à la source", "Parce que la bourse est réservée aux résidents ivoiriens", "Parce qu’il faudrait peut-être vendre en pleine baisse", "Parce que les SGI refusent les petits montants"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,5,quiz,3,options}', $wb$["La perte de valeur due à l’inflation chaque année", "La difficulté à vendre sans faire baisser le prix", "La faillite d’une société cotée", "La variation du franc CFA face au dollar"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les risques : apprendre avant d'investir$wb$, $wb$Leçon 6 — Les risques : apprendre avant d’investir$wb$)
   and c.content #>> '{lessons,5,quiz,3,question}' in ($wb$Qu’appelle-t-on le risque de liquidité ?$wb$)
   and c.content #> '{lessons,5,quiz,3,options}' is distinct from $wb$["La perte de valeur due à l’inflation chaque année", "La difficulté à vendre sans faire baisser le prix", "La faillite d’une société cotée", "La variation du franc CFA face au dollar"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,5,quiz,5,options}', $wb$["L’ordre est exécuté tout de suite à 3 280 FCFA", "L’ordre attend un vendeur à 3 270 FCFA ou moins", "L’ordre est exécuté à 3 270 FCFA, quoi qu’il arrive ensuite", "La BRVM rejette l’ordre"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les risques : apprendre avant d'investir$wb$, $wb$Leçon 6 — Les risques : apprendre avant d’investir$wb$)
   and c.content #>> '{lessons,5,quiz,5,question}' in ($wb$Vous passez un ordre d’achat à cours limité à 3 270 FCFA ; le vendeur le moins cher demande 3 280 FCFA. Que se passe-t-il ?$wb$)
   and c.content #> '{lessons,5,quiz,5,options}' is distinct from $wb$["L’ordre est exécuté tout de suite à 3 280 FCFA", "L’ordre attend un vendeur à 3 270 FCFA ou moins", "L’ordre est exécuté à 3 270 FCFA, quoi qu’il arrive ensuite", "La BRVM rejette l’ordre"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,5,quiz,7,options}', $wb$["Mensuel, jusqu’à la fin du mois en cours", "Jour : valable une seule séance", "À exécution, valable pendant trois mois", "Annulé avant même d’être transmis"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les risques : apprendre avant d'investir$wb$, $wb$Leçon 6 — Les risques : apprendre avant d’investir$wb$)
   and c.content #>> '{lessons,5,quiz,7,question}' in ($wb$Vous ne précisez pas la durée de validité de votre ordre. Comment est-il considéré ?$wb$)
   and c.content #> '{lessons,5,quiz,7,options}' is distinct from $wb$["Mensuel, jusqu’à la fin du mois en cours", "Jour : valable une seule séance", "À exécution, valable pendant trois mois", "Annulé avant même d’être transmis"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,5,qcm,options}', $wb$["Parce que les dividendes y sont imposés à la source", "Parce que la bourse est réservée aux résidents ivoiriens", "Parce qu’il faudrait peut-être vendre en pleine baisse", "Parce que les SGI refusent les petits montants"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les risques : apprendre avant d'investir$wb$, $wb$Leçon 6 — Les risques : apprendre avant d’investir$wb$)
   and c.content #>> '{lessons,5,qcm,question}' in ($wb$Pourquoi ne faut-il pas investir son épargne d’urgence en bourse ?$wb$)
   and c.content #> '{lessons,5,qcm,options}' is distinct from $wb$["Parce que les dividendes y sont imposés à la source", "Parce que la bourse est réservée aux résidents ivoiriens", "Parce qu’il faudrait peut-être vendre en pleine baisse", "Parce que les SGI refusent les petits montants"]$wb$::jsonb;

-- academy-niveau-1-initiation · Leçon 7 — Cas pratique : financer la scolarité de vos enfants  (lecon7-scolarite.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,6,quiz,2,options}', $wb$["Parce que les dividendes cessent avant l’échéance", "Pour ne pas vendre en baisse au mauvais moment", "Parce que les SGI ferment les comptes des parents", "Pour payer moins de frais de courtage"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->6->>'titre' in ($wb$Leçon 7 — Cas pratique : financer la scolarité de vos enfants$wb$)
   and c.content #>> '{lessons,6,quiz,2,question}' in ($wb$Pourquoi réduire la part en actions quelques années avant les études ?$wb$)
   and c.content #> '{lessons,6,quiz,2,options}' is distinct from $wb$["Parce que les dividendes cessent avant l’échéance", "Pour ne pas vendre en baisse au mauvais moment", "Parce que les SGI ferment les comptes des parents", "Pour payer moins de frais de courtage"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,6,quiz,4,options}', $wb$["À payer les frais de scolarité chaque année", "À accroître les dividendes futurs", "À éviter tout risque de baisse du capital", "À garantir le rendement du projet"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->6->>'titre' in ($wb$Leçon 7 — Cas pratique : financer la scolarité de vos enfants$wb$)
   and c.content #>> '{lessons,6,quiz,4,question}' in ($wb$Dans ce projet, à quoi sert le réinvestissement des dividendes ?$wb$)
   and c.content #> '{lessons,6,quiz,4,options}' is distinct from $wb$["À payer les frais de scolarité chaque année", "À accroître les dividendes futurs", "À éviter tout risque de baisse du capital", "À garantir le rendement du projet"]$wb$::jsonb;

-- academy-niveau-1-initiation · Leçon 8 — Trois stratégies d’investissement à la BRVM  (lecon8-strategies.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{titre}'::text[], $wb$"Revenu : des dividendes à suivre dans le temps"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Revenu : des dividendes qui progressent$wb$, $wb$Revenu : des dividendes à suivre dans le temps$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — Trois stratégies d’investissement à la BRVM$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{titre}'::text[]) is distinct from $wb$"Revenu : des dividendes à suivre dans le temps"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{contenu}'::text[], $wb$"Une stratégie de revenu recherche des distributions régulières, idéalement croissantes.\nLe tableau montre l’historique de quatre valeurs de la BRVM : repérez celles dont le dividende a progressé, et celles où il a reculé. Le passé ne garantit pas la suite : la régularité se vérifie chaque année."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Revenu : des dividendes qui progressent$wb$, $wb$Revenu : des dividendes à suivre dans le temps$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — Trois stratégies d’investissement à la BRVM$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Une stratégie de revenu recherche des distributions régulières, idéalement croissantes.\nLe tableau montre l’historique de quatre valeurs de la BRVM : repérez celles dont le dividende a progressé, et celles où il a reculé. Le passé ne garantit pas la suite : la régularité se vérifie chaque année."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{tableau,lignes,1,3}'::text[], $wb$"Recherche un revenu régulier"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Associer stratégie et horizon$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — Trois stratégies d’investissement à la BRVM$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{tableau,lignes,1,3}'::text[]) is distinct from $wb$"Recherche un revenu régulier"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{points,1,titre}'::text[], $wb$"La stratégie revenu demande le moins de suivi quotidien"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$L’essentiel$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — Trois stratégies d’investissement à la BRVM$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{points,1,titre}'::text[]) is distinct from $wb$"La stratégie revenu demande le moins de suivi quotidien"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{points,1,detail}'::text[], $wb$"Elle repose sur des dividendes votés chaque année, pas sur le cours du jour."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$L’essentiel$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — Trois stratégies d’investissement à la BRVM$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{points,1,detail}'::text[]) is distinct from $wb$"Elle repose sur des dividendes votés chaque année, pas sur le cours du jour."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,7,quiz,0,question}', $wb$"Quelle stratégie vise d’abord un revenu régulier ?"$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — Trois stratégies d’investissement à la BRVM$wb$)
   and c.content #>> '{lessons,7,quiz,0,question}' in ($wb$Quelle stratégie vise d’abord un revenu régulier ?$wb$, $wb$Un débutant qui veut un revenu régulier choisit plutôt :$wb$)
   and c.content #> '{lessons,7,quiz,0,question}' is distinct from $wb$"Quelle stratégie vise d’abord un revenu régulier ?"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,7,quiz,0,explication}', $wb$"La stratégie revenu vise des dividendes réguliers, encaissés ou réinvestis. Elle demande peu de suivi quotidien."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — Trois stratégies d’investissement à la BRVM$wb$)
   and c.content #>> '{lessons,7,quiz,0,question}' in ($wb$Quelle stratégie vise d’abord un revenu régulier ?$wb$, $wb$Un débutant qui veut un revenu régulier choisit plutôt :$wb$)
   and c.content #> '{lessons,7,quiz,0,explication}' is distinct from $wb$"La stratégie revenu vise des dividendes réguliers, encaissés ou réinvestis. Elle demande peu de suivi quotidien."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,7,quiz,2,options}', $wb$["Oui, dans tous les cas", "Non : les bénéfices peuvent reculer", "Oui, dès qu’il est inférieur à 20", "Non, un PER bas est toujours mauvais signe"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — Trois stratégies d’investissement à la BRVM$wb$)
   and c.content #>> '{lessons,7,quiz,2,question}' in ($wb$Un PER très bas signifie-t-il toujours une bonne affaire ?$wb$)
   and c.content #> '{lessons,7,quiz,2,options}' is distinct from $wb$["Oui, dans tous les cas", "Non : les bénéfices peuvent reculer", "Oui, dès qu’il est inférieur à 20", "Non, un PER bas est toujours mauvais signe"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,7,qcm,question}', $wb$"Quelle stratégie vise d’abord un revenu régulier ?"$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — Trois stratégies d’investissement à la BRVM$wb$)
   and c.content #>> '{lessons,7,qcm,question}' in ($wb$Quelle stratégie vise d’abord un revenu régulier ?$wb$, $wb$Un débutant qui veut un revenu régulier choisit plutôt :$wb$)
   and c.content #> '{lessons,7,qcm,question}' is distinct from $wb$"Quelle stratégie vise d’abord un revenu régulier ?"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,7,qcm,explication}', $wb$"La stratégie revenu vise des dividendes réguliers, encaissés ou réinvestis. Elle demande peu de suivi quotidien."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — Trois stratégies d’investissement à la BRVM$wb$)
   and c.content #>> '{lessons,7,qcm,question}' in ($wb$Quelle stratégie vise d’abord un revenu régulier ?$wb$, $wb$Un débutant qui veut un revenu régulier choisit plutôt :$wb$)
   and c.content #> '{lessons,7,qcm,explication}' is distinct from $wb$"La stratégie revenu vise des dividendes réguliers, encaissés ou réinvestis. Elle demande peu de suivi quotidien."$wb$::jsonb;

-- academy-niveau-1-initiation · Leçon 9 — Ouvrir un compte et passer son premier ordre  (lecon9-compte-ordre.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','8','sections', s.idx::text] || '{contenu}'::text[], $wb$"Les SGI se distinguent par leurs frais, leur plateforme et leur service. Leur liste complète et à jour figure dans l’annuaire des SGI agréées, publié par la BRVM et par l’AMF-UMOA : vérifiez-y le nom exact de celle que vous choisissez."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->8->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Choisir sa SGI$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$)
   and c.content #> (array['lessons','8','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Les SGI se distinguent par leurs frais, leur plateforme et leur service. Leur liste complète et à jour figure dans l’annuaire des SGI agréées, publié par la BRVM et par l’AMF-UMOA : vérifiez-y le nom exact de celle que vous choisissez."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','8','sections', s.idx::text] || '{contenu}'::text[], $wb$"Le type d’ordre décide du prix que vous acceptez de payer. C’est le réflexe le plus important du premier achat.\nLe règlement de la BRVM parle d’ordre « à cours limité » et d’ordre « au mieux ». Le détail des règles (validité, tout ou rien) est en leçon 6."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->8->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Deux types d’ordres$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$)
   and c.content #> (array['lessons','8','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Le type d’ordre décide du prix que vous acceptez de payer. C’est le réflexe le plus important du premier achat.\nLe règlement de la BRVM parle d’ordre « à cours limité » et d’ordre « au mieux ». Le détail des règles (validité, tout ou rien) est en leçon 6."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','8','sections', s.idx::text] || '{points,0,detail}'::text[], $wb$"Vous fixez un prix maximum. Pour un achat, l’ordre ne s’exécute qu’à ce prix ou en dessous ; sinon il reste en attente pendant sa durée de validité (une seule séance par défaut)."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->8->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Deux types d’ordres$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$)
   and c.content #> (array['lessons','8','sections', s.idx::text] || '{points,0,detail}'::text[]) is distinct from $wb$"Vous fixez un prix maximum. Pour un achat, l’ordre ne s’exécute qu’à ce prix ou en dessous ; sinon il reste en attente pendant sa durée de validité (une seule séance par défaut)."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','8','sections', s.idx::text] || '{points,1,titre}'::text[], $wb$"L’ordre au mieux"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->8->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Deux types d’ordres$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$)
   and c.content #> (array['lessons','8','sections', s.idx::text] || '{points,1,titre}'::text[]) is distinct from $wb$"L’ordre au mieux"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','8','sections', s.idx::text] || '{donnees_reelles,vue}'::text[], $wb$"cours"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->8->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Sur la BRVM : le prix de 20 actions$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$)
   and c.content #> (array['lessons','8','sections', s.idx::text] || '{donnees_reelles,vue}'::text[]) is distinct from $wb$"cours"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','8','sections', s.idx::text] || '{points,0,titre}'::text[], $wb$"Passer un ordre au mieux sur une valeur peu échangée"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->8->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-1-initiation' and e.v->>'titre' in ($wb$Les erreurs à éviter$wb$)) s
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$)
   and c.content #> (array['lessons','8','sections', s.idx::text] || '{points,0,titre}'::text[]) is distinct from $wb$"Passer un ordre au mieux sur une valeur peu échangée"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,8,quiz,0,question}', $wb$"Quel type d’ordre permet de contrôler son prix d’achat ?"$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$)
   and c.content #>> '{lessons,8,quiz,0,question}' in ($wb$Quel est le meilleur type d’ordre pour un investisseur débutant ?$wb$, $wb$Quel type d’ordre permet de contrôler son prix d’achat ?$wb$)
   and c.content #> '{lessons,8,quiz,0,question}' is distinct from $wb$"Quel type d’ordre permet de contrôler son prix d’achat ?"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,8,quiz,0,options}', $wb$["Ordre au mieux, pour être servi au plus vite", "Ordre à cours limité, avec un prix maximum", "Ordre stop, déclenché à un seuil de prix", "Aucun : tous les ordres se valent"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$)
   and c.content #>> '{lessons,8,quiz,0,question}' in ($wb$Quel est le meilleur type d’ordre pour un investisseur débutant ?$wb$, $wb$Quel type d’ordre permet de contrôler son prix d’achat ?$wb$)
   and c.content #> '{lessons,8,quiz,0,options}' is distinct from $wb$["Ordre au mieux, pour être servi au plus vite", "Ordre à cours limité, avec un prix maximum", "Ordre stop, déclenché à un seuil de prix", "Aucun : tous les ordres se valent"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,8,quiz,4,options}', $wb$["À 10 000 FCFA ou moins", "Seulement au-dessus de 10 000 FCFA", "Toujours immédiatement, quel que soit le prix", "Au cours d’ouverture, quel qu’il soit"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$)
   and c.content #>> '{lessons,8,quiz,4,question}' in ($wb$Un ordre d’achat à cours limité à 10 000 FCFA s’exécute :$wb$)
   and c.content #> '{lessons,8,quiz,4,options}' is distinct from $wb$["À 10 000 FCFA ou moins", "Seulement au-dessus de 10 000 FCFA", "Toujours immédiatement, quel que soit le prix", "Au cours d’ouverture, quel qu’il soit"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,8,quiz,4,explication}', $wb$"Pour un achat, la limite est un prix maximum : l’ordre s’exécute à 10 000 FCFA ou en dessous ; sinon il reste en attente pendant sa durée de validité."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$)
   and c.content #>> '{lessons,8,quiz,4,question}' in ($wb$Un ordre d’achat à cours limité à 10 000 FCFA s’exécute :$wb$)
   and c.content #> '{lessons,8,quiz,4,explication}' is distinct from $wb$"Pour un achat, la limite est un prix maximum : l’ordre s’exécute à 10 000 FCFA ou en dessous ; sinon il reste en attente pendant sa durée de validité."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,8,qcm,question}', $wb$"Quel type d’ordre permet de contrôler son prix d’achat ?"$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$)
   and c.content #>> '{lessons,8,qcm,question}' in ($wb$Quel est le meilleur type d’ordre pour un investisseur débutant ?$wb$, $wb$Quel type d’ordre permet de contrôler son prix d’achat ?$wb$)
   and c.content #> '{lessons,8,qcm,question}' is distinct from $wb$"Quel type d’ordre permet de contrôler son prix d’achat ?"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,8,qcm,options}', $wb$["Ordre au mieux, pour être servi au plus vite", "Ordre à cours limité, avec un prix maximum", "Ordre stop, déclenché à un seuil de prix", "Aucun : tous les ordres se valent"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-1-initiation'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Ouvrir un compte et passer son premier ordre$wb$)
   and c.content #>> '{lessons,8,qcm,question}' in ($wb$Quel est le meilleur type d’ordre pour un investisseur débutant ?$wb$, $wb$Quel type d’ordre permet de contrôler son prix d’achat ?$wb$)
   and c.content #> '{lessons,8,qcm,options}' is distinct from $wb$["Ordre au mieux, pour être servi au plus vite", "Ordre à cours limité, avec un prix maximum", "Ordre stop, déclenché à un seuil de prix", "Aucun : tous les ordres se valent"]$wb$::jsonb;

-- academy-niveau-2-fondamental · Leçon 1 — Lire un rapport annuel  (niveau2/l01-rapport-annuel.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text] || '{contenu}'::text[], $wb$"Les sociétés cotées à la BRVM tiennent leurs comptes selon le SYSCOHADA révisé et, quand elles publient des comptes consolidés, établissent ceux du groupe selon les normes IFRS. Les banques suivent le plan comptable bancaire de l’UMOA, les assureurs le plan comptable du code CIMA. Le vocabulaire diffère un peu, la logique est la même : chaque document répond à une question précise.\nLe bilan dit ce que la société possède et ce qu’elle doit, à une date donnée. Le compte de résultat dit ce qu’elle a gagné ou perdu pendant l’année. Le tableau des flux dit si ce gain s’est transformé en argent disponible. Les notes et le rapport des commissaires aux comptes disent comment lire les trois premiers, et s’ils sont fiables.\nLire une seule pièce conduit souvent à une erreur. Un bénéfice élevé peut cacher une trésorerie qui fond. Des fonds propres solides peuvent cacher une activité qui recule. C’est en croisant les quatre que l’on se fait une idée juste de la société."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les quatre pièces d’un rapport annuel$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un rapport annuel$wb$)
   and c.content #> (array['lessons','0','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Les sociétés cotées à la BRVM tiennent leurs comptes selon le SYSCOHADA révisé et, quand elles publient des comptes consolidés, établissent ceux du groupe selon les normes IFRS. Les banques suivent le plan comptable bancaire de l’UMOA, les assureurs le plan comptable du code CIMA. Le vocabulaire diffère un peu, la logique est la même : chaque document répond à une question précise.\nLe bilan dit ce que la société possède et ce qu’elle doit, à une date donnée. Le compte de résultat dit ce qu’elle a gagné ou perdu pendant l’année. Le tableau des flux dit si ce gain s’est transformé en argent disponible. Les notes et le rapport des commissaires aux comptes disent comment lire les trois premiers, et s’ils sont fiables.\nLire une seule pièce conduit souvent à une erreur. Un bénéfice élevé peut cacher une trésorerie qui fond. Des fonds propres solides peuvent cacher une activité qui recule. C’est en croisant les quatre que l’on se fait une idée juste de la société."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,0,quiz,2,options}', $wb$["Les ventes et les charges de toute l’année", "Le patrimoine et son financement, à une date", "L’argent entré et sorti de la société dans l’année", "Le cours moyen de l’action sur l’exercice"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un rapport annuel$wb$)
   and c.content #>> '{lessons,0,quiz,2,question}' in ($wb$Que montre le bilan ?$wb$)
   and c.content #> '{lessons,0,quiz,2,options}' is distinct from $wb$["Les ventes et les charges de toute l’année", "Le patrimoine et son financement, à une date", "L’argent entré et sorti de la société dans l’année", "Le cours moyen de l’action sur l’exercice"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,0,quiz,3,options}', $wb$["Il est toujours plus élevé que le résultat net", "Il montre l’activité courante", "Il inclut le dividende versé aux actionnaires", "Il est le seul chiffre certifié des comptes"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un rapport annuel$wb$)
   and c.content #>> '{lessons,0,quiz,3,question}' in ($wb$Pourquoi regarder le résultat d’exploitation, pas seulement le résultat net ?$wb$)
   and c.content #> '{lessons,0,quiz,3,options}' is distinct from $wb$["Il est toujours plus élevé que le résultat net", "Il montre l’activité courante", "Il inclut le dividende versé aux actionnaires", "Il est le seul chiffre certifié des comptes"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,0,quiz,4,options}', $wb$["Ne peuvent plus changer une fois publiés", "Peuvent encore être modifiés", "Sont faux tant qu’ils ne sont pas approuvés", "Ne sont communiqués qu’aux administrateurs"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un rapport annuel$wb$)
   and c.content #>> '{lessons,0,quiz,4,question}' in ($wb$Des états financiers publiés « provisoires, non approuvés par l’assemblée générale » :$wb$)
   and c.content #> '{lessons,0,quiz,4,options}' is distinct from $wb$["Ne peuvent plus changer une fois publiés", "Peuvent encore être modifiés", "Sont faux tant qu’ils ne sont pas approuvés", "Ne sont communiqués qu’aux administrateurs"]$wb$::jsonb;

-- academy-niveau-2-fondamental · Leçon 2 — Le PER : évaluer la cherté d’une action  (niveau2/l02-per.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','1','sections', s.idx::text] || '{stats,1,valeur}'::text[], $wb$"8 à 20"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->1->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Ce que le PER raconte$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->1->>'titre' in ($wb$Leçon 2 — Le PER : évaluer la cherté d’une action$wb$)
   and c.content #> (array['lessons','1','sections', s.idx::text] || '{stats,1,valeur}'::text[]) is distinct from $wb$"8 à 20"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','1','sections', s.idx::text] || '{tableau,note}'::text[], $wb$"WestBourse utilise le PER historique, sur le résultat consolidé quand la société publie des comptes consolidés. Pour un groupe dont des actionnaires minoritaires détiennent une part des filiales (Sonatel, par exemple), le PER affiché paraît donc plus bas que celui calculé sur la part du groupe."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->1->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les trois PER qu’on rencontre$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->1->>'titre' in ($wb$Leçon 2 — Le PER : évaluer la cherté d’une action$wb$)
   and c.content #> (array['lessons','1','sections', s.idx::text] || '{tableau,note}'::text[]) is distinct from $wb$"WestBourse utilise le PER historique, sur le résultat consolidé quand la société publie des comptes consolidés. Pour un groupe dont des actionnaires minoritaires détiennent une part des filiales (Sonatel, par exemple), le PER affiché paraît donc plus bas que celui calculé sur la part du groupe."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,1,quiz,2,options}', $wb$["Acheter immédiatement, avant la hausse", "Chercher d’abord pourquoi", "Vendre immédiatement si vous en détenez", "Ignorer le PER, qui n’a aucun sens"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->1->>'titre' in ($wb$Leçon 2 — Le PER : évaluer la cherté d’une action$wb$)
   and c.content #>> '{lessons,1,quiz,2,question}' in ($wb$Une société a un PER de 4, nettement sous ses concurrents. Quelle est la bonne réaction ?$wb$)
   and c.content #> '{lessons,1,quiz,2,options}' is distinct from $wb$["Acheter immédiatement, avant la hausse", "Chercher d’abord pourquoi", "Vendre immédiatement si vous en détenez", "Ignorer le PER, qui n’a aucun sens"]$wb$::jsonb;

-- academy-niveau-2-fondamental · Leçon 3 — P/B, ROE et rendement : les ratios complémentaires  (niveau2/l03-pb-roe.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,2,quiz,3,options}', $wb$["Il signifie que la société est surévaluée", "Il peut venir de fonds propres trop faibles", "Il réduit forcément le dividende versé", "Il n’est pas publié par les sociétés de la BRVM"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->2->>'titre' in ($wb$Leçon 3 — P/B, ROE et rendement : les ratios complémentaires$wb$)
   and c.content #>> '{lessons,2,quiz,3,question}' in ($wb$Pourquoi un ROE très élevé n’est-il pas toujours une bonne nouvelle ?$wb$)
   and c.content #> '{lessons,2,quiz,3,options}' is distinct from $wb$["Il signifie que la société est surévaluée", "Il peut venir de fonds propres trop faibles", "Il réduit forcément le dividende versé", "Il n’est pas publié par les sociétés de la BRVM"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,2,quiz,4,options}', $wb$["C’est forcément une bonne affaire à saisir", "Il faut chercher pourquoi", "La société va bientôt faire faillite", "Le ratio est faux, la valeur comptable aussi"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->2->>'titre' in ($wb$Leçon 3 — P/B, ROE et rendement : les ratios complémentaires$wb$)
   and c.content #>> '{lessons,2,quiz,4,question}' in ($wb$Une action cote sous sa valeur comptable (P/B inférieur à 1). Que faut-il en conclure ?$wb$)
   and c.content #> '{lessons,2,quiz,4,options}' is distinct from $wb$["C’est forcément une bonne affaire à saisir", "Il faut chercher pourquoi", "La société va bientôt faire faillite", "Le ratio est faux, la valeur comptable aussi"]$wb$::jsonb;

-- academy-niveau-2-fondamental · Leçon 4 — Analyser une banque cotée  (niveau2/l04-banques.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,3,sous_titre}', $wb$"Les banques et sociétés financières forment une part importante de la cote de la BRVM. Elles se lisent avec leurs propres indicateurs."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Analyser une banque cotée$wb$)
   and c.content #> '{lessons,3,sous_titre}' is distinct from $wb$"Les banques et sociétés financières forment une part importante de la cote de la BRVM. Elles se lisent avec leurs propres indicateurs."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,3,quiz,2,options}', $wb$["Le prix de l’action sur la dernière année", "Les pertes probables sur les prêts", "Les salaires et frais généraux", "Le dividende versé par action"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Analyser une banque cotée$wb$)
   and c.content #>> '{lessons,3,quiz,2,question}' in ($wb$Que mesure le coût du risque ?$wb$)
   and c.content #> '{lessons,3,quiz,2,options}' is distinct from $wb$["Le prix de l’action sur la dernière année", "Les pertes probables sur les prêts", "Les salaires et frais généraux", "Le dividende versé par action"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,3,quiz,3,options}', $wb$["Les banques n’ont pas de dettes au bilan", "Les dépôts sont des dettes : c’est son métier", "Il est interdit de le publier pour une banque cotée", "Il vaut toujours zéro pour une banque"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Analyser une banque cotée$wb$)
   and c.content #>> '{lessons,3,quiz,3,question}' in ($wb$Pourquoi un ratio d’endettement classique n’a-t-il pas de sens pour une banque ?$wb$)
   and c.content #> '{lessons,3,quiz,3,options}' is distinct from $wb$["Les banques n’ont pas de dettes au bilan", "Les dépôts sont des dettes : c’est son métier", "Il est interdit de le publier pour une banque cotée", "Il vaut toujours zéro pour une banque"]$wb$::jsonb;

-- academy-niveau-2-fondamental · Leçon 5 — Diversification et allocation d’actifs  (niveau2/l05-diversification.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','4','sections', s.idx::text] || '{contenu}'::text[], $wb$"Selon les études, souvent anciennes, menées sur les grands marchés, une grande partie du risque propre disparaît avec une à quelques dizaines de lignes, selon la méthode retenue. Au-delà, chaque ligne supplémentaire réduit très peu le risque et complique le suivi. Le graphique de la leçon illustre cette courbe avec des valeurs d’exemple.\nÀ la BRVM, avec une cinquantaine de sociétés et des secteurs concentrés, viser 8 à 15 lignes réparties sur plusieurs secteurs est un repère raisonnable.\nCe repère dépend aussi de la somme investie. Avec un petit capital, multiplier les lignes oblige à passer de petits ordres, sur lesquels les frais minimum de courtage pèsent lourd. Mieux vaut alors construire le portefeuille progressivement, ligne après ligne, que d’acheter quinze valeurs d’un coup avec de très petits montants."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->4->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Combien de lignes ?$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Diversification et allocation d’actifs$wb$)
   and c.content #> (array['lessons','4','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Selon les études, souvent anciennes, menées sur les grands marchés, une grande partie du risque propre disparaît avec une à quelques dizaines de lignes, selon la méthode retenue. Au-delà, chaque ligne supplémentaire réduit très peu le risque et complique le suivi. Le graphique de la leçon illustre cette courbe avec des valeurs d’exemple.\nÀ la BRVM, avec une cinquantaine de sociétés et des secteurs concentrés, viser 8 à 15 lignes réparties sur plusieurs secteurs est un repère raisonnable.\nCe repère dépend aussi de la somme investie. Avec un petit capital, multiplier les lignes oblige à passer de petits ordres, sur lesquels les frais minimum de courtage pèsent lourd. Mieux vaut alors construire le portefeuille progressivement, ligne après ligne, que d’acheter quinze valeurs d’un coup avec de très petits montants."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','4','sections', s.idx::text] || '{contenu}'::text[], $wb$"Une bonne répartition se vérifie sur quatre axes. Le nombre de lignes n’en est qu’un, et ce n’est pas le plus important.\nLe poids de la première ligne compte davantage : un portefeuille de quinze valeurs dont une pèse la moitié est en réalité concentré. Le secteur vient ensuite. À la BRVM, il est facile d’accumuler des banques sans s’en rendre compte, car elles sont nombreuses à la cote.\nLe pays est un axe propre à l’UEMOA. Toutes les sociétés sont cotées sur le même marché, mais leur activité dépend de l’économie d’un pays, ou de plusieurs : c’est le pays de l’activité qui compte. Enfin, la part d’obligations dépend de votre horizon et de la baisse que vous pouvez supporter : plus l’échéance de votre projet est proche, plus elle mérite d’être importante.\nExemple fictif : un portefeuille de 3 000 000 FCFA réparti en dix lignes égales de 300 000 FCFA ne dépasse jamais 10 % par ligne. S’il contient six banques, il dépasse pourtant de loin 35 % sur un seul secteur."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->4->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les quatre dimensions de la répartition$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Diversification et allocation d’actifs$wb$)
   and c.content #> (array['lessons','4','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Une bonne répartition se vérifie sur quatre axes. Le nombre de lignes n’en est qu’un, et ce n’est pas le plus important.\nLe poids de la première ligne compte davantage : un portefeuille de quinze valeurs dont une pèse la moitié est en réalité concentré. Le secteur vient ensuite. À la BRVM, il est facile d’accumuler des banques sans s’en rendre compte, car elles sont nombreuses à la cote.\nLe pays est un axe propre à l’UEMOA. Toutes les sociétés sont cotées sur le même marché, mais leur activité dépend de l’économie d’un pays, ou de plusieurs : c’est le pays de l’activité qui compte. Enfin, la part d’obligations dépend de votre horizon et de la baisse que vous pouvez supporter : plus l’échéance de votre projet est proche, plus elle mérite d’être importante.\nExemple fictif : un portefeuille de 3 000 000 FCFA réparti en dix lignes égales de 300 000 FCFA ne dépasse jamais 10 % par ligne. S’il contient six banques, il dépasse pourtant de loin 35 % sur un seul secteur."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','4','sections', s.idx::text] || '{tableau,lignes,0,2}'::text[], $wb$"Pas plus de 20 % du portefeuille"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->4->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les quatre dimensions de la répartition$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Diversification et allocation d’actifs$wb$)
   and c.content #> (array['lessons','4','sections', s.idx::text] || '{tableau,lignes,0,2}'::text[]) is distinct from $wb$"Pas plus de 20 % du portefeuille"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','4','sections', s.idx::text] || '{tableau,lignes,1,2}'::text[], $wb$"Pas plus de 35 % sur un seul secteur"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->4->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les quatre dimensions de la répartition$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Diversification et allocation d’actifs$wb$)
   and c.content #> (array['lessons','4','sections', s.idx::text] || '{tableau,lignes,1,2}'::text[]) is distinct from $wb$"Pas plus de 35 % sur un seul secteur"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','4','sections', s.idx::text] || '{contenu}'::text[], $wb$"L’indice BRVM Composite regroupe toutes les sociétés cotées, pondérées par leur capitalisation boursière. Une société deux fois plus grande pèse deux fois plus dans l’indice : quelques grandes valeurs y occupent une place importante.\nC’est utile à savoir : suivre l’indice n’est pas la même chose qu’être diversifié. Si les deux ou trois premières capitalisations baissent, l’indice baisse, même si la majorité des autres sociétés monte.\nLe BRVM 30 retient les trente valeurs les plus échangées. Un indice ne dit pas, à lui seul, si le mouvement du marché est porté par quelques grandes valeurs ou partagé par l’ensemble : pour le savoir, comptez plutôt les valeurs en hausse et en baisse de la séance. Les valeurs ci-dessous sont lues en base à l’ouverture de la leçon."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->4->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Sur la BRVM : deux indices$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Diversification et allocation d’actifs$wb$)
   and c.content #> (array['lessons','4','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"L’indice BRVM Composite regroupe toutes les sociétés cotées, pondérées par leur capitalisation boursière. Une société deux fois plus grande pèse deux fois plus dans l’indice : quelques grandes valeurs y occupent une place importante.\nC’est utile à savoir : suivre l’indice n’est pas la même chose qu’être diversifié. Si les deux ou trois premières capitalisations baissent, l’indice baisse, même si la majorité des autres sociétés monte.\nLe BRVM 30 retient les trente valeurs les plus échangées. Un indice ne dit pas, à lui seul, si le mouvement du marché est porté par quelques grandes valeurs ou partagé par l’ensemble : pour le savoir, comptez plutôt les valeurs en hausse et en baisse de la séance. Les valeurs ci-dessous sont lues en base à l’ouverture de la leçon."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,4,quiz,2,options}', $wb$["Elles sont interdites par le règlement de la BRVM", "Les frais minimum pèsent lourd", "Elles ne versent pas de dividende", "Elles augmentent le risque de marché"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Diversification et allocation d’actifs$wb$)
   and c.content #>> '{lessons,4,quiz,2,question}' in ($wb$Pourquoi des lignes trop petites posent-elles problème ?$wb$)
   and c.content #> '{lessons,4,quiz,2,options}' is distinct from $wb$["Elles sont interdites par le règlement de la BRVM", "Les frais minimum pèsent lourd", "Elles ne versent pas de dividende", "Elles augmentent le risque de marché"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,4,quiz,4,options}', $wb$["Il ne contient qu’une seule société cotée", "Il est pondéré par la capitalisation", "Il ne contient que des obligations d’État", "Il n’est plus publié par la BRVM"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Diversification et allocation d’actifs$wb$)
   and c.content #>> '{lessons,4,quiz,4,question}' in ($wb$Pourquoi suivre l’indice BRVM Composite n’équivaut-il pas forcément à être diversifié ?$wb$)
   and c.content #> '{lessons,4,quiz,4,options}' is distinct from $wb$["Il ne contient qu’une seule société cotée", "Il est pondéré par la capitalisation", "Il ne contient que des obligations d’État", "Il n’est plus publié par la BRVM"]$wb$::jsonb;

-- academy-niveau-2-fondamental · Leçon 6 — Les droits préférentiels de souscription (DPS)  (niveau2/l06-dps.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,5,resume}', $wb$"Lors d’une augmentation de capital en numéraire, chaque action ancienne donne un droit préférentiel de souscription. Ce droit permet d’acheter des actions nouvelles à un prix réduit, ou se vend ; l’assemblée générale peut aussi le supprimer, par exemple pour une augmentation réservée, et la note d’information l’indique. Cette leçon explique le mécanisme, le calcul de sa valeur et les trois choix de l’actionnaire."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les droits préférentiels de souscription (DPS)$wb$)
   and c.content #> '{lessons,5,resume}' is distinct from $wb$"Lors d’une augmentation de capital en numéraire, chaque action ancienne donne un droit préférentiel de souscription. Ce droit permet d’acheter des actions nouvelles à un prix réduit, ou se vend ; l’assemblée générale peut aussi le supprimer, par exemple pour une augmentation réservée, et la note d’information l’indique. Cette leçon explique le mécanisme, le calcul de sa valeur et les trois choix de l’actionnaire."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','5','sections', s.idx::text] || '{contenu}'::text[], $wb$"Quand une société a besoin de capitaux, elle peut émettre des actions nouvelles. Pour attirer les souscripteurs, elle les propose en général sous le cours de bourse. Sans protection, l’actionnaire en place perdrait deux fois : sa part du capital diminuerait, et la valeur de ses titres baisserait, puisque de nouvelles actions entrent à prix réduit.\nLe droit préférentiel de souscription (DPS) compense cette perte. Chaque action ancienne reçoit un droit. Ces droits donnent la priorité aux actionnaires existants pour souscrire les actions nouvelles, et ils se négocient pendant la période de souscription : celui qui ne veut pas souscrire peut les vendre, celui qui veut souscrire davantage peut en acheter.\nLa parité indique combien de droits il faut pour une action nouvelle. « Une action nouvelle pour quatre anciennes » signifie qu’il faut quatre droits, donc détenir quatre actions, pour en souscrire une.\nCe droit n’est pas automatique dans tous les cas : l’assemblée générale peut le supprimer, par exemple pour une augmentation de capital réservée à certains investisseurs. La note d’information de l’opération l’indique."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->5->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Pourquoi un droit préférentiel ?$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les droits préférentiels de souscription (DPS)$wb$)
   and c.content #> (array['lessons','5','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Quand une société a besoin de capitaux, elle peut émettre des actions nouvelles. Pour attirer les souscripteurs, elle les propose en général sous le cours de bourse. Sans protection, l’actionnaire en place perdrait deux fois : sa part du capital diminuerait, et la valeur de ses titres baisserait, puisque de nouvelles actions entrent à prix réduit.\nLe droit préférentiel de souscription (DPS) compense cette perte. Chaque action ancienne reçoit un droit. Ces droits donnent la priorité aux actionnaires existants pour souscrire les actions nouvelles, et ils se négocient pendant la période de souscription : celui qui ne veut pas souscrire peut les vendre, celui qui veut souscrire davantage peut en acheter.\nLa parité indique combien de droits il faut pour une action nouvelle. « Une action nouvelle pour quatre anciennes » signifie qu’il faut quatre droits, donc détenir quatre actions, pour en souscrire une.\nCe droit n’est pas automatique dans tous les cas : l’assemblée générale peut le supprimer, par exemple pour une augmentation de capital réservée à certains investisseurs. La note d’information de l’opération l’indique."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,5,quiz,3,options}', $wb$["Oui, une perte définitive pour l’actionnaire", "Non : la valeur du droit la compense", "Oui, sauf si le dividende est maintenu", "Non, le cours ne bouge jamais ce jour-là"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les droits préférentiels de souscription (DPS)$wb$)
   and c.content #>> '{lessons,5,quiz,3,question}' in ($wb$Le jour du détachement, le cours baisse d’un montant proche de la valeur du droit. Est-ce une perte pour l’actionnaire ?$wb$)
   and c.content #> '{lessons,5,quiz,3,options}' is distinct from $wb$["Oui, une perte définitive pour l’actionnaire", "Non : la valeur du droit la compense", "Oui, sauf si le dividende est maintenu", "Non, le cours ne bouge jamais ce jour-là"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,5,quiz,4,options}', $wb$["Ce n’est pas utile, seul le prix compte", "Son usage change le risque pris", "Pour connaître le nom de la SGI chef de file", "Pour savoir si la société verse un dividende"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->5->>'titre' in ($wb$Leçon 6 — Les droits préférentiels de souscription (DPS)$wb$)
   and c.content #>> '{lessons,5,quiz,4,question}' in ($wb$Pourquoi lire l’objet d’une augmentation de capital avant de souscrire ?$wb$)
   and c.content #> '{lessons,5,quiz,4,options}' is distinct from $wb$["Ce n’est pas utile, seul le prix compte", "Son usage change le risque pris", "Pour connaître le nom de la SGI chef de file", "Pour savoir si la société verse un dividende"]$wb$::jsonb;

-- academy-niveau-2-fondamental · Leçon 7 — Simulation de portefeuille sur 3 ans  (niveau2/l07-simulation.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','6','sections', s.idx::text] || '{contenu}'::text[], $wb$"Hypothèses fictives : 200 actions, un dividende net de 900 FCFA par action qui progresse de 3 % par an, un cours constant de 15 000 FCFA. Les dividendes servent à acheter de nouvelles actions. Le calcul est fait à l’affichage, à partir de ces seules hypothèses.\nLe mécanisme est celui des intérêts composés. La première année, les dividendes rachètent quelques actions. L’année suivante, ces actions nouvelles versent à leur tour un dividende, qui s’ajoute à celui des actions d’origine. Le nombre d’actions croît donc un peu plus vite chaque année.\nSur trois ans, l’effet reste modeste. Il devient important sur dix ou vingt ans : le réinvestissement est surtout un outil d’épargne longue. Notez les limites de l’exemple : un cours constant est une hypothèse commode, presque jamais vérifiée, et dans la réalité chaque rachat supporte des frais de courtage."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->6->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Réinvestir ses dividendes pendant 3 ans$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->6->>'titre' in ($wb$Leçon 7 — Simulation de portefeuille sur 3 ans$wb$)
   and c.content #> (array['lessons','6','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Hypothèses fictives : 200 actions, un dividende net de 900 FCFA par action qui progresse de 3 % par an, un cours constant de 15 000 FCFA. Les dividendes servent à acheter de nouvelles actions. Le calcul est fait à l’affichage, à partir de ces seules hypothèses.\nLe mécanisme est celui des intérêts composés. La première année, les dividendes rachètent quelques actions. L’année suivante, ces actions nouvelles versent à leur tour un dividende, qui s’ajoute à celui des actions d’origine. Le nombre d’actions croît donc un peu plus vite chaque année.\nSur trois ans, l’effet reste modeste. Il devient important sur dix ou vingt ans : le réinvestissement est surtout un outil d’épargne longue. Notez les limites de l’exemple : un cours constant est une hypothèse commode, presque jamais vérifiée, et dans la réalité chaque rachat supporte des frais de courtage."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,6,quiz,3,options}', $wb$["Ce n’est pas le cas sur un horizon long", "Il va souvent avec un dividende fragile", "Les frais de courtage sont alors plus élevés", "L’impôt sur les dividendes est plus élevé"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->6->>'titre' in ($wb$Leçon 7 — Simulation de portefeuille sur 3 ans$wb$)
   and c.content #>> '{lessons,6,quiz,3,question}' in ($wb$Pourquoi viser un rendement très élevé augmente-t-il le risque ?$wb$)
   and c.content #> '{lessons,6,quiz,3,options}' is distinct from $wb$["Ce n’est pas le cas sur un horizon long", "Il va souvent avec un dividende fragile", "Les frais de courtage sont alors plus élevés", "L’impôt sur les dividendes est plus élevé"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,6,quiz,4,options}', $wb$["À investir de l’argent réel, sans payer de frais", "À tester une stratégie sans argent réel", "À obtenir des dividendes gratuits", "À réduire l’impôt sur ses dividendes"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->6->>'titre' in ($wb$Leçon 7 — Simulation de portefeuille sur 3 ans$wb$)
   and c.content #>> '{lessons,6,quiz,4,question}' in ($wb$À quoi sert le portefeuille virtuel ?$wb$)
   and c.content #> '{lessons,6,quiz,4,options}' is distinct from $wb$["À investir de l’argent réel, sans payer de frais", "À tester une stratégie sans argent réel", "À obtenir des dividendes gratuits", "À réduire l’impôt sur ses dividendes"]$wb$::jsonb;

-- academy-niveau-2-fondamental · Leçon 8 — La fiscalité des revenus boursiers  (niveau2/l08-fiscalite.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,7,resume}', $wb$"À la BRVM, l’impôt sur les dividendes est retenu à la source par la société, selon la loi de son pays : c’est l’IRVM. Le taux varie d’un pays à l’autre. Cette leçon montre les taux relevés par WestBourse et leur source, la différence entre brut et net, et le cas des obligations."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — La fiscalité des revenus boursiers$wb$)
   and c.content #> '{lessons,7,resume}' is distinct from $wb$"À la BRVM, l’impôt sur les dividendes est retenu à la source par la société, selon la loi de son pays : c’est l’IRVM. Le taux varie d’un pays à l’autre. Cette leçon montre les taux relevés par WestBourse et leur source, la différence entre brut et net, et le cas des obligations."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{contenu}'::text[], $wb$"Les taux ci-dessous s’appliquent aux personnes physiques. Celui de la Côte d’Ivoire est tiré de la loi de finances 2025 ; les autres viennent d’une source publique de 2019 et restent à confirmer sur le code des impôts de chaque pays. Ils changent avec les lois de finances : la page Fiscalité du site fait foi et cite ses sources.\nLes écarts sont importants. Pour un même dividende brut, l’actionnaire d’une société togolaise et celui d’une société burkinabè ne reçoivent pas le même montant net. Comparer deux sociétés de pays différents sur leur rendement brut conduit donc à une erreur : comparez les rendements nets.\nQuand aucune source n’a été trouvée pour un pays, WestBourse n’affiche pas de taux. Une case « non vérifié » vaut mieux qu’un taux supposé, qui fausserait tous les calculs qui en dépendent."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les taux sur les dividendes d’actions cotées$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — La fiscalité des revenus boursiers$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Les taux ci-dessous s’appliquent aux personnes physiques. Celui de la Côte d’Ivoire est tiré de la loi de finances 2025 ; les autres viennent d’une source publique de 2019 et restent à confirmer sur le code des impôts de chaque pays. Ils changent avec les lois de finances : la page Fiscalité du site fait foi et cite ses sources.\nLes écarts sont importants. Pour un même dividende brut, l’actionnaire d’une société togolaise et celui d’une société burkinabè ne reçoivent pas le même montant net. Comparer deux sociétés de pays différents sur leur rendement brut conduit donc à une erreur : comparez les rendements nets.\nQuand aucune source n’a été trouvée pour un pays, WestBourse n’affiche pas de taux. Une case « non vérifié » vaut mieux qu’un taux supposé, qui fausserait tous les calculs qui en dépendent."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{tableau,lignes,0,2}'::text[], $wb$"12 % pour les personnes physiques depuis l’annexe fiscale 2025 (10 % avant) ; 10 % pour les personnes morales"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les taux sur les dividendes d’actions cotées$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — La fiscalité des revenus boursiers$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{tableau,lignes,0,2}'::text[]) is distinct from $wb$"12 % pour les personnes physiques depuis l’annexe fiscale 2025 (10 % avant) ; 10 % pour les personnes morales"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{tableau,lignes,1,2}'::text[], $wb$"Source publique de 2019, à confirmer"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les taux sur les dividendes d’actions cotées$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — La fiscalité des revenus boursiers$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{tableau,lignes,1,2}'::text[]) is distinct from $wb$"Source publique de 2019, à confirmer"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{tableau,lignes,2,2}'::text[], $wb$"Source publique de 2019, à confirmer"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les taux sur les dividendes d’actions cotées$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — La fiscalité des revenus boursiers$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{tableau,lignes,2,2}'::text[]) is distinct from $wb$"Source publique de 2019, à confirmer"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{tableau,lignes,3,2}'::text[], $wb$"Source publique de 2019, à confirmer"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les taux sur les dividendes d’actions cotées$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — La fiscalité des revenus boursiers$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{tableau,lignes,3,2}'::text[]) is distinct from $wb$"Source publique de 2019, à confirmer"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{tableau,lignes,4,2}'::text[], $wb$"Taux réduit ; source publique de 2019, à confirmer"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les taux sur les dividendes d’actions cotées$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — La fiscalité des revenus boursiers$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{tableau,lignes,4,2}'::text[]) is distinct from $wb$"Taux réduit ; source publique de 2019, à confirmer"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{tableau,lignes,5,2}'::text[], $wb$"Personnes physiques, 7 % pour les personnes morales ; source publique de 2019, à confirmer"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les taux sur les dividendes d’actions cotées$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — La fiscalité des revenus boursiers$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{tableau,lignes,5,2}'::text[]) is distinct from $wb$"Personnes physiques, 7 % pour les personnes morales ; source publique de 2019, à confirmer"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','7','sections', s.idx::text] || '{tableau,note}'::text[], $wb$"Source : barème WestBourse (page Fiscalité), qui cite pour chaque pays le texte ou la publication utilisée."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->7->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Les taux sur les dividendes d’actions cotées$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->7->>'titre' in ($wb$Leçon 8 — La fiscalité des revenus boursiers$wb$)
   and c.content #> (array['lessons','7','sections', s.idx::text] || '{tableau,note}'::text[]) is distinct from $wb$"Source : barème WestBourse (page Fiscalité), qui cite pour chaque pays le texte ou la publication utilisée."$wb$::jsonb;

-- academy-niveau-2-fondamental · Leçon 9 — Les obligations cotées à la BRVM  (niveau2/l09-obligations.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,8,resume}', $wb$"Une obligation est un prêt découpé en titres. L’émetteur verse un intérêt, le coupon, et rembourse le capital selon un calendrier fixé. La BRVM cote de nombreux emprunts, surtout d’États. Cette leçon explique le vocabulaire, le calcul du rendement et les précautions propres à ce marché."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Les obligations cotées à la BRVM$wb$)
   and c.content #> '{lessons,8,resume}' is distinct from $wb$"Une obligation est un prêt découpé en titres. L’émetteur verse un intérêt, le coupon, et rembourse le capital selon un calendrier fixé. La BRVM cote de nombreux emprunts, surtout d’États. Cette leçon explique le vocabulaire, le calcul du rendement et les précautions propres à ce marché."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','8','sections', s.idx::text] || '{formules,2,expression}'::text[], $wb$"Coupon × Jours écoulés ÷ Jours de l’année, selon la convention de l’emprunt"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->8->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$Prix, coupon couru et rendement$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Les obligations cotées à la BRVM$wb$)
   and c.content #> (array['lessons','8','sections', s.idx::text] || '{formules,2,expression}'::text[]) is distinct from $wb$"Coupon × Jours écoulés ÷ Jours de l’année, selon la convention de l’emprunt"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,8,quiz,4,options}', $wb$["Que le titre est très stable et sans risque", "Qu’il s’échange peut-être très peu", "Qu’il va bientôt monter vers le pair", "Qu’il est garanti par l’État émetteur"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->8->>'titre' in ($wb$Leçon 9 — Les obligations cotées à la BRVM$wb$)
   and c.content #>> '{lessons,8,quiz,4,question}' in ($wb$Une obligation affiche le même cours depuis des mois. Qu’en conclure ?$wb$)
   and c.content #> '{lessons,8,quiz,4,options}' is distinct from $wb$["Que le titre est très stable et sans risque", "Qu’il s’échange peut-être très peu", "Qu’il va bientôt monter vers le pair", "Qu’il est garanti par l’État émetteur"]$wb$::jsonb;

-- academy-niveau-2-fondamental · Leçon 10 — Les OPCVM : investir par des fonds collectifs  (niveau2/l10-opcvm.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','9','sections', s.idx::text] || '{contenu}'::text[], $wb$"Les deux formes coexistent dans l’UEMOA, sous le contrôle de l’AMF-UMOA, qui a succédé au CREPMF.\nLe fonds commun de placement (FCP) est une copropriété de titres, sans personnalité juridique : une société de gestion agréée le gère pour le compte des porteurs de parts. La société d’investissement à capital variable (SICAV) est une société anonyme : en achetant ses actions, vous en devenez actionnaire, avec un droit de vote en assemblée.\nPour l’épargnant, la différence est surtout juridique. Dans les deux cas, on entre et on sort à la valeur liquidative, et un dépositaire, distinct de la société de gestion, conserve les actifs. Cette séparation protège l’épargnant : les actifs du fonds ne se confondent pas avec ceux de la société de gestion."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->9->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$FCP et SICAV, et leurs acteurs$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->9->>'titre' in ($wb$Leçon 10 — Les OPCVM : investir par des fonds collectifs$wb$)
   and c.content #> (array['lessons','9','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Les deux formes coexistent dans l’UEMOA, sous le contrôle de l’AMF-UMOA, qui a succédé au CREPMF.\nLe fonds commun de placement (FCP) est une copropriété de titres, sans personnalité juridique : une société de gestion agréée le gère pour le compte des porteurs de parts. La société d’investissement à capital variable (SICAV) est une société anonyme : en achetant ses actions, vous en devenez actionnaire, avec un droit de vote en assemblée.\nPour l’épargnant, la différence est surtout juridique. Dans les deux cas, on entre et on sort à la valeur liquidative, et un dépositaire, distinct de la société de gestion, conserve les actifs. Cette séparation protège l’épargnant : les actifs du fonds ne se confondent pas avec ceux de la société de gestion."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','9','sections', s.idx::text] || '{tableau,lignes,2,1}'::text[], $wb$"Un dépositaire, distinct du gérant"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->9->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$FCP et SICAV, et leurs acteurs$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->9->>'titre' in ($wb$Leçon 10 — Les OPCVM : investir par des fonds collectifs$wb$)
   and c.content #> (array['lessons','9','sections', s.idx::text] || '{tableau,lignes,2,1}'::text[]) is distinct from $wb$"Un dépositaire, distinct du gérant"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','9','sections', s.idx::text] || '{tableau,lignes,2,2}'::text[], $wb$"Un dépositaire, distinct du gérant"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->9->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-2-fondamental' and e.v->>'titre' in ($wb$FCP et SICAV, et leurs acteurs$wb$)) s
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->9->>'titre' in ($wb$Leçon 10 — Les OPCVM : investir par des fonds collectifs$wb$)
   and c.content #> (array['lessons','9','sections', s.idx::text] || '{tableau,lignes,2,2}'::text[]) is distinct from $wb$"Un dépositaire, distinct du gérant"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,9,quiz,2,options}', $wb$["Le gérant, sur son propre compte", "Un dépositaire", "La BRVM", "Chaque épargnant"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->9->>'titre' in ($wb$Leçon 10 — Les OPCVM : investir par des fonds collectifs$wb$)
   and c.content #>> '{lessons,9,quiz,2,question}' in ($wb$Qui conserve les actifs d’un OPCVM ?$wb$)
   and c.content #> '{lessons,9,quiz,2,options}' is distinct from $wb$["Le gérant, sur son propre compte", "Un dépositaire", "La BRVM", "Chaque épargnant"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,9,quiz,4,options}', $wb$["Souscrire vite, avant la clôture de l’offre", "Se méfier : rien ne garantit ce rendement", "Négocier les frais d’entrée et de sortie", "Demander une garantie écrite à 20 %"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-2-fondamental'
   and c.content->'lessons'->9->>'titre' in ($wb$Leçon 10 — Les OPCVM : investir par des fonds collectifs$wb$)
   and c.content #>> '{lessons,9,quiz,4,question}' in ($wb$Un fonds investi en actions promet un rendement « garanti » de 15 % par an. Quelle est la bonne réaction ?$wb$)
   and c.content #> '{lessons,9,quiz,4,options}' is distinct from $wb$["Souscrire vite, avant la clôture de l’offre", "Se méfier : rien ne garantit ce rendement", "Négocier les frais d’entrée et de sortie", "Demander une garantie écrite à 20 %"]$wb$::jsonb;

-- academy-niveau-3-technique · Leçon 1 — Lire un graphique de cours  (niveau3/l01-lire-graphique.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text] || '{contenu}'::text[], $wb$"WestBourse a rejoué son score technique sur 2008-2023, une période que la formule n’avait jamais vue : 109 634 notes, une par titre et par séance. Ces notes se chevauchent : pour juger un écart, seuls comptent les cas indépendants.\nLes titres les plus mal notés (score inférieur à −0,60 : 400 cas, dont 276 indépendants) ont fait en moyenne 8,4 % de mieux que le marché dans les 20 séances suivantes, avec un intervalle à 95 % de +5,5 % à +11,4 %. Les mieux notés n’ont pas fait mieux que le marché.\nSur 2024-2026, cet effet n’est pas confirmé à 60 séances. C’est une moyenne passée, sur un échantillon limité : certaines valeurs ont continué à baisser, et une moyenne recouvre des cas très différents. Ce n’est ni une méthode, ni un conseil, ni une prévision, et rien ne promet que cela se reproduise."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' in ($wb$Ce que nous avons mesuré sur la BRVM$wb$)) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un graphique de cours$wb$)
   and c.content #> (array['lessons','0','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"WestBourse a rejoué son score technique sur 2008-2023, une période que la formule n’avait jamais vue : 109 634 notes, une par titre et par séance. Ces notes se chevauchent : pour juger un écart, seuls comptent les cas indépendants.\nLes titres les plus mal notés (score inférieur à −0,60 : 400 cas, dont 276 indépendants) ont fait en moyenne 8,4 % de mieux que le marché dans les 20 séances suivantes, avec un intervalle à 95 % de +5,5 % à +11,4 %. Les mieux notés n’ont pas fait mieux que le marché.\nSur 2024-2026, cet effet n’est pas confirmé à 60 séances. C’est une moyenne passée, sur un échantillon limité : certaines valeurs ont continué à baisser, et une moyenne recouvre des cas très différents. Ce n’est ni une méthode, ni un conseil, ni une prévision, et rien ne promet que cela se reproduise."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text] || '{stats,0,label}'::text[], $wb$"Notes rejouées"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' in ($wb$Ce que nous avons mesuré sur la BRVM$wb$)) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un graphique de cours$wb$)
   and c.content #> (array['lessons','0','sections', s.idx::text] || '{stats,0,label}'::text[]) is distinct from $wb$"Notes rejouées"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text] || '{stats,0,detail}'::text[], $wb$"Une par titre et par séance, 2008-2023 : elles se chevauchent"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' in ($wb$Ce que nous avons mesuré sur la BRVM$wb$)) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un graphique de cours$wb$)
   and c.content #> (array['lessons','0','sections', s.idx::text] || '{stats,0,detail}'::text[]) is distinct from $wb$"Une par titre et par séance, 2008-2023 : elles se chevauchent"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text] || '{stats,1,detail}'::text[], $wb$"À 20 séances, 276 cas indépendants, 2008-2023 ; non confirmé sur 2024-2026 à 60 séances"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' in ($wb$Ce que nous avons mesuré sur la BRVM$wb$)) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un graphique de cours$wb$)
   and c.content #> (array['lessons','0','sections', s.idx::text] || '{stats,1,detail}'::text[]) is distinct from $wb$"À 20 séances, 276 cas indépendants, 2008-2023 ; non confirmé sur 2024-2026 à 60 séances"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text] || '{stats,2,detail}'::text[], $wb$"À 20 séances, 305 cas indépendants, écart non établi"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' in ($wb$Ce que nous avons mesuré sur la BRVM$wb$)) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un graphique de cours$wb$)
   and c.content #> (array['lessons','0','sections', s.idx::text] || '{stats,2,detail}'::text[]) is distinct from $wb$"À 20 séances, 305 cas indépendants, écart non établi"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,0,quiz,1,options}', $wb$["Le cours le plus haut de l’année écoulée", "Un niveau où la baisse a cessé plusieurs fois", "Le cours moyen pondéré des vingt dernières séances", "Le volume moyen"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un graphique de cours$wb$)
   and c.content #>> '{lessons,0,quiz,1,question}' in ($wb$Qu’est-ce qu’un support ?$wb$)
   and c.content #> '{lessons,0,quiz,1,options}' is distinct from $wb$["Le cours le plus haut de l’année écoulée", "Un niveau où la baisse a cessé plusieurs fois", "Le cours moyen pondéré des vingt dernières séances", "Le volume moyen"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,0,quiz,3,options}', $wb$["Le prix exact du marché aujourd’hui", "Le dernier prix échangé, sans plus", "Zéro, faute d’échange", "La moyenne des cours de son secteur"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un graphique de cours$wb$)
   and c.content #>> '{lessons,0,quiz,3,question}' in ($wb$Une valeur n’a pas été échangée depuis dix séances. Que vaut son cours affiché ?$wb$)
   and c.content #> '{lessons,0,quiz,3,options}' is distinct from $wb$["Le prix exact du marché aujourd’hui", "Le dernier prix échangé, sans plus", "Zéro, faute d’échange", "La moyenne des cours de son secteur"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,0,quiz,4,question}', $wb$"D’après la mesure WestBourse sur 2008-2023, qu’ont fait en moyenne les titres les plus mal notés dans les 20 séances suivantes ?"$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un graphique de cours$wb$)
   and c.content #>> '{lessons,0,quiz,4,question}' in ($wb$D’après la mesure WestBourse sur 2008-2023, qu’ont fait en moyenne les titres les plus mal notés ?$wb$, $wb$D’après la mesure WestBourse sur 2008-2023, qu’ont fait en moyenne les titres les plus mal notés dans les 20 séances suivantes ?$wb$)
   and c.content #> '{lessons,0,quiz,4,question}' is distinct from $wb$"D’après la mesure WestBourse sur 2008-2023, qu’ont fait en moyenne les titres les plus mal notés dans les 20 séances suivantes ?"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,0,quiz,4,options}', $wb$["Ils ont continué à baisser en moyenne", "Mieux que le marché, en moyenne", "Ils ont tous été suspendus de cotation", "Exactement comme le marché"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un graphique de cours$wb$)
   and c.content #>> '{lessons,0,quiz,4,question}' in ($wb$D’après la mesure WestBourse sur 2008-2023, qu’ont fait en moyenne les titres les plus mal notés ?$wb$, $wb$D’après la mesure WestBourse sur 2008-2023, qu’ont fait en moyenne les titres les plus mal notés dans les 20 séances suivantes ?$wb$)
   and c.content #> '{lessons,0,quiz,4,options}' is distinct from $wb$["Ils ont continué à baisser en moyenne", "Mieux que le marché, en moyenne", "Ils ont tous été suspendus de cotation", "Exactement comme le marché"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,0,quiz,4,explication}', $wb$"Sur 2008-2023, 276 cas indépendants ont fait en moyenne 8,4 % de mieux que le marché à 20 séances. Sur 2024-2026, l’effet n’est pas confirmé à 60 séances. C’est une moyenne passée, ni une règle ni une promesse."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — Lire un graphique de cours$wb$)
   and c.content #>> '{lessons,0,quiz,4,question}' in ($wb$D’après la mesure WestBourse sur 2008-2023, qu’ont fait en moyenne les titres les plus mal notés ?$wb$, $wb$D’après la mesure WestBourse sur 2008-2023, qu’ont fait en moyenne les titres les plus mal notés dans les 20 séances suivantes ?$wb$)
   and c.content #> '{lessons,0,quiz,4,explication}' is distinct from $wb$"Sur 2008-2023, 276 cas indépendants ont fait en moyenne 8,4 % de mieux que le marché à 20 séances. Sur 2024-2026, l’effet n’est pas confirmé à 60 séances. C’est une moyenne passée, ni une règle ni une promesse."$wb$::jsonb;

-- academy-niveau-3-technique · Leçon 4 — Le RSI : mesurer les excès de marché  (niveau3/l04-rsi.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text] || '{titre}'::text[], $wb$"Le RSI et la mesure de la leçon 1"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' in ($wb$Ce que nous avons mesuré sur la BRVM$wb$, $wb$Le RSI et la mesure de la leçon 1$wb$)) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Le RSI : mesurer les excès de marché$wb$)
   and c.content #> (array['lessons','3','sections', s.idx::text] || '{titre}'::text[]) is distinct from $wb$"Le RSI et la mesure de la leçon 1"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text] || '{contenu}'::text[], $wb$"La leçon 1 présente le rejeu du score technique de WestBourse sur 2008-2023, avec son horizon, la taille de son échantillon et ses limites. Ce résultat porte sur un score qui combine plusieurs éléments, dont le RSI, et non sur le RSI seul.\nIl ne dit donc rien de ce que fait une valeur après un RSI bas. Un RSI décrit un excès récent : il ne dit pas si cet excès se corrigera, ni quand. Il ne transforme pas un RSI bas en raison d’acheter."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' in ($wb$Ce que nous avons mesuré sur la BRVM$wb$, $wb$Le RSI et la mesure de la leçon 1$wb$)) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Le RSI : mesurer les excès de marché$wb$)
   and c.content #> (array['lessons','3','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"La leçon 1 présente le rejeu du score technique de WestBourse sur 2008-2023, avec son horizon, la taille de son échantillon et ses limites. Ce résultat porte sur un score qui combine plusieurs éléments, dont le RSI, et non sur le RSI seul.\nIl ne dit donc rien de ce que fait une valeur après un RSI bas. Un RSI décrit un excès récent : il ne dit pas si cet excès se corrigera, ni quand. Il ne transforme pas un RSI bas en raison d’acheter."$wb$::jsonb;
update public.academy_courses c
   set content = c.content #- (array['lessons','3','sections', s.idx::text] || '{stats}'::text[]), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' in ($wb$Ce que nous avons mesuré sur la BRVM$wb$, $wb$Le RSI et la mesure de la leçon 1$wb$)) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Le RSI : mesurer les excès de marché$wb$)
   and c.content #> (array['lessons','3','sections', s.idx::text] || '{stats}'::text[]) is not null;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','3','sections', s.idx::text] || '{points,3,titre}'::text[], $wb$"Le RSI décrit un excès récent ; il ne dit pas s’il se corrigera"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->3->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' in ($wb$L’essentiel$wb$)) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Le RSI : mesurer les excès de marché$wb$)
   and c.content #> (array['lessons','3','sections', s.idx::text] || '{points,3,titre}'::text[]) is distinct from $wb$"Le RSI décrit un excès récent ; il ne dit pas s’il se corrigera"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,3,quiz,3,options}', $wb$["Il ne se calcule pas sans volume quotidien", "Quelques ordres suffisent à le pousser à l’extrême", "Il n’est publié qu’une fois par mois pour ces valeurs", "Il est interdit sur les petites valeurs"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Le RSI : mesurer les excès de marché$wb$)
   and c.content #>> '{lessons,3,quiz,3,question}' in ($wb$Pourquoi le RSI d’une valeur peu liquide est-il à lire avec prudence ?$wb$)
   and c.content #> '{lessons,3,quiz,3,options}' is distinct from $wb$["Il ne se calcule pas sans volume quotidien", "Quelques ordres suffisent à le pousser à l’extrême", "Il n’est publié qu’une fois par mois pour ces valeurs", "Il est interdit sur les petites valeurs"]$wb$::jsonb;

-- academy-niveau-3-technique · Leçon 5 — Le MACD : l’élan d’une tendance  (niveau3/l05-macd.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','4','sections', s.idx::text] || '{contenu}'::text[], $wb$"Le MACD (moving average convergence divergence, ou convergence et divergence de moyennes mobiles) a été présenté par Gerald Appel à la fin des années 1970. Il repose sur deux moyennes mobiles exponentielles du cours, une courte et une longue, et mesure l’écart entre elles.\nLes paramètres usuels sont 12, 26 et 9 séances. La ligne MACD est la différence entre la moyenne exponentielle sur 12 séances et celle sur 26. Positive, elle indique une tendance courte au-dessus de la tendance longue ; négative, l’inverse.\nLa ligne de signal est une moyenne exponentielle sur 9 séances de la ligne MACD elle-même : elle la lisse. L’histogramme représente l’écart entre les deux lignes, sous forme de barres ; il a été ajouté plus tard à l’indicateur d’Appel, par Thomas Aspray. C’est souvent la composante la plus lisible, parce qu’elle montre si l’écart grandit ou se resserre."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->4->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' in ($wb$Trois composantes$wb$)) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — Le MACD : l’élan d’une tendance$wb$)
   and c.content #> (array['lessons','4','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Le MACD (moving average convergence divergence, ou convergence et divergence de moyennes mobiles) a été présenté par Gerald Appel à la fin des années 1970. Il repose sur deux moyennes mobiles exponentielles du cours, une courte et une longue, et mesure l’écart entre elles.\nLes paramètres usuels sont 12, 26 et 9 séances. La ligne MACD est la différence entre la moyenne exponentielle sur 12 séances et celle sur 26. Positive, elle indique une tendance courte au-dessus de la tendance longue ; négative, l’inverse.\nLa ligne de signal est une moyenne exponentielle sur 9 séances de la ligne MACD elle-même : elle la lisse. L’histogramme représente l’écart entre les deux lignes, sous forme de barres ; il a été ajouté plus tard à l’indicateur d’Appel, par Thomas Aspray. C’est souvent la composante la plus lisible, parce qu’elle montre si l’écart grandit ou se resserre."$wb$::jsonb;

-- academy-niveau-3-technique · Leçon 7 — Stop-loss, objectif et taille de position  (niveau3/l07-gestion-risque.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','6','sections', s.idx::text] || '{points,0,titre}'::text[], $wb$"Le stop n’est pas un ordre de la BRVM"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->6->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' in ($wb$Les limites à la BRVM$wb$)) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->6->>'titre' in ($wb$Leçon 7 — Stop-loss, objectif et taille de position$wb$)
   and c.content #> (array['lessons','6','sections', s.idx::text] || '{points,0,titre}'::text[]) is distinct from $wb$"Le stop n’est pas un ordre de la BRVM"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','6','sections', s.idx::text] || '{points,0,detail}'::text[], $wb$"Le règlement ne prévoit pas d’ordre stop ; certaines SGI proposent une surveillance, sinon il faut surveiller soi-même et passer l’ordre."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->6->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-3-technique' and e.v->>'titre' in ($wb$Les limites à la BRVM$wb$)) s
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->6->>'titre' in ($wb$Leçon 7 — Stop-loss, objectif et taille de position$wb$)
   and c.content #> (array['lessons','6','sections', s.idx::text] || '{points,0,detail}'::text[]) is distinct from $wb$"Le règlement ne prévoit pas d’ordre stop ; certaines SGI proposent une surveillance, sinon il faut surveiller soi-même et passer l’ordre."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,6,quiz,3,options}', $wb$["Il s’exécute au cours de clôture de la veille", "Le cours peut sauter le niveau du stop", "Les stops sont toujours exécutés au cours d’achat", "La BRVM rembourse la différence au vendeur"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-3-technique'
   and c.content->'lessons'->6->>'titre' in ($wb$Leçon 7 — Stop-loss, objectif et taille de position$wb$)
   and c.content #>> '{lessons,6,quiz,3,question}' in ($wb$Pourquoi un stop ne garantit-il pas le prix de vente à la BRVM ?$wb$)
   and c.content #> '{lessons,6,quiz,3,options}' is distinct from $wb$["Il s’exécute au cours de clôture de la veille", "Le cours peut sauter le niveau du stop", "Les stops sont toujours exécutés au cours d’achat", "La BRVM rembourse la différence au vendeur"]$wb$::jsonb;

-- academy-niveau-4-expert · Leçon 1 — L’architecture du marché financier régional  (niveau4/l01-architecture.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text] || '{contenu}'::text[], $wb$"Le Conseil régional de l’épargne publique et des marchés financiers (CREPMF) a été transformé en Autorité des marchés financiers de l’UMOA (AMF-UMOA). Le changement fait suite au Traité révisé de l’UMOA du 12 juillet 2019 ; il a pris effet le 1er octobre 2022.\nLa réforme a notamment doté l’autorité d’une Commission des sanctions et d’un Médiateur.\nLa Commission des sanctions statue sur les manquements des acteurs du marché. Le Médiateur, lui, recherche un règlement amiable des différends entre épargnants et acteurs du marché. Pour l’épargnant, ce second organe est le plus concret : il offre une voie de recours qui ne passe pas d’emblée par un tribunal."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-4-expert' and e.v->>'titre' in ($wb$Du CREPMF à l’AMF-UMOA$wb$)) s
 where c.slug = 'academy-niveau-4-expert'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — L’architecture du marché financier régional$wb$)
   and c.content #> (array['lessons','0','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Le Conseil régional de l’épargne publique et des marchés financiers (CREPMF) a été transformé en Autorité des marchés financiers de l’UMOA (AMF-UMOA). Le changement fait suite au Traité révisé de l’UMOA du 12 juillet 2019 ; il a pris effet le 1er octobre 2022.\nLa réforme a notamment doté l’autorité d’une Commission des sanctions et d’un Médiateur.\nLa Commission des sanctions statue sur les manquements des acteurs du marché. Le Médiateur, lui, recherche un règlement amiable des différends entre épargnants et acteurs du marché. Pour l’épargnant, ce second organe est le plus concret : il offre une voie de recours qui ne passe pas d’emblée par un tribunal."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','0','sections', s.idx::text] || '{etapes,1,detail}'::text[], $wb$"Prise d’effet : l’AMF-UMOA a succédé au CREPMF."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->0->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-4-expert' and e.v->>'titre' in ($wb$Du CREPMF à l’AMF-UMOA$wb$)) s
 where c.slug = 'academy-niveau-4-expert'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — L’architecture du marché financier régional$wb$)
   and c.content #> (array['lessons','0','sections', s.idx::text] || '{etapes,1,detail}'::text[]) is distinct from $wb$"Prise d’effet : l’AMF-UMOA a succédé au CREPMF."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,0,quiz,3,options}', $wb$["Oui, elle garantit toutes les sociétés cotées", "Non : elle organise la cotation", "Oui, pour le compartiment Prestige", "Seulement pour les banques cotées"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-4-expert'
   and c.content->'lessons'->0->>'titre' in ($wb$Leçon 1 — L’architecture du marché financier régional$wb$)
   and c.content #>> '{lessons,0,quiz,3,question}' in ($wb$La BRVM garantit-elle la solidité des sociétés cotées ?$wb$)
   and c.content #> '{lessons,0,quiz,3,options}' is distinct from $wb$["Oui, elle garantit toutes les sociétés cotées", "Non : elle organise la cotation", "Oui, pour le compartiment Prestige", "Seulement pour les banques cotées"]$wb$::jsonb;

-- academy-niveau-4-expert · Leçon 2 — L’information et l’intégrité du marché  (niveau4/l02-integrite.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,1,quiz,1,options}', $wb$["D’attendre la publication du rapport annuel", "De le rendre public sans délai", "De n’en parler qu’aux grands actionnaires", "Rien tant que le contrat n’est pas exécuté"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-4-expert'
   and c.content->'lessons'->1->>'titre' in ($wb$Leçon 2 — L’information et l’intégrité du marché$wb$)
   and c.content #>> '{lessons,1,quiz,1,question}' in ($wb$Une société signe un contrat majeur. Que lui impose l’information permanente ?$wb$)
   and c.content #> '{lessons,1,quiz,1,options}' is distinct from $wb$["D’attendre la publication du rapport annuel", "De le rendre public sans délai", "De n’en parler qu’aux grands actionnaires", "Rien tant que le contrat n’est pas exécuté"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,1,quiz,3,options}', $wb$["Acheter avant que l’annonce ne soit publiée", "Ne pas opérer : l’information est privilégiée", "La relayer à d’autres pour qu’ils en profitent", "Vendre à découvert pour couvrir le risque"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-4-expert'
   and c.content->'lessons'->1->>'titre' in ($wb$Leçon 2 — L’information et l’intégrité du marché$wb$)
   and c.content #>> '{lessons,1,quiz,3,question}' in ($wb$Un ami salarié d’une société cotée vous annonce un excellent résultat, pas encore publié. Que faire ?$wb$)
   and c.content #> '{lessons,1,quiz,3,options}' is distinct from $wb$["Acheter avant que l’annonce ne soit publiée", "Ne pas opérer : l’information est privilégiée", "La relayer à d’autres pour qu’ils en profitent", "Vendre à découvert pour couvrir le risque"]$wb$::jsonb;

-- academy-niveau-4-expert · Leçon 3 — Les compartiments et les indices de la BRVM  (niveau4/l03-compartiments.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','2','sections', s.idx::text] || '{tableau,lignes,0,2}'::text[], $wb$"10 ans d’activité, 50 Md FCFA de capitalisation, flottant d’au moins 20 % et nombre minimal de titres, information régulière, engagement RSE"$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->2->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-4-expert' and e.v->>'titre' in ($wb$Trois compartiments$wb$)) s
 where c.slug = 'academy-niveau-4-expert'
   and c.content->'lessons'->2->>'titre' in ($wb$Leçon 3 — Les compartiments et les indices de la BRVM$wb$)
   and c.content #> (array['lessons','2','sections', s.idx::text] || '{tableau,lignes,0,2}'::text[]) is distinct from $wb$"10 ans d’activité, 50 Md FCFA de capitalisation, flottant d’au moins 20 % et nombre minimal de titres, information régulière, engagement RSE"$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,2,quiz,1,options}', $wb$["5 % du capital", "20 % du capital", "50 % du capital", "Aucun"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-4-expert'
   and c.content->'lessons'->2->>'titre' in ($wb$Leçon 3 — Les compartiments et les indices de la BRVM$wb$)
   and c.content #>> '{lessons,2,quiz,1,question}' in ($wb$Quel flottant minimum le compartiment Prestige exige-t-il ?$wb$)
   and c.content #> '{lessons,2,quiz,1,options}' is distinct from $wb$["5 % du capital", "20 % du capital", "50 % du capital", "Aucun"]$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,2,quiz,1,explication}', $wb$"Le communiqué de la BRVM fixe un flottant d’au moins 20 % du capital, assorti d’un nombre minimal de titres fixé par le règlement des compartiments."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-4-expert'
   and c.content->'lessons'->2->>'titre' in ($wb$Leçon 3 — Les compartiments et les indices de la BRVM$wb$)
   and c.content #>> '{lessons,2,quiz,1,question}' in ($wb$Quel flottant minimum le compartiment Prestige exige-t-il ?$wb$)
   and c.content #> '{lessons,2,quiz,1,explication}' is distinct from $wb$"Le communiqué de la BRVM fixe un flottant d’au moins 20 % du capital, assorti d’un nombre minimal de titres fixé par le règlement des compartiments."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,2,quiz,4,options}', $wb$["Oui, puisqu’elle est parmi les plus grandes", "Non : le compartiment ne dit rien du cours", "Oui, si elle verse un dividende régulier", "Oui, pendant ses dix premières années"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-4-expert'
   and c.content->'lessons'->2->>'titre' in ($wb$Leçon 3 — Les compartiments et les indices de la BRVM$wb$)
   and c.content #>> '{lessons,2,quiz,4,question}' in ($wb$Une société du compartiment Prestige est-elle un placement sans risque ?$wb$)
   and c.content #> '{lessons,2,quiz,4,options}' is distinct from $wb$["Oui, puisqu’elle est parmi les plus grandes", "Non : le compartiment ne dit rien du cours", "Oui, si elle verse un dividende régulier", "Oui, pendant ses dix premières années"]$wb$::jsonb;

-- academy-niveau-4-expert · Leçon 4 — Pourquoi une société entre en bourse  (niveau4/l04-pourquoi-bourse.json)
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,3,resume}', $wb$"Une introduction en bourse permet à une société de lever des capitaux ou à ses actionnaires de céder une partie de leurs titres au public. Elle apporte de la visibilité et une valeur de marché, mais impose transparence, coûts et contraintes durables. Cette leçon présente ces arbitrages, avec l’exemple de l’admission de Bridge Bank Group Côte d’Ivoire à la BRVM, en septembre 2026."$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-4-expert'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Pourquoi une société entre en bourse$wb$)
   and c.content #> '{lessons,3,resume}' is distinct from $wb$"Une introduction en bourse permet à une société de lever des capitaux ou à ses actionnaires de céder une partie de leurs titres au public. Elle apporte de la visibilité et une valeur de marché, mais impose transparence, coûts et contraintes durables. Cette leçon présente ces arbitrages, avec l’exemple de l’admission de Bridge Bank Group Côte d’Ivoire à la BRVM, en septembre 2026."$wb$::jsonb;
update public.academy_courses c
   set content = jsonb_set(c.content, '{lessons,3,quiz,4,options}', $wb$["Oui, au moins pendant la première année", "Non : la demande ne fixe pas le cours futur", "Oui, si la société cotée est une banque solide", "Oui, dès la première séance de cotation"]$wb$::jsonb), updated_at = now()
 where c.slug = 'academy-niveau-4-expert'
   and c.content->'lessons'->3->>'titre' in ($wb$Leçon 4 — Pourquoi une société entre en bourse$wb$)
   and c.content #>> '{lessons,3,quiz,4,question}' in ($wb$Une introduction très sursouscrite garantit-elle une hausse du cours ?$wb$)
   and c.content #> '{lessons,3,quiz,4,options}' is distinct from $wb$["Oui, au moins pendant la première année", "Non : la demande ne fixe pas le cours futur", "Oui, si la société cotée est une banque solide", "Oui, dès la première séance de cotation"]$wb$::jsonb;

-- academy-niveau-4-expert · Leçon 5 — La procédure d’introduction à la BRVM  (niveau4/l05-procedure.json)
update public.academy_courses c
   set content = jsonb_set(c.content, array['lessons','4','sections', s.idx::text] || '{contenu}'::text[], $wb$"Une introduction en bourse réunit plusieurs acteurs, et chacun engage sa responsabilité sur une partie du processus.\nPour émettre des actions nouvelles, la société décide de l’opération en assemblée générale ; dans une offre publique de vente, ce sont les actionnaires vendeurs qui décident de céder leurs titres. Elle fournit ses comptes, décrit son activité et ses risques, et répond de l’exactitude des informations publiées. La SGI chef de file conduit l’opération : elle conseille la société, prépare le dossier avec elle, organise le placement auprès du public et centralise les ordres reçus par l’ensemble des SGI. D’autres conseils interviennent souvent : avocats, auditeurs, conseillers financiers.\nL’AMF-UMOA examine le dossier et vise la note d’information avant toute offre au public. La BRVM se prononce sur l’admission des titres à la cote, dans le compartiment qui correspond aux critères de la société, puis organise la première cotation.\nPour l’investisseur, la porte d’entrée reste sa SGI : c’est par elle que passe tout ordre de souscription, comme tout ordre de bourse."$wb$::jsonb), updated_at = now()
  from (select (e.o - 1) as idx
          from public.academy_courses c2,
               jsonb_array_elements(c2.content->'lessons'->4->'sections') with ordinality as e(v, o)
         where c2.slug = 'academy-niveau-4-expert' and e.v->>'titre' in ($wb$Les acteurs d’une introduction$wb$)) s
 where c.slug = 'academy-niveau-4-expert'
   and c.content->'lessons'->4->>'titre' in ($wb$Leçon 5 — La procédure d’introduction à la BRVM$wb$)
   and c.content #> (array['lessons','4','sections', s.idx::text] || '{contenu}'::text[]) is distinct from $wb$"Une introduction en bourse réunit plusieurs acteurs, et chacun engage sa responsabilité sur une partie du processus.\nPour émettre des actions nouvelles, la société décide de l’opération en assemblée générale ; dans une offre publique de vente, ce sont les actionnaires vendeurs qui décident de céder leurs titres. Elle fournit ses comptes, décrit son activité et ses risques, et répond de l’exactitude des informations publiées. La SGI chef de file conduit l’opération : elle conseille la société, prépare le dossier avec elle, organise le placement auprès du public et centralise les ordres reçus par l’ensemble des SGI. D’autres conseils interviennent souvent : avocats, auditeurs, conseillers financiers.\nL’AMF-UMOA examine le dossier et vise la note d’information avant toute offre au public. La BRVM se prononce sur l’admission des titres à la cote, dans le compartiment qui correspond aux critères de la société, puis organise la première cotation.\nPour l’investisseur, la porte d’entrée reste sa SGI : c’est par elle que passe tout ordre de souscription, comme tout ordre de bourse."$wb$::jsonb;
