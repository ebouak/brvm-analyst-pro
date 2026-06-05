# Outil d'import de fondamentaux par IA (multi-LLM) — design

Date : 2026-06-05
Statut : validé (en attente revue spec)

## 1. Objectif

Permettre de **déposer des PDF d'états financiers** dans le site Next.js et de
les faire analyser automatiquement par un LLM (cascade **DeepSeek → Mistral →
Grok**, DeepSeek prioritaire) pour remplir les champs fondamentaux
(`revenue`, `net_income`, `equity`, `debt`, `cash`, `shares`) et les écrire en
base — automatiquement si plausibles, avec validation manuelle sinon.

Remplace le processus actuel (extraction LLM par subagents Claude Code, manuel)
par un outil web autonome et réutilisable.

## 2. Architecture

Page **`/admin/import-fondamentaux`** (accessible à tout utilisateur connecté).
Traitement **côté navigateur** (extraction PDF + orchestration) pour contourner
les limites Vercel (timeout, taille upload). Les appels LLM passent par une
**route API mince** côté serveur (les clés ne sont jamais exposées au client).

### Flux pour un PDF (traités un par un)
1. **Drop** d'un ou plusieurs PDF.
2. **Extraction** (`lib/import/pdfClient.ts`, navigateur, pdf.js) :
   - PDF avec couche texte → texte brut.
   - PDF scanné (texte < seuil) → rendu des pages en **images** (canvas/dataURL).
3. **Cascade LLM** (route `POST /api/extract-llm`) :
   - voie **texte** → DeepSeek → Mistral → Grok (1er disponible qui répond) ;
   - voie **scannée (images)** → Mistral vision → Grok vision (DeepSeek sauté,
     pas de vision).
4. **Garde-fous** (`lib/import/validate.ts`, réutilise `assessQuality`) :
   chaque champ classé ok / suspect / missing.
   - 0 champ suspect → statut **auto** → écriture directe en base.
   - ≥1 champ suspect → statut **review** → formulaire pré-rempli, champ
     surligné, l'utilisateur corrige puis enregistre.
5. **Écriture** : route existante `POST /api/fundamentals` (service_role,
   `is_manual=true`). Le nombre d'actions va dans `brvm_instruments.shares`.

## 3. Composants

```
frontend/
├── app/admin/import-fondamentaux/page.tsx   # dropzone + liste de traitement (client)
├── app/api/extract-llm/route.ts             # relais LLM serveur (cascade)
├── components/import/
│   ├── PdfDropzone.tsx                       # drag & drop multi-fichiers
│   ├── ImportRow.tsx                         # 1 PDF : statut + champs + actions
│   └── FundamentalReview.tsx                 # formulaire pré-rempli (corrige + enregistre)
└── lib/import/
    ├── pdfClient.ts                          # pdf.js : texte OU images (scanné)
    ├── llmProviders.ts                       # types + ordre cascade + parsing JSON
    └── validate.ts                           # garde-fous magnitude (réutilise fundamentals)
```

### 3.1 Détection symbole + exercice
Depuis le **nom de fichier** déposé (`SNTS_2025.pdf` → SNTS, 2025), avec champ
éditable dans `ImportRow` si le nom ne suit pas la convention. Le symbole est
validé contre `brvm_instruments` (liste des codes).

## 4. Cascade LLM (`/api/extract-llm`)

Entrée : `{ mode: 'text'|'vision', text?: string, images?: string[], symbol, year }`.
Sortie : `{ provider, data: FundamentalExtraction }` ou `{ error }`.

Ordre des providers (configurable) :
- **text** : `deepseek` → `mistral` → `grok`.
- **vision** : `mistral` → `grok` (deepseek exclu).

Pour chaque provider : clé absente → sauté ; HTTP/timeout/JSON invalide →
provider suivant. Le `provider` qui réussit est renvoyé et stocké dans
`fundamentals.source` (`deepseek` / `mistral` / `mistral-vision` / `grok` …).

Endpoints (compatibles OpenAI Chat Completions) :
- DeepSeek : `https://api.deepseek.com/chat/completions`, modèle `deepseek-chat`.
- Mistral : `https://api.mistral.ai/v1/chat/completions`, `mistral-large-latest`
  (texte) / `pixtral-large-latest` (vision).
- Grok (xAI) : `https://api.x.ai/v1/chat/completions`, `grok-2-latest` (texte) /
  `grok-2-vision-latest` (vision).

Le **prompt** reprend les règles éprouvées (`brvm_scanner/prompts/extract_template.md`)
imposant la sortie JSON en **millions de FCFA** et la gestion des unités.

## 5. Format de données

`FundamentalExtraction` (sortie LLM, en millions de FCFA sauf eps/shares) :
```ts
interface FundamentalExtraction {
  revenue: number | null;
  net_income: number | null;
  equity: number | null;
  debt_total: number | null;
  cash: number | null;
  eps: number | null;
  dividend_per_share: number | null;
  shares_outstanding: number | null;
}
```

Conversion à l'écriture : valeurs monétaires × 1 000 000 (millions → FCFA) avant
`/api/fundamentals` (même règle que le pipeline scanner existant).

## 6. Sécurité

- Clés en env **serveur** Vercel : `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`,
  `XAI_API_KEY`. Jamais `NEXT_PUBLIC_*`.
- `/api/extract-llm` et `/api/fundamentals` : authentifiées (utilisateur
  connecté requis, via `supabase.auth.getUser()`).
- Écriture base : service_role côté serveur uniquement.

## 7. Gestion d'erreurs / états vides

- Aucune clé configurée → réponse 503 « Configurer au moins DEEPSEEK_API_KEY ».
- Tous providers échouent → erreur affichée sur la ligne, PDF non écrit.
- PDF illisible (ni texte ni rendu image) → ligne en erreur, message clair.
- Symbole inconnu de `brvm_instruments` → demande de correction avant écriture.
- Valeur(s) suspecte(s) → statut review (jamais d'écriture auto de données fausses).

## 8. Tests

- `lib/import/validate.ts` : tests unitaires (réutilise les cas de
  `lib/fundamentals.test.mjs` : FTSC CA=3 → suspect, etc.).
- `lib/import/llmProviders.ts` : test du parsing JSON tolérant (réponse LLM avec
  texte parasite autour du JSON → extraction du bloc).
- Test manuel bout-en-bout : déposer SNTS_2025.pdf → DeepSeek → champs plausibles
  → écriture auto → fiche action à jour.

## 9. Hors périmètre (YAGNI)

- Pas de file d'attente / traitement asynchrone (1 PDF à la fois, navigateur).
- Pas de stockage des PDF (analyse à la volée, seuls les fondamentaux persistent).
- Pas de support d'autres formats (Excel, images isolées) — uniquement PDF.
- Pas de ré-essai automatique illimité (1 passe sur la cascade, puis erreur).

## 10. Pré-requis utilisateur

Ajouter dans Vercel (Settings → Environment Variables, Production) :
- `DEEPSEEK_API_KEY` (obligatoire, prioritaire)
- `MISTRAL_API_KEY` (recommandé, requis pour la voie vision/scannés)
- `XAI_API_KEY` (optionnel, fallback)
