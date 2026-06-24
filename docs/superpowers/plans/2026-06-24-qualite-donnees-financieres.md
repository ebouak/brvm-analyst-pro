# Qualité des données financières — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger/compléter income + balance + cash-flow de 13 sociétés BRVM (2020→2025) à partir des états financiers audités (`publications`), bilan équilibré et découverts inclus.

**Architecture :** Aucun code applicatif. Un helper Node réutilisable (`scraper/scripts/finance-fix/lib.mjs`) centralise garde-fous + upsert service_role + vérification. Un fichier de données par société (`companies/<CODE>.mjs`) contient les chiffres extraits à la main des PDF audités. Le contrôleur dispatche 1 sous-agent/société qui télécharge, lit le PDF, remplit le fichier société, lance la vérif, et trace le résultat.

**Tech Stack :** Node ESM, `@supabase/supabase-js` (service_role via `scraper/.env.local`), `curl`, lecture PDF par l'agent, vitest non requis (vérif par script).

---

## Conventions communes (lire avant toute tâche)

- **Répertoire de travail** : `scraper/` (le `.env.local` y contient `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
- **Unités** : lire l'en-tête de chaque tableau du PDF (« en milliers / en millions / en francs CFA ») et convertir en **FCFA bruts** (×1000, ×1 000 000, ×1). Ne jamais convertir `benefice_par_action`, `dividende_par_action`, `actions_en_circulation`.
- **Découverts** : la rubrique SYSCOHADA « Trésorerie-Passif » (banques, établissements financiers et crédits de trésorerie ; banques crédits d'escompte) est une dette **court terme** → l'inclure dans `passif_courant` ET la reporter dans `dette_court_terme`.
- **`charges_financieres_nettes`** = valeur **positive** de la charge financière nette (|résultat financier|).
- **Idempotence** : upsert sur conflit `(code, periode, type_periode)` avec `type_periode='annuel'`.
- **N et N-1** : chaque PDF audité contient l'exercice et son comparatif → un PDF 2025 fournit 2025 **et** 2024 ; un PDF 2023 fournit 2023 **et** 2022. Couvrir 2020→2025 demande ~3 PDF/société.
- **Normes** : toujours **SYSCOHADA**, jamais IFRS (cohérence base). Si seul IFRS existe une année, ne pas écrire cette année et le signaler.
- **`actions_en_circulation`** : déduire du capital social / nominal (ex. SMB : capital 4 872 MFCFA / nominal 625 = 7 795 000 actions) ou du BPA publié.

---

### Task 0 : Helper réutilisable + scaffolds

**Files:**
- Create: `scraper/scripts/finance-fix/lib.mjs`
- Create: `scraper/scripts/finance-fix/run.mjs`
- Create: `scraper/scripts/finance-fix/REPORT.md`
- Create: `scraper/scripts/finance-fix/companies/.gitkeep`

- [ ] **Step 1 : Écrire `lib.mjs`** (garde-fous + upsert + vérif)

```js
// scraper/scripts/finance-fix/lib.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../.env.local') });

export function svc() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1);

/** Garde-fous par exercice. `bal`, `inc`, `cf` = lignes d'une même année. Retourne string[]. */
export function guardrails({ inc, bal, cf, ebePublie }) {
  const r = [];
  if (bal?.total_actifs != null && bal?.total_passif != null && rel(bal.total_actifs, bal.total_passif) > 0.01)
    r.push('bilan: actif != passif');
  if (bal?.total_passif != null && bal?.total_capitaux_propres != null && bal?.passif_courant != null && bal?.passif_non_courant != null) {
    const somme = bal.total_capitaux_propres + bal.passif_non_courant + bal.passif_courant;
    if (rel(somme, bal.total_passif) > 0.02) r.push('passif: sous-totaux ne réconcilient pas (découverts ?)');
  }
  if (ebePublie != null && inc?.resultat_exploitation != null && cf?.depreciation_amortissement != null) {
    if (rel(inc.resultat_exploitation + cf.depreciation_amortissement, ebePublie) > 0.02) r.push('EBITDA reconstruit != EBE publié');
  }
  if (inc?.benefice_par_action != null && inc?.resultat_net != null && inc?.actions_en_circulation) {
    const att = inc.resultat_net / inc.actions_en_circulation;
    if (Math.abs(att) > 1 && rel(inc.benefice_par_action, att) > 0.05) r.push('BPA incohérent');
  }
  if (inc?.resultat_net != null && inc?.resultat_avant_impots != null && inc?.impots != null) {
    if (rel(inc.resultat_net, inc.resultat_avant_impots + inc.impots) > 0.10
      && rel(inc.resultat_net, inc.resultat_avant_impots - inc.impots) > 0.10) r.push('RN incohérent (RAI±impôts)');
  }
  return r;
}

const OC = { onConflict: 'code,periode,type_periode' };
const stamp = (code, rows) => rows.map((x) => ({ code, type_periode: 'annuel', ...x }));

/** Upsert les 3 tables puis relit et applique les garde-fous. Retourne { written, issues }. */
export async function upsertAndVerify(code, { income = [], balance = [], cash = [], ebe = {} }) {
  const sb = svc();
  const errs = [];
  for (const [tbl, rows] of [['income_statements', income], ['balance_sheets', balance], ['cash_flow_statements', cash]]) {
    if (!rows.length) continue;
    const { error } = await sb.from(tbl).upsert(stamp(code, rows), OC);
    if (error) errs.push(`${tbl}: ${error.message}`);
  }
  // relecture + garde-fous
  const byYear = (arr) => new Map(arr.map((r) => [r.periode, r]));
  const [{ data: inc }, { data: bal }, { data: cf }] = await Promise.all([
    sb.from('income_statements').select('*').eq('code', code),
    sb.from('balance_sheets').select('*').eq('code', code),
    sb.from('cash_flow_statements').select('*').eq('code', code),
  ]);
  const I = byYear(inc || []), B = byYear(bal || []), C = byYear(cf || []);
  const issues = [];
  for (const periode of new Set([...I.keys(), ...B.keys()])) {
    const g = guardrails({ inc: I.get(periode), bal: B.get(periode), cf: C.get(periode), ebePublie: ebe[periode] });
    if (g.length) issues.push(`${periode}: ${g.join(' | ')}`);
  }
  return { written: { income: income.length, balance: balance.length, cash: cash.length }, dbErrors: errs, issues };
}
```

- [ ] **Step 2 : Écrire `run.mjs`** (lance une société)

```js
// scraper/scripts/finance-fix/run.mjs   ->   node run.mjs <CODE>
import { upsertAndVerify } from './lib.mjs';
const code = process.argv[2];
if (!code) { console.error('usage: node run.mjs <CODE>'); process.exit(1); }
const mod = await import(`./companies/${code}.mjs`);
const res = await upsertAndVerify(code, mod.default);
console.log(JSON.stringify(res, null, 2));
if (res.dbErrors.length || res.issues.length) { console.error('⚠️ ÉCHEC garde-fous'); process.exit(2); }
console.log('✅', code, 'OK');
```

- [ ] **Step 3 : Scaffold rapport**

Créer `scraper/scripts/finance-fix/REPORT.md` avec :

```markdown
# Rapport qualité — états financiers (audités)

| Société | Années écrites | Garde-fous | Écarts fiche MADIS (>5%) | Notes |
|---|---|---|---|---|
```

Et `companies/.gitkeep` vide.

- [ ] **Step 4 : Valider le helper sur BNBC (déjà correct)**

Créer un fichier temporaire `companies/BNBC.mjs` qui ré-exporte les données déjà en base n'est pas nécessaire ; à la place, vérifier que la relecture BNBC passe les garde-fous via un mini-script :

Run :
```bash
cd scraper && node -e "import('./scripts/finance-fix/lib.mjs').then(async m=>{const sb=m.svc();const g=[];for(const p of ['2020','2021','2022','2023','2024','2025']){const [i,b,c]=await Promise.all([sb.from('income_statements').select('*').eq('code','BNBC').eq('periode',p).maybeSingle(),sb.from('balance_sheets').select('*').eq('code','BNBC').eq('periode',p).maybeSingle(),sb.from('cash_flow_statements').select('*').eq('code','BNBC').eq('periode',p).maybeSingle()]);const r=m.guardrails({inc:i.data,bal:b.data,cf:c.data});if(r.length)g.push(p+': '+r.join(','));}console.log(g.length?g:'BNBC OK');})"
```
Expected : `BNBC OK` (le bilan 2022 BNBC peut signaler la réconciliation car non recorrigé — si c'est le cas, le noter, c'est attendu hors périmètre).

- [ ] **Step 5 : Commit**

```bash
git add scraper/scripts/finance-fix/
git commit -m "chore(finance-fix): helper garde-fous + upsert + rapport (Task 0)"
```

---

### Tasks 1–13 : une société par tâche

**Procédure identique** (le contrôleur fournit au sous-agent : le `<CODE>`, et la ligne fiche MADIS pour cross-check). Remplacer `<CODE>` par le code de la société.

**Files (par société) :**
- Create: `scraper/scripts/finance-fix/companies/<CODE>.mjs`
- Modify: `scraper/scripts/finance-fix/REPORT.md`

- [ ] **Step 1 : Récupérer les URLs des PDF audités annuels**

Run (depuis `frontend/`, lecture seule) :
```bash
cd frontend && node -e "require('dotenv').config({path:'.env.local'});const{createClient}=require('@supabase/supabase-js');const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);sb.from('publications').select('libelle,date_publication,source_url').eq('code','<CODE>').eq('type_publication','etats_financiers').order('date_publication',{ascending:false}).then(({data})=>{for(const r of data||[]){if(/exercice\s*20[0-2]\d/i.test(r.libelle)&&!/(semestre|trimestre|liquidit|IFRS)/i.test(r.libelle))console.log(r.libelle,'\n  ',r.source_url);}});"
```
Garder les **exercices annuels SYSCOHADA** les plus récents couvrant 2020→2025 (≈ PDF 2025, 2023, 2021). Ignorer IFRS / semestriels / trimestriels.

- [ ] **Step 2 : Télécharger les PDF**

Run (dans le scratchpad, un par URL) :
```bash
curl -sL -o /tmp/<CODE>-2025.pdf "<URL_2025>" -w "HTTP %{http_code} %{size_download}o\n"
```
Expected : `HTTP 200` et taille > 50 000 o. Répéter pour 2023, 2021 (et 2020 si besoin).

- [ ] **Step 3 : Lire chaque PDF et extraire**

Lire chaque PDF (outil Read). Pour **chaque exercice** présent (N et N-1) extraire, **en FCFA après conversion d'unité** :
- *income* : `revenu_total` (Chiffre d'affaires), `cout_ventes` (Achats de marchandises), `resultat_exploitation`, `charges_financieres_nettes` (|résultat financier|), `resultat_avant_impots` (= RAO + résultat HAO), `impots` (Impôts sur le résultat, signé : négatif si crédit), `resultat_net`, `benefice_par_action` (publié ou RN/actions), `actions_en_circulation`, `dividende_par_action`.
- *balance* : `total_actifs`, `total_actif_non_courant` (TOTAL ACTIF IMMOBILISE), `actifs_incorporels`, `immobilisations_nettes` (corporelles), `investissements_long_terme` (financières), `total_actif_circulant`, `stocks`, `creances_clients`, `tresorerie_equivalents` (TOTAL TRESORERIE ACTIF), `total_passif`, `total_capitaux_propres`, `capital_social`, `reserves_benefices_non_repartis` (Primes et réserves), `passif_non_courant` (TOTAL DETTES FIN. ET RESSOURCES ASSIMILEES), `dette_long_terme` (Emprunts et dettes fin. diverses), `passif_courant` (= TOTAL PASSIF CIRCULANT **+ TOTAL TRESORERIE PASSIF**), `dette_court_terme` (= TOTAL TRESORERIE PASSIF), `fournisseurs`, `autres_passifs_courants` (passif circulant − fournisseurs).
- *cash* : `flux_exploitation`, `resultat_net`, `depreciation_amortissement` (= Dotations amort/prov − Reprises amort/prov), `variation_bfr` (= flux_exploitation − CAFG), `flux_investissement`, `investissements_ppe`, `flux_financement`, `remboursement_dette`, `dividendes_verses`, `variation_tresorerie`, `tresorerie_debut_periode`, `tresorerie_fin_periode`.
- noter aussi l'**EBE** (Excédent Brut d'Exploitation) publié par année pour le contrôle EBITDA.

- [ ] **Step 4 : Écrire `companies/<CODE>.mjs`**

Format (exemple de structure, valeurs = extraites) :
```js
// scraper/scripts/finance-fix/companies/<CODE>.mjs
export default {
  ebe: { '2024': /* EBE FCFA */ 0, '2025': 0 },
  income: [
    { periode: '2024', revenu_total: 0, cout_ventes: 0, resultat_exploitation: 0, charges_financieres_nettes: 0, resultat_avant_impots: 0, impots: 0, resultat_net: 0, benefice_par_action: 0, actions_en_circulation: 0, dividende_par_action: 0 },
    // ... 2025, etc.
  ],
  balance: [
    { periode: '2024', total_actifs: 0, total_actif_non_courant: 0, actifs_incorporels: 0, immobilisations_nettes: 0, investissements_long_terme: 0, total_actif_circulant: 0, stocks: 0, creances_clients: 0, tresorerie_equivalents: 0, total_passif: 0, total_capitaux_propres: 0, capital_social: 0, reserves_benefices_non_repartis: 0, passif_non_courant: 0, dette_long_terme: 0, passif_courant: 0, dette_court_terme: 0, fournisseurs: 0, autres_passifs_courants: 0 },
  ],
  cash: [
    { periode: '2024', flux_exploitation: 0, resultat_net: 0, depreciation_amortissement: 0, variation_bfr: 0, flux_investissement: 0, investissements_ppe: 0, flux_financement: 0, remboursement_dette: 0, dividendes_verses: 0, variation_tresorerie: 0, tresorerie_debut_periode: 0, tresorerie_fin_periode: 0 },
  ],
};
```

- [ ] **Step 5 : Lancer + garde-fous**

Run :
```bash
cd scraper && node scripts/finance-fix/run.mjs <CODE>
```
Expected : `✅ <CODE> OK` et `issues: []`. Si un bilan signale « actif != passif » ou « sous-totaux ne réconcilient pas », relire le PDF (erreur d'unité ou découverts oubliés) et corriger `<CODE>.mjs` jusqu'au vert.

- [ ] **Step 6 : Contrôle croisé fiche MADIS**

Comparer CA, REX, RN, total bilan, total dettes financières de chaque année 2020-2024 aux valeurs de la fiche MADIS (fournies par le contrôleur dans le prompt). **Ne jamais corriger la base depuis la fiche.** Pour chaque écart > 5 %, l'inscrire dans REPORT.md (colonne « Écarts fiche MADIS »). Les erreurs connues des fiches (SMBC 2022 charges, SCRC 2024 charges, UNXC 2024 bilan=0, NTLC charges 2024, SLBC EBITDA 2023) sont attendues et confirment que la base (audité) est plus fiable.

- [ ] **Step 7 : Mettre à jour REPORT.md + commit**

Ajouter une ligne au tableau de REPORT.md, puis :
```bash
git add scraper/scripts/finance-fix/companies/<CODE>.mjs scraper/scripts/finance-fix/REPORT.md
git commit -m "data(finance-fix): <CODE> 2020-2025 depuis états audités"
```

**Affectation des tâches (code → fiche MADIS pour cross-check fournie par le contrôleur) :**

- Task 1 : **SPHC** (SAPH) — fiche CA 2020-2024 : 158 789 / 208 794 / 224 421 / 206 469 / 279 438 (MFCFA) ; RN : 7 467 / 20 750 / 16 701 / 3 635 / 18 790.
- Task 2 : **SLBC** (Solibra) — CA : 229 359 / 299 269 / 281 880 / 311 395 / 309 722 ; RN : 17 520 / 22 020 / 1 217 / 15 078 / 21 472. (fiche EBITDA 2023 = −8 430 est erronée).
- Task 3 : **SCRC** (Sucrivoire, **SYSCOHADA**) — CA : 63 333 / 62 497 / 68 635 / 68 135 / 87 219 ; RN : 1 788 / −6 573 / −8 756 / −10 324 / 2 591. (fiche 2024 charges −1 492 erronée).
- Task 4 : **NTLC** (Nestlé) — CA : 173 225 / 195 188 / 206 734 / 203 618 / 220 113 ; RN : 20 900 / 21 268 / 16 627 / 16 557 / 18 150. Audité dispo 2022→2025.
- Task 5 : **ONTBF** (Onatel) — CA : 157 358 / 154 881 / 145 625 / 139 154 / 141 841 ; RN : 31 052 / 32 374 / 22 372 / 21 129 / 21 471.
- Task 6 : **CFAC** (CFAO Motors) — CA : 99 126 / 119 732 / 146 375 / 180 162 / 158 313 ; RN : 3 780 / 6 711 / 5 534 / 6 399 / 4 693.
- Task 7 : **SMBC** (SMB) — CA : 102 670 / 139 353 / 276 854 / 247 646 / 229 061 ; RN : 9 396 / 8 623 / 9 421 / 17 255 / 8 698. Capital 4 872 MFCFA / nominal 625 → 7 795 000 actions.
- Task 8 : **TTLC** (TotalEnergies) — CA : 416 080 / 494 433 / 573 130 / 578 922 / 621 042 ; RN : 7 648 / 11 143 / 12 279 / 8 709 / 9 374. ⚠️ Vérifier l'URL annuelle 2024/2023 (étiquetage publications imparfait) via Step 1.
- Task 9 : **PRSC** (Tractafric) — CA : 51 108 / 65 019 / 70 092 / 77 879 / 74 676 ; RN : 1 863 / 3 067 / 3 644 / 2 084 / 2 347. (même émetteur que CFAC dans publications : filtrer par libellé TRACTAFRIC).
- Task 10 : **UNLC** (Unilever) — CA : 39 693 / 46 059 / 36 175 / 34 682 / ND ; RN : −3 691 / 6 091 / −6 908 / 640 / ND. **Audité s'arrête à 2023** → écrire 2020-2023 ; 2024/2025 non publiés (ne pas écrire, noter).
- Task 11 : **UNXC** (Uniwax) — CA : 34 917 / 38 191 / 36 373 / 29 687 / 27 333 ; RN : 231 / 1 401 / −1 299 / −2 035 / −2 217. (fiche 2024 bilan=0 erroné).
- Task 12 : **SHEC** (Vivo Energy) — CA : 312 991 / 366 644 / 488 902 / 550 696 / 600 708 ; RN : −4 788 / 2 360 / 3 549 / 4 012 / 5 354. (fiche charges 2022-2024 incohérentes).
- Task 13 : **SCRC déjà couvert en Task 3** — *(placeholder supprimé ; il n'y a que 12 sociétés à traiter, BNBC étant déjà fait. Numérotation : Tasks 1–12.)*

> Note de cadrage : ce sont **12** sociétés (BNBC est déjà corrigée hors plan). Les « Tasks 1–13 » se lisent comme 12 tâches société effectives (Task 13 annulée ci-dessus).

---

### Task 14 : Finalisation (cache, audit global, rapport)

**Files:**
- Modify: base Supabase (`diagnostic_reports`)
- Create: `presentations/audit-financier/rapport-qualite.md`

- [ ] **Step 1 : Purger le cache diagnostic des sociétés traitées**

Run :
```bash
cd scraper && node -e "import('./scripts/finance-fix/lib.mjs').then(async m=>{const sb=m.svc();const codes=['SPHC','SLBC','SCRC','NTLC','ONTBF','CFAC','SMBC','TTLC','PRSC','UNLC','UNXC','SHEC','BNBC'];const{error}=await sb.from('diagnostic_reports').delete().in('code',codes);console.log(error?error.message:'cache purgé');})"
```
Expected : `cache purgé`.

- [ ] **Step 2 : Audit de réconciliation global**

Run (depuis `frontend/`) le script d'audit (même logique que l'audit initial) et confirmer 0 bilan > 2 % hors années non publiées :
```bash
cd frontend && node -e "require('dotenv').config({path:'.env.local'});const{createClient}=require('@supabase/supabase-js');const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);sb.from('balance_sheets').select('code,periode,total_passif,total_capitaux_propres,passif_non_courant,passif_courant').then(({data})=>{const bad=[];for(const b of data||[]){if([b.total_passif,b.total_capitaux_propres,b.passif_courant,b.passif_non_courant].some(x=>x==null))continue;const s=b.total_capitaux_propres+b.passif_non_courant+b.passif_courant;if(Math.abs(s-b.total_passif)/Math.max(Math.abs(b.total_passif),1)>0.02)bad.push(b.code+' '+b.periode);}console.log('non réconciliés:',bad.length,bad.join(', '));});"
```
Expected : liste vide ou uniquement des codes hors des 13 (à signaler comme lot suivant).

- [ ] **Step 3 : Rapport qualité final**

Copier/synthétiser `scraper/scripts/finance-fix/REPORT.md` vers `presentations/audit-financier/rapport-qualite.md` (par société/année : années écrites, garde-fous, écarts fiche↔audité, années non publiées).

- [ ] **Step 4 : Commit**

```bash
git add presentations/audit-financier/rapport-qualite.md scraper/scripts/finance-fix/REPORT.md
git commit -m "data(finance-fix): finalisation — cache purgé, audit réconciliation, rapport qualité"
```

---

## Self-Review (effectuée)

1. **Couverture du spec** : source audités (Tasks 1-12 Step 1-5) ; garde-fous (lib.mjs + Step 5) ; découverts/réconciliation (conventions + guardrails) ; unités (conventions + Step 3) ; cross-check fiche sans écriture (Step 6) ; UNLC limité 2023 (Task 10) ; SCRC SYSCOHADA (Task 3) ; purge cache + audit + rapport (Task 14). ✓
2. **Placeholders** : valeurs chiffrées des `<CODE>.mjs` volontairement extraites par le sous-agent depuis le PDF (donnée = livrable, non connue à l'avance) ; tout le reste (code lib/run, commandes, garde-fous) est complet. La « Task 13 » est explicitement annulée (12 sociétés). ✓
3. **Cohérence des noms** : `upsertAndVerify`, `guardrails`, `svc`, structure `{ income, balance, cash, ebe }` identiques entre lib.mjs, run.mjs et `<CODE>.mjs`. ✓
