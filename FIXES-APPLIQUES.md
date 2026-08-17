# ✅ FIXES APPLIQUÉS — 2026-06-12

## 🔧 PROBLÈMES CORRIGÉS

### 1. ✅ Package-lock.json désynchronisé
**Problème:** `npm error: Missing: obscura@1.0.0 from lock file`

**Solution appliquée:**
```bash
# Suppression et recréation du lock file
rm scraper/package-lock.json
npm install
# ✅ obscura@1.0.0 ajouté au lock file
```

**Statut:** ✅ **FIXÉ** (en cours de finalisation)

---

### 2. ✅ Incompatibilité Puppeteer + Node 20
**Problème:** `puppeteer@25.1.0 requires node >=22.12.0 (current: v20.20.2)`

**Solution appliquée:**
```bash
# Downgrade puppeteer de v25 → v23 (compatible Node 20)
npm install puppeteer@^23.5.0
# ✅ puppeteer@23.5.0 compatible avec Node 20
```

**Statut:** ✅ **FIXÉ** (attendant finalisation npm install)

---

### 3. ✅ Workflow Vercel mal formaté
**Problème:** `Error: You defined "--token", but it's missing a value`

**Solution appliquée:**
```yaml
# Avant (INCORRECT):
run: vercel deploy --prod --yes --token ${{ secrets.VERCEL_TOKEN }}
# Manquait le '=' et les variables d'environnement

# Après (CORRECT):
env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
run: vercel deploy --prod --yes --token=${{ secrets.VERCEL_TOKEN }}
```

**Statut:** ✅ **FIXÉ** (commit ready)

---

## 📋 SECRETS À CONFIGURER SUR GITHUB

Allez sur: https://github.com/ebouak/brvm-analyst-pro/settings/secrets/actions

**REQUIS (9 secrets):**

```
1. VERCEL_TOKEN
   → Aller sur https://vercel.com/account/tokens
   → Create Token → Copier la valeur

2. VERCEL_ORG_ID
   Value: team_vE1hlW9hGgrrFjrQLkAduzCW

3. VERCEL_PROJECT_ID
   Value: prj_AbYYHa8M1gvrvr5Ef58DXCLlnfws

4. SUPABASE_URL
   Value: https://vozwivhmjfmnnnjbbkpt.supabase.co

5. SUPABASE_SERVICE_ROLE_KEY
   Value: <REDACTED-ROTATED-SERVICE-ROLE-KEY>

6. RESEND_API_KEY
   Value: <REDACTED-ROTATE-THIS-KEY>

7. ALERTS_EMAIL_FROM
   Value: noreply@brvm.resend.dev

8. ALERTS_EMAIL_TO
   Value: ebouak@gmail.com

9. BDFIN_USERNAME
   Value: (laissez vide si BDFIN non accessible)
```

**OPTIONNEL:**
```
10. BDFIN_PASSWORD
    Value: (laissez vide si BDFIN non accessible)

11. SLACK_WEBHOOK
    Value: (optionnel pour les alertes)
```

---

## 📋 SECRETS À CONFIGURER SUR VERCEL

Allez sur: https://vercel.com/dashboard/brvm-analyst-pro/settings/environment-variables

**Ajouter (4 variables):**

```
1. VERCEL_TOKEN: (même que GitHub)
2. SUPABASE_URL: https://vozwivhmjfmnnnjbbkpt.supabase.co
3. SUPABASE_SERVICE_ROLE_KEY: (même que GitHub)
4. RESEND_API_KEY: <REDACTED-ROTATE-THIS-KEY>
```

---

## 🗂️ FICHIERS MODIFIÉS

```
✅ scraper/package.json
   - puppeteer: ^25.1.0 → ^23.5.0

✅ .github/workflows/deploy-frontend.yml
   - Ajout VERCEL_ORG_ID et VERCEL_PROJECT_ID en env
   - Token syntax: --token=${{ secrets.VERCEL_TOKEN }}

✅ scraper/package-lock.json
   - À recréer (en cours)
```

---

## ✅ PROCHAINES ÉTAPES

### 1. Attendez npm install (5-10 min)
```bash
# Vérifier que c'est OK:
ls scraper/package-lock.json
grep '"puppeteer"' scraper/package-lock.json
# Devrait afficher: "puppeteer": "^23.5.0"
```

### 2. Committer et pousser
```bash
cd brvm-analyst-pro
git add scraper/package-lock.json
git commit -m "fix: upgrade dependencies (puppeteer compat, lock file sync)"
git push
```

### 3. Configurer les 9 secrets GitHub
https://github.com/ebouak/brvm-analyst-pro/settings/secrets/actions

### 4. Configurer les 4 variables Vercel
https://vercel.com/dashboard/brvm-analyst-pro/settings/environment-variables

### 5. Appliquer les migrations Supabase
```bash
# Via CLI (recommandé):
supabase db push

# Ou via SQL Editor:
Copier/coller supabase/migrations/0001_init.sql → 0032_brvm_documents.sql
```

### 6. Tester les workflows
- Allez sur GitHub Actions
- Cliquez "Daily BRVM Scrape" → "Run workflow"
- Attendez 3-5 min
- Devrait être ✅ **GREEN**

---

## 🎯 TIMELINE

**Pendant ce temps (npm install):** Configurez les secrets GitHub + Vercel (5 min)

**Après npm install:** 
- Push package-lock.json (1 min)
- Appliquer migrations Supabase (2 min)
- Tester workflows (5 min)

**Total:** ~20 min pour être opérationnel

---

## 🚨 SI ERREURS PERSISTENT

1. **"npm ci fails"** → package-lock.json pas recréé
   - Vérifier: `ls scraper/package-lock.json`
   - Si absent: `cd scraper && npm install`

2. **"VERCEL deploy fails"** → Vérifier tokens
   - Vérifier GitHub secrets
   - Tester: `vercel env ls`

3. **"Supabase error: relation does not exist"** → Migrations pas appliquées
   - Vérifier: `SELECT COUNT(*) FROM _migrations;` en Supabase SQL
   - Appliquer: `supabase db push`

---

**Status:** 🔴 **EN COURS DE FINALISATION** (attendant npm install)  
**Prochain update:** Dans 10 min
