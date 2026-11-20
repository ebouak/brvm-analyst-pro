# Diffusion presse ouverte — design

## Objectif

Rendre les publications WESTBOURSE découvrables automatiquement par Google
News, MSN Partner Hub, Flipboard et les autres lecteurs RSS compatibles, sans
dupliquer le contenu ni exposer de donnée privée.

## Décisions

- Google News ne reçoit pas de « bouton de publication » : il crawle les pages
  publiques conformes et un news sitemap récent.
- Le flux RSS référence les articles publiés ; il ne recopie pas leur corps.
- Le news sitemap ne contient que les publications des 48 dernières heures,
  conformément au format Google News.
- `articles` est la source des articles de presse courants. `citable_pages`
  reste hors des flux.
- Les routes XML sont publiques dans le middleware.

## Composants

1. `lib/syndication/articles.ts`
   - charge les articles publiés avec la clé anon ;
   - lève explicitement sur erreur Supabase, sauf absence de table pendant le
     repli de compatibilité ;
   - borne les listes et ordonne par `publie_le` décroissant.

2. `/rss.xml`
   - RSS 2.0 avec titre, chapô, date, lien canonique, GUID permanent et image ;
   - échappe tout XML ;
   - cache court (`Cache-Control: public, max-age=300, s-maxage=300`) ;
   - répond un document XML valide même sans article.

3. `/news-sitemap.xml`
   - XML standard avec espace de noms `news` ;
   - filtre dur à 48 heures côté fonction ;
   - titre, langue `fr`, nom `WESTBOURSE`, date ISO et URL canonique ;
   - 1 000 entrées maximum.

4. Accès public
   - `/rss.xml` et `/news-sitemap.xml` dans les chemins publics exacts ;
   - news sitemap déclaré dans `robots.txt` ;
   - RSS déclaré par auto-découverte dans les métadonnées HTML.

## Donnée Coris

L'analyse Coris est une page citable existante, avec métadonnées `NewsArticle`.
La V1 l'ajoute aux deux flux via un objet éditorial statique commun, sans créer
de second article en base. Cette entrée sort naturellement du news sitemap après
48 heures et reste dans le RSS pendant son horizon de 50 éléments.

## Erreurs et sécurité

- Aucune clé service_role dans les routes.
- Une erreur de lecture est explicite ; pas de fausse réponse « succès ».
- Les textes HTML/XML et les attributs sont encodés.
- Aucun article brouillon ne quitte RLS.
- Les routes n'acceptent aucun paramètre de requête.

## Tests

- Échappement XML et transformation de date.
- Filtre 48 heures, bornes inclusives et ancien article exclu.
- RSS contient uniquement des liens `/actualites/...` publiés.
- News sitemap inclut la publication Coris récente.
- Les deux chemins sont reconnus publics.

## Validation

- `npm test -- --run lib/syndication/*.test.ts`
- `npm run typecheck`
- Build Next.js
- En production : `200`, `Content-Type: application/xml` ou RSS, XML parsable,
  article Coris présent.

## Hors périmètre

- Garantir une inclusion Google News.
- Contourner les validations Flipboard/MSN.
- Publier automatiquement sur des plateformes qui exigent une approbation ou
  une connexion humaine.
- Ajouter une nouvelle table ou migration.
