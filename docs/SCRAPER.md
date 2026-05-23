# Documentation technique — Scraping BDFIN (ASP.NET WebForms)

Référence : Cahier des charges §11 (contraintes critiques) et §12.9.

## 1. Nature de la source

BDFIN (`https://bfin.brvm.org`) est une application **ASP.NET WebForms**.
Conséquences pour le scraping :

- L'état de la page est porté par des champs cachés **`__VIEWSTATE`**,
  **`__VIEWSTATEGENERATOR`**, **`__EVENTVALIDATION`** (et parfois
  `__VIEWSTATEENCRYPTED`, `__PREVIOUSPAGE`).
- Toute interaction (connexion, changement de date, pagination) est un
  **postback** : un `POST` `application/x-www-form-urlencoded` qui **renvoie
  ces champs cachés tels quels**, plus `__EVENTTARGET` / `__EVENTARGUMENT`
  désignant le contrôle déclencheur.
- La session est portée par des **cookies** (`ASP.NET_SessionId` + cookie
  d'authentification Forms). Ils **doivent être conservés** entre toutes les
  requêtes → on utilise un **cookie jar** persistant (`tough-cookie` via
  `axios-cookiejar-support`).

Si un de ces éléments manque, le serveur renvoie soit une erreur de validation
d'événement, soit la page de login.

## 2. Séquence des requêtes

### 2.1 Connexion (`client/auth.ts`)

1. `GET BDFIN_LOGIN_PATH` → on récupère tous les `<input type="hidden">`
   (`extractAspNetState`) **et** le cookie de session se dépose dans le jar.
2. On construit le corps du postback (`buildPostback`) :
   - tous les champs cachés reçus, inchangés ;
   - `__EVENTTARGET` = UniqueID du bouton de connexion ;
   - le champ identifiant, le champ mot de passe, la valeur du bouton.
3. `POST BDFIN_LOGIN_PATH` avec ce corps. ASP.NET répond généralement par un
   `302` vers l'accueil et pose le cookie d'auth Forms ; le jar suit la
   redirection.
4. On vérifie qu'on **n'est plus** sur la page de login
   (`looksLikeLoginPage`). Sinon → `AuthError`.

### 2.2 Page marché — séance courante (`scrapeLatest`)

`GET BDFIN_MARKET_PATH` authentifié. Si la réponse ressemble au login, on se
reconnecte automatiquement une fois (`getAuthenticated`).

### 2.3 Page marché — date précise (`scrapeDate`, reprise §6.5)

1. `GET` de la page pour relire l'état ASP.NET courant.
2. Conversion de la date `YYYY-MM-DD` → `jj/mm/aaaa`.
3. `POST` postback sur le contrôle « Afficher » avec le champ date renseigné.
4. Parsing de la réponse.

## 3. Parsing (`parsers/`)

Les tableaux sont des **GridView** rendus en `<table>`. Plutôt que des index
de colonnes fixes (fragiles), on mappe **par libellé d'en-tête normalisé**
(`buildColumnIndex`, 2 passes : exact puis inclusion). Avantages :

- résiste à l'ajout/réordonnancement de colonnes ;
- une colonne n'est jamais affectée à deux champs (l'alias générique « cours »
  ne vole pas la colonne « cours précédent »).

Normalisation numérique (`utils/parseNumber.ts`) : gère l'espace insécable
comme séparateur de milliers, la virgule décimale, les `%`, `FCFA`, les
parenthèses comptables négatives, et les valeurs nulles (`-`, `—`, `N/A`).

## 4. Calibrage avant production ⚠️

Les valeurs suivantes sont des **défauts à confirmer** sur le markup réel :

| Élément | Fichier | Constante |
|---|---|---|
| Champs du formulaire de login | `client/auth.ts` | `LOGIN_FIELDS` |
| Sélecteur de date + bouton | `scrapers/activitesMarche.ts` | `MARKET_DATE_FIELDS` |
| Sélecteurs tableaux actions | `parsers/actions.ts` | `ACTIONS_TABLE_SELECTORS` |
| Sélecteurs tableaux obligations | `parsers/obligations.ts` | `OBLIGATIONS_TABLE_SELECTORS` |
| Sélecteurs indices | `parsers/indices.ts` | `INDICES_TABLE_SELECTORS` |
| Alias d'en-têtes | `parsers/*.ts` | `COLUMN_SPEC` |

**Procédure de calibrage :**

1. Connectez-vous manuellement à BDFIN dans un navigateur.
2. Sur la page de login, inspectez les `name=` exacts des champs identifiant /
   mot de passe / bouton (`ctl00$ContentPlaceHolder1$...`) et reportez-les dans
   `LOGIN_FIELDS`.
3. Sur `Activites_marche.aspx`, relevez les `id`/`name` des `<table>` GridView
   et le nom du sélecteur de date ; ajustez les `*_SELECTORS` et
   `MARKET_DATE_FIELDS`.
4. Comparez les libellés d'en-têtes réels aux alias de `COLUMN_SPEC` ; ajoutez
   les variantes manquantes (le matching est insensible à la casse/accents).
5. Lancez `npm run scrape:daily` avec `DRY_RUN=true` et `LOG_LEVEL=debug` pour
   vérifier les comptages avant d'écrire en base.

> Astuce : enregistrez un dump HTML d'une vraie page dans
> `tests/fixtures/` et adaptez `tests/parsers.test.ts` : vous obtenez une
> régression qui casse explicitement si BDFIN change son markup (§11).

## 5. Robustesse (§6.5)

- **Retry** exponentiel + jitter sur erreurs réseau / 5xx / 429
  (`utils/retry.ts`, paramétré par `HTTP_MAX_RETRIES`, `HTTP_RETRY_BASE_MS`).
- **Reconnexion** automatique si la session expire en cours de route.
- **Mode mock** (`USE_MOCK`/`--mock`) si la source est indisponible (§11).
- **Hash source** : `scrape_runs.hash_source` permet de détecter qu'une séance
  n'a pas été mise à jour (même HTML que la veille).
- **Idempotence** : upsert sur `(code, date_marche)` → relancer une date ne
  duplique rien.
- **Proxy** : si BDFIN bloque les IP de votre hébergeur, faites transiter les
  requêtes par une Edge Function Supabase ou un proxy sortant fixe, et pointez
  `BDFIN_BASE_URL` dessus (le code reste inchangé).

## 6. Sécurité (§6.6)

- Secrets uniquement en variables d'environnement.
- La clé `service_role` n'est utilisée que par ce worker backend ; jamais
  exposée au frontend. Elle bypass la RLS par conception.
- Le logger masque (`redact`) mots de passe, clés et cookies.
- Les logs techniques (`scrape_runs`) sont séparés des données utilisateur.
