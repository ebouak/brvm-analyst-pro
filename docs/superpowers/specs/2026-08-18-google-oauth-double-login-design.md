# Bug OAuth Google — double connexion nécessaire — Design

## Contexte

Signalé par l'utilisateur : certains utilisateurs doivent cliquer « Continuer avec Google » deux fois avant que la connexion aboutisse. Au premier essai, l'utilisateur revient sur `/login` sans message d'erreur visible ; le second essai fonctionne.

## Diagnostic (lecture de code, avant tout changement)

Flux actuel :
1. `app/login/SignInClient.tsx` → `onGoogle` appelle `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` } })`. Aucune gestion d'erreur sur cet appel.
2. Google redirige vers `/auth/callback` avec un `code`.
3. `app/auth/callback/route.ts` échange ce code contre une session via `exchangeCodeForSession(code)`. En cas d'échec, l'erreur réelle de Supabase est **jetée** (jamais loguée, jamais examinée) ; la route redirige systématiquement vers `/login?error=Authentification échouée, réessayez.` (message générique en dur).
4. `app/login/page.tsx` lit bien `searchParams.error` et l'affiche dans un bandeau fixe en haut de page (`fixed top-4`, bordé, visible).

**Deux problèmes distincts identifiés :**

- **Observabilité nulle** : impossible de savoir aujourd'hui pourquoi `exchangeCodeForSession` échoue (code_verifier invalide, code expiré, mismatch de domaine, etc.) — l'erreur Supabase n'est jamais loguée côté serveur.
- **Point de risque concret** : `redirectTo` utilise `window.location.origin`, capturé au moment du clic côté navigateur. Le cookie PKCE (`code_verifier`) posé par `signInWithOAuth` est lié à cette origine. Si l'utilisateur arrive sur une origine non-canonique (ancien lien vers `frontend-zeta-ten-22.vercel.app`, apex `westbourse.com` sans `www`, etc.), et que la redirection Google revient sur une origine différente de celle où le cookie a été posé, `exchangeCodeForSession` échoue systématiquement au premier essai. C'est l'hypothèse la plus probable compte tenu du symptôme (échec silencieux, sans pattern par utilisateur identifié, résolu par un second essai qui a de bonnes chances de retomber sur la bonne origine une fois le premier échec passé).

Le symptôme rapporté (« revient sans message ») reste à confirmer : le bandeau d'erreur existe et est visible dans le code — soit il s'affiche mais passe inaperçu, soit l'échec court-circuite complètement `/auth/callback` (cas non couvert par la lecture de code seule).

## Approche retenue

Les deux changements ci-dessous sont faits **ensemble**, dans le même correctif :

### 1. Logger l'erreur réelle (observabilité)

Dans `app/auth/callback/route.ts`, loguer `error` (message + code Supabase) avant de rediriger, avec le logger serveur déjà utilisé ailleurs dans le projet. Objectif : au prochain cas réel, avoir la cause exacte en logs Vercel plutôt que de deviner.

### 2. Fixer l'origine canonique (correctif défensif)

Dans `app/login/SignInClient.tsx`, remplacer `window.location.origin` par une constante d'origine canonique (`https://www.westbourse.com`, cohérente avec `CANONICAL_ORIGIN` déjà défini dans `middleware.ts`) pour construire `redirectTo`. Élimine la classe de bug « cookie posé sur une origine, callback reçu sur une autre » quelle que soit l'URL depuis laquelle l'utilisateur a initié la connexion.

En local/preview (origine ≠ canonique), on garde `window.location.origin` pour ne pas casser le développement — la constante canonique ne s'applique qu'en production.

## Hors scope

- Pas de changement du flux OTP e-mail (non concerné par ce bug).
- Pas de nouvelle télémétrie/analytics au-delà du log serveur ponctuel.
- Si le logging révèle une cause différente de l'hypothèse ci-dessus, un correctif de suivi sera nécessaire — hors scope de cette itération.

## Tests

- Test existant à vérifier non cassé : aucun test automatisé actuel ne couvre ce flux OAuth (flux nécessitant une vraie session Google — non testable en CI sans mock du provider). Vérification manuelle post-déploiement uniquement.
