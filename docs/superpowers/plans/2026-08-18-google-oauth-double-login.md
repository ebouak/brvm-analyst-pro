# Correctif double connexion Google OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger le bug où certains utilisateurs doivent cliquer « Continuer avec Google » deux fois avant que la connexion aboutisse, en instrumentant l'erreur réelle et en éliminant le point de risque identifié (mismatch d'origine pour le cookie PKCE).

**Architecture:** Deux modifications indépendantes dans le flux OAuth existant (Next.js 14 App Router + `@supabase/ssr`) : (1) logger l'erreur réelle de `exchangeCodeForSession` dans la route de callback au lieu de la jeter silencieusement ; (2) fixer l'origine canonique du `redirectTo` en production pour que le cookie PKCE soit toujours posé et relu sur le même hôte.

**Tech Stack:** Next.js 14 App Router (Route Handlers), `@supabase/supabase-js` / `@supabase/ssr`, TypeScript.

---

### Task 1 : Logger l'erreur réelle dans la route de callback

**Files:**
- Modify: `frontend/app/auth/callback/route.ts`

- [ ] **Step 1 : Lire le fichier actuel pour confirmer les lignes exactes**

Contenu actuel (`frontend/app/auth/callback/route.ts`) :

```ts
// Échange le code OAuth (Google) contre une session Supabase, puis redirige.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Authentification échouée, réessayez.')}`,
  );
}
```

- [ ] **Step 2 : Ajouter le logging de l'erreur réelle, et distinguer le cas « pas de code »**

Remplacer le corps de la fonction par :

```ts
// Échange le code OAuth (Google) contre une session Supabase, puis redirige.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    console.error('auth/callback: aucun code dans l\'URL de retour OAuth', {
      url: request.url,
    });
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Authentification échouée, réessayez.')}`,
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('auth/callback: exchangeCodeForSession a échoué', {
      message: error.message,
      status: error.status,
      code: error.code,
    });
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Authentification échouée, réessayez.')}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
```

Note : `error.code` existe sur `AuthError` (type retourné par `exchangeCodeForSession`) — c'est le champ le plus utile pour diagnostiquer (ex. `bad_code_verifier`, `flow_state_expired`). Le message utilisateur affiché reste inchangé (générique, en français) ; seul le log serveur gagne en détail.

- [ ] **Step 3 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur (le type `AuthError` de `@supabase/supabase-js` expose bien `message`, `status`, `code`).

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/auth/callback/route.ts
git commit -m "fix(auth): logue l'erreur réelle d'échange de code OAuth au lieu de la jeter"
```

---

### Task 2 : Fixer l'origine canonique du redirectTo en production

**Files:**
- Modify: `frontend/app/login/SignInClient.tsx`

- [ ] **Step 1 : Ajouter la constante d'origine canonique**

Dans `frontend/app/login/SignInClient.tsx`, après le bloc `TURNSTILE_SITE_KEY` (ligne 19), ajouter :

```ts
// Origine canonique de production — cohérente avec CANONICAL_ORIGIN dans
// middleware.ts. Le cookie PKCE (code_verifier) posé par signInWithOAuth est
// lié à l'origine utilisée ici : si un utilisateur arrive par un lien
// non-canonique (ancien domaine Vercel, apex sans www), window.location.origin
// diffère de l'origine où Google revient après le middleware, et
// exchangeCodeForSession échoue au premier essai. On fixe donc l'origine en
// production ; en local/preview on garde window.location.origin pour ne pas
// casser le développement (pas de domaine canonique fixe hors prod).
const CANONICAL_ORIGIN = 'https://www.westbourse.com';
const oauthOrigin =
  process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ? CANONICAL_ORIGIN : window.location.origin;
```

Cette constante doit être définie **à l'intérieur du composant** (elle utilise `window.location.origin`, non disponible au niveau module côté serveur) — la placer juste avant le `return` du composant, pas au niveau fichier.

- [ ] **Step 2 : Utiliser `oauthOrigin` dans l'appel OAuth**

Remplacer dans `onGoogle` :

```ts
onGoogle={async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
    },
  });
}}
```

par :

```ts
onGoogle={async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${oauthOrigin}/auth/callback?next=/dashboard`,
    },
  });
}}
```

- [ ] **Step 3 : Vérifier la variable d'environnement utilisée**

`NEXT_PUBLIC_VERCEL_ENV` est injectée automatiquement par Vercel (`production` | `preview` | `development`) sans configuration manuelle — contrairement à `VERCEL_ENV` (sans le préfixe `NEXT_PUBLIC_`), qui n'est PAS exposée côté client. Confirmer qu'aucune variable custom n'existe déjà pour ça :

Run: `cd frontend && grep -rn "VERCEL_ENV" . --include="*.ts" --include="*.tsx" -l`
Expected: aucun autre fichier ne dépend de cette variable de façon incompatible (si le grep ne retourne que le fichier qu'on vient de modifier, c'est bon).

- [ ] **Step 4 : Vérifier le typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add frontend/app/login/SignInClient.tsx
git commit -m "fix(auth): fixe l'origine canonique du redirectTo OAuth en production"
```

---

### Task 3 : Déploiement et vérification manuelle

**Files:** aucun (déploiement + vérification)

- [ ] **Step 1 : Pousser sur main**

Run: `git push`
Expected: push accepté (pas de secret détecté, pas de conflit).

- [ ] **Step 2 : Déclencher le déploiement Vercel**

Run: `gh workflow run "Deploy Frontend to Vercel"`

Puis surveiller :
Run: `gh run list --workflow="Deploy Frontend to Vercel" --limit 1 --json databaseId,status,conclusion`
Expected: `conclusion: "success"` après complétion.

- [ ] **Step 3 : Vérification manuelle du flux normal**

Sur `https://www.westbourse.com/login`, cliquer « Continuer avec Google » avec un compte de test, confirmer l'arrivée sur `/dashboard` sans second essai nécessaire.

- [ ] **Step 4 : Documenter le point de suivi**

Ce correctif n'élimine que l'hypothèse la plus probable. Si le bug se reproduit après déploiement, les logs Vercel de `auth/callback` (Runtime Logs, filtrer sur `exchangeCodeForSession a échoué`) donneront désormais la cause exacte (`error.code`) — noter ce point dans le message de suivi à l'utilisateur plutôt que de le considérer clos sans confirmation.

---

## Self-Review

**1. Spec coverage :**
- Logging de l'erreur réelle → Task 1. ✅
- Origine canonique en production, comportement inchangé en local/preview → Task 2. ✅
- Pas de nouveaux tests automatisés (flux OAuth non mockable en CI) → aucune Task de test ajoutée, cohérent avec la spec. ✅
- Vérification manuelle post-déploiement → Task 3. ✅

**2. Placeholder scan :** aucun TBD/TODO ; chaque step contient le code exact à écrire.

**3. Type consistency :** `oauthOrigin` défini une fois (Task 2 Step 1), utilisé une fois (Task 2 Step 2) — pas de divergence de nom. `error.code`/`error.status`/`error.message` correspondent aux champs réels de `AuthError` (`@supabase/supabase-js`).
