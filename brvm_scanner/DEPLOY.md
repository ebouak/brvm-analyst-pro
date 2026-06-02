# Déploiement — Streamlit Community Cloud

L'app BRVM Scanner se déploie gratuitement sur **Streamlit Community Cloud**
depuis le dépôt GitHub `ebouak/brvm-analyst-pro`.

## Pré-requis (déjà en place)

- Code poussé sur GitHub (branche `main`)
- `brvm_scanner/app.py` — point d'entrée
- `brvm_scanner/requirements.txt` — dépendances
- La clé Supabase **anon** (publique, RLS) est intégrée par défaut → l'app
  fonctionne sans configurer de secret.

## Étapes (5 minutes)

1. Aller sur **https://share.streamlit.io** et se connecter avec GitHub.
2. Cliquer **« New app »** → **« Deploy a public app from GitHub »**.
3. Renseigner :
   - **Repository** : `ebouak/brvm-analyst-pro`
   - **Branch** : `main`
   - **Main file path** : `brvm_scanner/app.py`
4. (Optionnel) **Advanced settings → App URL** : choisir `brvm-scanner`
   → l'URL finale sera `https://brvm-scanner.streamlit.app`.
5. Cliquer **« Deploy »**. La première build installe les dépendances (~2 min).

## Secrets (optionnel)

Inutile par défaut (clé anon publique intégrée). Pour pointer vers un autre
projet Supabase, ouvrir **App → Settings → Secrets** et coller :

```toml
SUPABASE_URL = "https://VOTRE-PROJET.supabase.co"
SUPABASE_ANON_KEY = "votre-cle-anon"
```

## Première utilisation

À l'ouverture, l'app peut être vide si le dépôt ne contient pas les CSV/PDF
(ils sont git-ignorés). Cliquer **« 🔄 Synchroniser depuis Supabase »** dans la
barre latérale : l'app télécharge cours + états financiers et génère les
fondamentaux à la volée.

> Note : sur Streamlit Cloud le système de fichiers est **éphémère** (réinitialisé
> à chaque redémarrage). La synchro est donc à relancer après une mise en veille,
> ou à automatiser. Pour une persistance durable, l'étape suivante consiste à
> stocker les fondamentaux dans une table Supabase (cf. README, « Option C »).

## Mettre à jour l'app

Chaque `git push` sur `main` redéploie automatiquement l'app Streamlit Cloud.
