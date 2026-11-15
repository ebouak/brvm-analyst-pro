-- 0244 — Academy : photos de leçon pertinentes (2026-11-15).
--
-- Demande de l'exploitant : « trouver des photos images de remplacements
-- pertinent » ; « Les photos du niveau 1 : retirer seulement celles qui sont
-- hors sujet, et trouver d autres ».
--
-- Chaque photo a été regardée. Sont retirées : billets en dollars ou en euros
-- mis en avant, graphiques de cryptomonnaies, écrans de trading spéculatif,
-- application de courtage de marque, personnes identifiables, Bourse de New
-- York, Durban, formulaires barrés du mot « scam ». Les photos pertinentes sont
-- conservées ; leur description (alt) passe de l'anglais au français.
-- Niveau 1, leçon 4 : aucune photo en base, aucune ajoutée.
--
-- Source : la clé `image` des JSON frontend/lib/academy/contenus/lecon*.json et
-- contenus/autres/*.json (test photos.test.ts).
--
-- MÉTHODE. 28 mises à jour, une par leçon : jsonb_set de la SEULE clé
-- `image` de content->'lessons'->i. Garde : slug + titre de la leçon à cette
-- position (une leçon déplacée ou renommée n'est pas touchée). Idempotente :
-- une ligne déjà à jour n'est pas réécrite (`is distinct from`).
-- Aucun schéma ne change (le schéma des leçons connaît déjà `image`) : aucune
-- dépendance au déploiement du frontend. Aucune donnée personnelle.
--
-- ⚠️ ORDRE : APRÈS 0240 (ordre des leçons du niveau 1) et 0241 (cours hors
-- niveaux). Rejouer 0241 après 0244 remettrait les anciennes photos de ces
-- cours : ne pas la rejouer.

begin;

-- academy-niveau-1-initiation · leçon 2 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,1,image}', $wb${"url":"https://images.pexels.com/photos/18435332/pexels-photo-18435332.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Immeubles du Plateau, quartier des affaires d’Abidjan, vus depuis la lagune Ébrié","credit":"Photo : Jean Marc Bonnel / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$academy-niveau-1-initiation$wb$
   and content->'lessons'->1->>'titre' = $wb$Leçon 2 — Les 4 acteurs clés du marché$wb$
   and content->'lessons'->1->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/18435332/pexels-photo-18435332.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Immeubles du Plateau, quartier des affaires d’Abidjan, vus depuis la lagune Ébrié","credit":"Photo : Jean Marc Bonnel / Pexels"}$wb$::jsonb;

-- academy-niveau-1-initiation · leçon 3 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,2,image}', $wb${"url":"https://images.pexels.com/photos/7491011/pexels-photo-7491011.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Mains posées sur une calculatrice, à côté d’un carnet de notes","credit":"Photo : RDNE Stock project / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$academy-niveau-1-initiation$wb$
   and content->'lessons'->2->>'titre' = $wb$Leçon 3 — Combien faut-il pour investir à la BRVM ?$wb$
   and content->'lessons'->2->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/7491011/pexels-photo-7491011.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Mains posées sur une calculatrice, à côté d’un carnet de notes","credit":"Photo : RDNE Stock project / Pexels"}$wb$::jsonb;

-- academy-niveau-1-initiation · leçon 5 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,4,image}', $wb${"url":"https://images.pexels.com/photos/6928996/pexels-photo-6928996.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Calendrier, loupe et pièces de monnaie posés sur un bureau","credit":"Photo : Leeloo The First / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$academy-niveau-1-initiation$wb$
   and content->'lessons'->4->>'titre' = $wb$Leçon 5 — Les dividendes : se constituer un revenu régulier$wb$
   and content->'lessons'->4->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/6928996/pexels-photo-6928996.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Calendrier, loupe et pièces de monnaie posés sur un bureau","credit":"Photo : Leeloo The First / Pexels"}$wb$::jsonb;

-- academy-niveau-1-initiation · leçon 6 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,5,image}', $wb${"url":"https://images.pexels.com/photos/9870227/pexels-photo-9870227.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Mains signant un formulaire sur une table","credit":"Photo : Ron Lach / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$academy-niveau-1-initiation$wb$
   and content->'lessons'->5->>'titre' = $wb$Leçon 6 — Ouvrir un compte et passer son premier ordre$wb$
   and content->'lessons'->5->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/9870227/pexels-photo-9870227.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Mains signant un formulaire sur une table","credit":"Photo : Ron Lach / Pexels"}$wb$::jsonb;

-- academy-niveau-1-initiation · leçon 7 : garder
update public.academy_courses
   set content = jsonb_set(content, '{lessons,6,image}', $wb${"alt":"Pile de pièces de monnaie devant une horloge","credit":"Photo : Pixabay / Pexels","url":"https://images.pexels.com/photos/128867/coins-currency-investment-insurance-128867.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$academy-niveau-1-initiation$wb$
   and content->'lessons'->6->>'titre' = $wb$Leçon 7 — Les risques : apprendre avant d’investir$wb$
   and content->'lessons'->6->'image' is distinct from $wb${"alt":"Pile de pièces de monnaie devant une horloge","credit":"Photo : Pixabay / Pexels","url":"https://images.pexels.com/photos/128867/coins-currency-investment-insurance-128867.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb;

-- academy-niveau-1-initiation · leçon 8 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,7,image}', $wb${"url":"https://images.pexels.com/photos/10646406/pexels-photo-10646406.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Salle de classe vide, tables alignées et sacs d’élèves","credit":"Photo : Ron Lach / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$academy-niveau-1-initiation$wb$
   and content->'lessons'->7->>'titre' = $wb$Leçon 8 — Cas pratique : financer la scolarité de vos enfants$wb$
   and content->'lessons'->7->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/10646406/pexels-photo-10646406.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Salle de classe vide, tables alignées et sacs d’élèves","credit":"Photo : Ron Lach / Pexels"}$wb$::jsonb;

-- academy-niveau-1-initiation · leçon 9 : garder
update public.academy_courses
   set content = jsonb_set(content, '{lessons,8,image}', $wb${"alt":"Rapport financier imprimé avec graphiques, loupe et calculatrice","credit":"Photo : RDNE Stock project / Pexels","url":"https://images.pexels.com/photos/7947707/pexels-photo-7947707.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$academy-niveau-1-initiation$wb$
   and content->'lessons'->8->>'titre' = $wb$Leçon 9 — Trois stratégies d’investissement à la BRVM$wb$
   and content->'lessons'->8->'image' is distinct from $wb${"alt":"Rapport financier imprimé avec graphiques, loupe et calculatrice","credit":"Photo : RDNE Stock project / Pexels","url":"https://images.pexels.com/photos/7947707/pexels-photo-7947707.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb;

-- academy-niveau-1-initiation · leçon 10 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,9,image}', $wb${"url":"https://images.pexels.com/photos/6564816/pexels-photo-6564816.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Carte de l’Afrique de l’Ouest et du Centre, avec la Côte d’Ivoire, le Mali, le Burkina Faso et le Niger","credit":"Photo : Nothing Ahead / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$academy-niveau-1-initiation$wb$
   and content->'lessons'->9->>'titre' = $wb$Leçon 10 — Investir depuis l’étranger (diaspora)$wb$
   and content->'lessons'->9->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/6564816/pexels-photo-6564816.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Carte de l’Afrique de l’Ouest et du Centre, avec la Côte d’Ivoire, le Mali, le Burkina Faso et le Niger","credit":"Photo : Nothing Ahead / Pexels"}$wb$::jsonb;

-- academy-niveau-1-initiation · leçon 11 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,10,image}', $wb${"url":"https://images.pexels.com/photos/13208025/pexels-photo-13208025.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Balance à plateaux en laiton posée sur une étagère","credit":"Photo : Diana ✨ / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$academy-niveau-1-initiation$wb$
   and content->'lessons'->10->>'titre' = $wb$Leçon 11 — BRVM ou autres placements : une comparaison objective$wb$
   and content->'lessons'->10->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/13208025/pexels-photo-13208025.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Balance à plateaux en laiton posée sur une étagère","credit":"Photo : Diana ✨ / Pexels"}$wb$::jsonb;

-- comprendre-le-per-et-la-valorisation-a-la-brvm · leçon 1 : garder
update public.academy_courses
   set content = jsonb_set(content, '{lessons,0,image}', $wb${"alt":"Calculatrice, smartphone, loupe, réveil et signe pourcentage sur fond noir","credit":"Photo : Nataliya Vaitkevich / Pexels","url":"https://images.pexels.com/photos/6120170/pexels-photo-6120170.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$comprendre-le-per-et-la-valorisation-a-la-brvm$wb$
   and content->'lessons'->0->>'titre' = $wb$Qu’est-ce que le PER ? Définition et calcul$wb$
   and content->'lessons'->0->'image' is distinct from $wb${"alt":"Calculatrice, smartphone, loupe, réveil et signe pourcentage sur fond noir","credit":"Photo : Nataliya Vaitkevich / Pexels","url":"https://images.pexels.com/photos/6120170/pexels-photo-6120170.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb;

-- comprendre-le-per-et-la-valorisation-a-la-brvm · leçon 2 : garder
update public.academy_courses
   set content = jsonb_set(content, '{lessons,1,image}', $wb${"alt":"Main désignant des graphiques financiers affichés sur un tableau","credit":"Photo : www.kaboompics.com / Pexels","url":"https://images.pexels.com/photos/7876379/pexels-photo-7876379.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$comprendre-le-per-et-la-valorisation-a-la-brvm$wb$
   and content->'lessons'->1->>'titre' = $wb$Interpréter le PER : faible ou élevé ?$wb$
   and content->'lessons'->1->'image' is distinct from $wb${"alt":"Main désignant des graphiques financiers affichés sur un tableau","credit":"Photo : www.kaboompics.com / Pexels","url":"https://images.pexels.com/photos/7876379/pexels-photo-7876379.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb;

-- comprendre-le-per-et-la-valorisation-a-la-brvm · leçon 3 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,2,image}', $wb${"url":"https://images.pexels.com/photos/7948055/pexels-photo-7948055.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Graphique de croissance imprimé, crayons de couleur et loupe","credit":"Photo : RDNE Stock project / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$comprendre-le-per-et-la-valorisation-a-la-brvm$wb$
   and content->'lessons'->2->>'titre' = $wb$PER et croissance : le PEG$wb$
   and content->'lessons'->2->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/7948055/pexels-photo-7948055.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Graphique de croissance imprimé, crayons de couleur et loupe","credit":"Photo : RDNE Stock project / Pexels"}$wb$::jsonb;

-- comprendre-le-per-et-la-valorisation-a-la-brvm · leçon 4 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,3,image}', $wb${"url":"https://images.pexels.com/photos/7821675/pexels-photo-7821675.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Bilan comptable examiné à la loupe","credit":"Photo : RDNE Stock project / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$comprendre-le-per-et-la-valorisation-a-la-brvm$wb$
   and content->'lessons'->3->>'titre' = $wb$Limites du PER à la BRVM$wb$
   and content->'lessons'->3->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/7821675/pexels-photo-7821675.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Bilan comptable examiné à la loupe","credit":"Photo : RDNE Stock project / Pexels"}$wb$::jsonb;

-- comprendre-le-per-et-la-valorisation-a-la-brvm · leçon 5 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,4,image}', $wb${"url":"https://images.pexels.com/photos/7821548/pexels-photo-7821548.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Tableau d’états financiers imprimé et deux feutres sur un bureau","credit":"Photo : RDNE Stock project / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$comprendre-le-per-et-la-valorisation-a-la-brvm$wb$
   and content->'lessons'->4->>'titre' = $wb$Le PER dans une analyse complète$wb$
   and content->'lessons'->4->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/7821548/pexels-photo-7821548.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Tableau d’états financiers imprimé et deux feutres sur un bureau","credit":"Photo : RDNE Stock project / Pexels"}$wb$::jsonb;

-- etudes-de-cas-reels-brvm · leçon 1 : garder
update public.academy_courses
   set content = jsonb_set(content, '{lessons,0,image}', $wb${"alt":"Graphiques financiers, calculatrice, loupe et crayons sur un bureau","credit":"Photo : RDNE Stock project / Pexels","url":"https://images.pexels.com/photos/7947755/pexels-photo-7947755.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$etudes-de-cas-reels-brvm$wb$
   and content->'lessons'->0->>'titre' = $wb$Sonatel : une croissance régulière des bénéfices$wb$
   and content->'lessons'->0->'image' is distinct from $wb${"alt":"Graphiques financiers, calculatrice, loupe et crayons sur un bureau","credit":"Photo : RDNE Stock project / Pexels","url":"https://images.pexels.com/photos/7947755/pexels-photo-7947755.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb;

-- etudes-de-cas-reels-brvm · leçon 2 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,1,image}', $wb${"url":"https://images.pexels.com/photos/10284048/pexels-photo-10284048.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Rayonnages chargés de matériaux de construction dans un entrepôt","credit":"Photo : Markus Winkler / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$etudes-de-cas-reels-brvm$wb$
   and content->'lessons'->1->>'titre' = $wb$Bernabé : quand le bénéfice s’effondre, le PER explose$wb$
   and content->'lessons'->1->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/10284048/pexels-photo-10284048.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Rayonnages chargés de matériaux de construction dans un entrepôt","credit":"Photo : Markus Winkler / Pexels"}$wb$::jsonb;

-- etudes-de-cas-reels-brvm · leçon 3 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,2,image}', $wb${"url":"https://images.pexels.com/photos/38118040/pexels-photo-38118040.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Jeune palmier à huile dans une plantation","credit":"Photo : Kawê  Rodrigues / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$etudes-de-cas-reels-brvm$wb$
   and content->'lessons'->2->>'titre' = $wb$Palmci : anatomie d’une décote piège$wb$
   and content->'lessons'->2->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/38118040/pexels-photo-38118040.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Jeune palmier à huile dans une plantation","credit":"Photo : Kawê  Rodrigues / Pexels"}$wb$::jsonb;

-- etudes-de-cas-reels-brvm · leçon 4 : garder
update public.academy_courses
   set content = jsonb_set(content, '{lessons,3,image}', $wb${"alt":"Illustration d’un personnage portant une grosse pièce marquée d’une flèche vers le bas","credit":"Photo : Monstera Production / Pexels","url":"https://images.pexels.com/photos/5849571/pexels-photo-5849571.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$etudes-de-cas-reels-brvm$wb$
   and content->'lessons'->3->>'titre' = $wb$BOA Niger : le risque pays dans les comptes$wb$
   and content->'lessons'->3->'image' is distinct from $wb${"alt":"Illustration d’un personnage portant une grosse pièce marquée d’une flèche vers le bas","credit":"Photo : Monstera Production / Pexels","url":"https://images.pexels.com/photos/5849571/pexels-photo-5849571.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb;

-- ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang · leçon 1 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,0,image}', $wb${"url":"https://images.pexels.com/photos/7821684/pexels-photo-7821684.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Documents remis de main en main au-dessus d’un bureau","credit":"Photo : RDNE Stock project / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang$wb$
   and content->'lessons'->0->>'titre' = $wb$C’est quoi une introduction en bourse (IPO) ?$wb$
   and content->'lessons'->0->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/7821684/pexels-photo-7821684.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Documents remis de main en main au-dessus d’un bureau","credit":"Photo : RDNE Stock project / Pexels"}$wb$::jsonb;

-- ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang · leçon 2 : garder
update public.academy_courses
   set content = jsonb_set(content, '{lessons,1,image}', $wb${"alt":"Raffinerie et ses cheminées sous un ciel clair","credit":"Photo : Life Of Pix / Pexels","url":"https://images.pexels.com/photos/2391/dirty-industry-stack-factory.jpg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang$wb$
   and content->'lessons'->1->>'titre' = $wb$Le cas Dangote : où l’offre a-t-elle eu lieu ?$wb$
   and content->'lessons'->1->'image' is distinct from $wb${"alt":"Raffinerie et ses cheminées sous un ciel clair","credit":"Photo : Life Of Pix / Pexels","url":"https://images.pexels.com/photos/2391/dirty-industry-stack-factory.jpg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb;

-- ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang · leçon 3 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,2,image}', $wb${"url":"https://images.pexels.com/photos/8470831/pexels-photo-8470831.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Mains signant un document, deux personnes de part et d’autre","credit":"Photo : Thirdman / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang$wb$
   and content->'lessons'->2->>'titre' = $wb$Placement privé ou offre publique ? La distinction clé$wb$
   and content->'lessons'->2->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/8470831/pexels-photo-8470831.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Mains signant un document, deux personnes de part et d’autre","credit":"Photo : Thirdman / Pexels"}$wb$::jsonb;

-- ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang · leçon 4 : garder
update public.academy_courses
   set content = jsonb_set(content, '{lessons,3,image}', $wb${"alt":"Histogramme imprimé en gros plan","credit":"Photo : RDNE Stock project / Pexels","url":"https://images.pexels.com/photos/7947754/pexels-photo-7947754.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang$wb$
   and content->'lessons'->3->>'titre' = $wb$Les chiffres clés de l’offre publique$wb$
   and content->'lessons'->3->'image' is distinct from $wb${"alt":"Histogramme imprimé en gros plan","credit":"Photo : RDNE Stock project / Pexels","url":"https://images.pexels.com/photos/7947754/pexels-photo-7947754.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb;

-- ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang · leçon 5 : garder
update public.academy_courses
   set content = jsonb_set(content, '{lessons,4,image}', $wb${"alt":"Liste de contrôle et compte de résultat posés sur un bureau","credit":"Photo : Leeloo The First / Pexels","url":"https://images.pexels.com/photos/8962463/pexels-photo-8962463.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$ipo-et-processus-brvm-cas-pratique-de-l-introduction-de-dang$wb$
   and content->'lessons'->4->>'titre' = $wb$Avant de souscrire à une offre étrangère : ce qu’il faut vérifier$wb$
   and content->'lessons'->4->'image' is distinct from $wb${"alt":"Liste de contrôle et compte de résultat posés sur un bureau","credit":"Photo : Leeloo The First / Pexels","url":"https://images.pexels.com/photos/8962463/pexels-photo-8962463.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb;

-- suivi-dangote-brvm-ipo · leçon 1 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,0,image}', $wb${"url":"https://images.pexels.com/photos/37405043/pexels-photo-37405043.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Immeubles de Lagos au bord de la lagune, un bateau au premier plan","credit":"Photo : Fawaz Onakoya / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$suivi-dangote-brvm-ipo$wb$
   and content->'lessons'->0->>'titre' = $wb$Ce que retrace ce dossier$wb$
   and content->'lessons'->0->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/37405043/pexels-photo-37405043.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Immeubles de Lagos au bord de la lagune, un bateau au premier plan","credit":"Photo : Fawaz Onakoya / Pexels"}$wb$::jsonb;

-- suivi-dangote-brvm-ipo · leçon 2 : garder
update public.academy_courses
   set content = jsonb_set(content, '{lessons,1,image}', $wb${"alt":"Raffinerie et ses cheminées sous un ciel clair","credit":"Photo : Life Of Pix / Pexels","url":"https://images.pexels.com/photos/2391/dirty-industry-stack-factory.jpg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$suivi-dangote-brvm-ipo$wb$
   and content->'lessons'->1->>'titre' = $wb$Avant l’offre publique (mars à juillet 2026)$wb$
   and content->'lessons'->1->'image' is distinct from $wb${"alt":"Raffinerie et ses cheminées sous un ciel clair","credit":"Photo : Life Of Pix / Pexels","url":"https://images.pexels.com/photos/2391/dirty-industry-stack-factory.jpg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb;

-- suivi-dangote-brvm-ipo · leçon 3 : garder
update public.academy_courses
   set content = jsonb_set(content, '{lessons,2,image}', $wb${"alt":"Main entourant une date sur un calendrier","credit":"Photo : Towfiqu barbhuiya / Pexels","url":"https://images.pexels.com/photos/11773871/pexels-photo-11773871.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$suivi-dangote-brvm-ipo$wb$
   and content->'lessons'->2->>'titre' = $wb$L’offre publique (septembre à octobre 2026)$wb$
   and content->'lessons'->2->'image' is distinct from $wb${"alt":"Main entourant une date sur un calendrier","credit":"Photo : Towfiqu barbhuiya / Pexels","url":"https://images.pexels.com/photos/11773871/pexels-photo-11773871.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"}$wb$::jsonb;

-- suivi-dangote-brvm-ipo · leçon 4 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,3,image}', $wb${"alt":"Bâtiment de la Bourse Régionale des Valeurs Mobilières (BRVM) à Abidjan","credit":"Photo : Wikimedia Commons (BRVM, Abidjan)","url":"https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/BRVM.jpg/960px-BRVM.jpg"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$suivi-dangote-brvm-ipo$wb$
   and content->'lessons'->3->>'titre' = $wb$Et la BRVM ?$wb$
   and content->'lessons'->3->'image' is distinct from $wb${"alt":"Bâtiment de la Bourse Régionale des Valeurs Mobilières (BRVM) à Abidjan","credit":"Photo : Wikimedia Commons (BRVM, Abidjan)","url":"https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/BRVM.jpg/960px-BRVM.jpg"}$wb$::jsonb;

-- suivi-dangote-brvm-ipo · leçon 5 : remplacer
update public.academy_courses
   set content = jsonb_set(content, '{lessons,4,image}', $wb${"url":"https://images.pexels.com/photos/7821674/pexels-photo-7821674.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Main tenant une loupe au-dessus de relevés financiers","credit":"Photo : RDNE Stock project / Pexels"}$wb$::jsonb, true),
       updated_at = now()
 where slug = $wb$suivi-dangote-brvm-ipo$wb$
   and content->'lessons'->4->>'titre' = $wb$Ce qui reste à confirmer$wb$
   and content->'lessons'->4->'image' is distinct from $wb${"url":"https://images.pexels.com/photos/7821674/pexels-photo-7821674.jpeg?auto=compress&cs=tinysrgb&h=650&w=940","alt":"Main tenant une loupe au-dessus de relevés financiers","credit":"Photo : RDNE Stock project / Pexels"}$wb$::jsonb;

commit;
