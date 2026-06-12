# Appliquer les migrations Supabase

## Méthode 1: CLI Supabase (RECOMMANDÉ)

### Étape 1: Installer Supabase CLI
```bash
npm install -g @supabase/cli
```

### Étape 2: Se connecter à votre projet
```bash
supabase login
# Vous sera demandé de générer un token access:
# https://app.supabase.com/account/tokens
# Créer un "Personal access token" et le coller
```

### Étape 3: Pointer vers votre projet
```bash
supabase projects list
# Copier le Project ID: vozwivhmjfmnnnjbbkpt

supabase link --project-ref vozwivhmjfmnnnjbbkpt
```

### Étape 4: Appliquer toutes les migrations
```bash
cd brvm-analyst-pro
supabase db push
# Cela appliquera toutes les migrations 0001-0032 dans l'ordre
```

Attendez ~2 min. Vous verrez:
```
✅ Applying migration supabase/migrations/0001_init.sql
✅ Applying migration supabase/migrations/0002_views.sql
✅ Applying migration supabase/migrations/0003_rls.sql
...
✅ Applying migration supabase/migrations/0032_brvm_documents.sql
```

---

## Méthode 2: Supabase SQL Editor (SI CLI ne fonctionne pas)

### Étape 1: Appliquer les migrations par blocs

Allez sur: https://app.supabase.com/project/vozwivhmjfmnnnjbbkpt/sql/new

Copiez-collez les migrations **UNE PAR UNE** dans cet ordre:

**Bloc 1** (Schéma initial):
```bash
cat supabase/migrations/0001_init.sql
```

Copier le CONTENU entier → Coller dans SQL Editor → **Run**

**Bloc 2** (Vues):
```bash
cat supabase/migrations/0002_views.sql
```
Coller → **Run**

**Bloc 3** (RLS):
```bash
cat supabase/migrations/0003_rls.sql
```
Coller → **Run**

...et ainsi de suite pour **tous les fichiers 0004 à 0032**

### Étape 2: Vérifier que tout est appliqué
```sql
SELECT COUNT(*) FROM _migrations;
-- Vous devriez voir: 32 migrations
```

---

## Vérification finale

Une fois les migrations appliquées, exécutez:

```sql
-- Vérifier que les tables existent
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Vous devriez voir ~40+ tables (brvm_actions_daily, paper_trading_positions, etc.)
```

---

## SI Supabase CLI ne marche pas

Télécharger ce script:
```bash
# Générer le fichier SQL complet
cd brvm-analyst-pro
ls supabase/migrations/000*.sql | while read f; do cat "$f"; echo ""; done > /tmp/all_migrations.sql

# Copier /tmp/all_migrations.sql et coller dans Supabase SQL Editor
```

---

**Ensuite:** Une fois les migrations appliquées, GitHub Actions devrait fonctionner! ✅
