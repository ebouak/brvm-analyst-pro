# 5 Game-Changers — Design Spec

> **For agentic workers:** After design approval, invoke superpowers:writing-plans to create implementation plan.

**Goal:** Ajouter 5 features différenciantes : heatmap marché interactive, screener multi-critères, calendrier dividendes, paper trading automatique, rapport mensuel PDF — conversion naturelle vers premium.

**Architecture:** Hybrid modulaire. Features UI indépendantes (Heatmap, Screener, Calendrier). Paper trading + Rapport partagent socle backend "Portfolio Tracking" pour éviter duplication logique.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, TailwindCSS (dark-finance), Supabase PostgreSQL, Recharts, PDFKit/ExcelJS, IA (DeepSeek/Mistral), Cron (GitHub Actions / node-cron).

---

## Feature 1 — Heatmap Marché Interactive

### Objectif
Vue instantanée du marché BRVM : 48 actions en grille colorée par variation journalière, taille case = capitalisation. Viral pour réseaux sociaux. Engagement quotidien.

### UI/UX
- **Route:** `/marche/heatmap`
- **Grille:** 48 cases (8×6 ou responsive)
- **Couleur:** Gradient variation journalière
  - Rouge -10% (down)
  - Gris 0% (neutre)
  - Vert +10% (up)
- **Taille case:** Proportionnelle à capitalisation (PALC grand, petite cap petit)
- **Hover/Tap:** Affiche code + variation % + capitalisation
- **Refresh:** Toutes les 15 min (intraday, données brvm.org public)
- **Mobile:** Responsive, cases adaptées à l'écran

### Data Source
- Table `brvm_actions_daily` (existe) : code, cours_jour, variation_pct, capitalisation

### Design Tokens
- Utiliser palette dark-finance existante
- Focus ring sur hover

### Empty State
- Si pas de données intraday : "Marché fermé" avec dernier refresh

---

## Feature 2 — Screener Multi-critères

### Objectif
Filtrer les 48 actions sur multiples critères (RSI, volume, score, secteur, dividende). Résultat : liste prête à investir. Actuellement impossible publiquement sur BRVM.

### UI/UX
- **Route:** `/screener`
- **Filtres panneau gauche :**
  - RSI min/max (slider 0-100)
  - Volume > moyenne (toggle + % input)
  - Score signal > X (slider 0-100)
  - Secteur (multi-select dropdown)
  - Rendement dividende > X% (input)
  - **Presets rapides** (buttons) :
    - Gratuit: "Survendu (RSI<30)", "High dividend (div>3%)", "Fort volume"
    - Premium: "Growth UEMOA", "Value hunting", "Momentum"
- **Résultat :** Tableau filtré (code, prix, variation, RSI, score, div %)
- **Actions:** Clic → fiche action | "Ajouter watchlist" | Export CSV

### Data Sources
- `brvm_actions_daily` : RSI, score, variation
- `brvm_instruments` : secteur
- `brvm_dividends` : rendement

### Premium
- Presets premium verrouillés (icône 🔒)
- Utilisateurs gratuits : 3 presets, 10 résultats max
- Premium : illimité

### Export
- CSV avec timestamp, filtres appliqués

---

## Feature 3 — Calendrier Dividendes Interactif

### Objectif
Calendrier annuel avec dates de détachement, taux, rendement estimé, countdown. Investisseurs UEMOA adorent les revenus. Aucun site n'agrège ça proprement.

### UI/UX
- **Route:** `/dividendes/calendrier`
- **Vue:** Calendrier annuel (12 mois, grille 7j×5sem)
- **Cases avec dividendes:** Colorées (ex: cyan), affichent mini badge "3.5%" (taux)
- **Hover:** Popover affiche :
  - Code action
  - Taux dividende
  - Rendement estimé (taux / cours)
  - Date de paiement
  - Countdown ("J-15 avant détachement")
- **Filtres:** Secteur, rendement min
- **Mobile:** Vue "Prochains dividendes" (liste) au lieu de calendrier

### Data Source
- Table `brvm_dividends` (existe) : code, date_detachement, taux, date_paiement

### Empty State
- Si pas de dividendes : "Aucun dividende déclaré pour cette période"

---

## Feature 4 — Paper Trading Automatique (Premium)

### Objectif
Chaque signal déclenche automatiquement une entrée fictive avec taille = 10% du capital simulé. Utilisateur voit si ses signaux gagnent sans risquer un franc. Conversion naturelle vers premium.

### Architecture Backend

#### Table: `paper_trading_accounts`
```sql
id uuid PK
user_id uuid FK profiles
capital_initial numeric (FCFA)
capital_current numeric
pnl_total numeric
pnl_pct numeric
created_at timestamptz
updated_at timestamptz
```

#### Table: `paper_trading_positions`
```sql
id uuid PK
user_id uuid FK
account_id uuid FK paper_trading_accounts
code text FK brvm_instruments
entry_price numeric
entry_date date
entry_signal_id uuid FK signals_daily
exit_price numeric (nullable)
exit_date date (nullable)
exit_signal_id uuid FK signals_daily (nullable)
status text ('open', 'closed')
pnl numeric
pnl_pct numeric
days_held integer
created_at timestamptz
updated_at timestamptz
```

#### Logic
1. **Signal BUY:** Créer position
   - entry_price = cours_jour du jour du signal
   - size = 10% de capital_current
   - status = 'open'
2. **Signal SELL:** Fermer position
   - exit_price = cours_jour du jour du SELL
   - exit_date = jour du SELL
   - Calculer P&L = (exit_price - entry_price) * size
   - Mettre à jour capital_current
3. **Auto-close:** Cron quotidien
   - Positions ouvertes > 30j → fermer au cours de clôture d'aujourd'hui
4. **Agrégats:** Recalculer pnl_total, pnl_pct du compte chaque jour

### UI/UX
- **Route:** `/premium/paper-trading`
- **Initialisateur:** Premier accès → modale "Capital fictif (5M / 10M / 50M / custom FCFA)"
- **Dashboard:**
  - Solde portefeuille (capital_initial - pertes + gains)
  - P&L total + % retour (KPI en grand)
  - Equity curve (graphique Recharts, temps réel)
  - Journal de trades (tableau: date entrée, code, prix entrée, prix sortie, P&L, jours)
  - Stats: Win rate, avg win, avg loss, best trade, worst trade
- **Filtres:** Code, secteur, statut (open/closed), période
- **Actions:** Clic trade → détail | Reset compte

### Premium
- Gratuit: "Paper trading disabled" avec CTA upgrade
- Premium: Accès complet

---

## Feature 5 — Rapport Mensuel PDF Auto (Premium)

### Objectif
Chaque 1er du mois, PDF personnalisé généré et envoyé par email : performance portefeuille + top signaux + événements + analyse fondamentale. Crée un rituel utilisateur.

### Architecture Backend

#### Table: `monthly_reports`
```sql
id uuid PK
user_id uuid FK
month text ('2026-06', format YYYY-MM)
report_url text (S3 / Vercel blob)
report_json jsonb (cache du contenu)
sent_at timestamptz
created_at timestamptz
```

#### Cron Job: "Generate Monthly Reports" (1er mois à 08h00 UTC)

**Steps:**
1. Pour chaque utilisateur premium:
   a. Récupérer données du mois écoulé:
      - Performance paper_trading (si existe): P&L, trades, equity curve
      - Performance portefeuille réel (si existe): positions, P&L
      - Top 3 signaux gagnants (score + P&L%)
      - Événements BRVM/COSUMAF du mois (news, dividendes, earnings)
   b. Appeler IA (DeepSeek → Mistral fallback):
      - Narration signaux: "Pourquoi ces 3 signaux ont gagné (analyse fondamentale)"
      - Narration événements: "Impact sur portefeuille"
      - Recos: "Secteurs à surveiller le mois prochain"
   c. Générer PDF (4 pages) avec PDFKit
   d. Upload PDF (Vercel Blob ou S3)
   e. Envoyer email via Resend avec lien PDF

### PDF Content Structure

**Page 1 — Résumé du mois**
- KPIs: P&L portefeuille (réel + paper trading), meilleur signal, secteur gagnant
- Graphique: Equity curve (1 mois)
- Tone: Français pro, données honnêtes (pas inventer)

**Page 2 — Signaux gagnants**
- Top 3 signaux du mois (par P&L%)
- Pour chaque: Code, date signal, cours entrée, cours sortie, P&L%, jours
- Narration IA: "Ces 3 signaux ont gagné parce que [fondamentaux + technique]"

**Page 3 — Analyse fondamentale**
- Pour chaque signal gagnant: Graham Number, DCF, PER, P/B du jour du signal vs aujourd'hui
- Narration IA: "Signaux alignés avec undervaluation [pourquoi]"
- Recos: "Secteurs/ratios à surveiller"

**Page 4 — Événements et contexte**
- Dividendes déclarés
- Earnings publiés
- Annonces BRVM/COSUMAF (regulatory, nouvelles cotations)
- Narration IA: "Impact sur marché et signaux"

### Premium
- Gratuit: Pas d'accès, CTA upgrade
- Premium: Auto-envoi 1er du mois + archive `/premium/reports/monthly`

### Email Template
- Sujet: "BRVM Analyst Pro — Rapport de synthèse [YYYY-MM]"
- Lien: "Télécharger le rapport PDF"
- Lien: "Voir vos performances en ligne"

---

## Data Dependencies

| Feature | Tables required | Nouvelles tables |
|---------|-----------------|------------------|
| Heatmap | brvm_actions_daily | — |
| Screener | brvm_actions_daily, brvm_instruments, brvm_dividends | — |
| Calendrier | brvm_dividends | — |
| Paper trading | signals_daily, brvm_actions_daily | paper_trading_accounts, paper_trading_positions |
| Rapport PDF | paper_trading_positions, brvm_instruments, brvm_dividends, brvm_news, signals_daily | monthly_reports |

---

## Premium Tier Alignment

| Feature | Gratuit | Premium |
|---------|---------|---------|
| Heatmap | ✅ | ✅ |
| Screener | ✅ (3 presets) | ✅ (illimité) |
| Calendrier | ✅ | ✅ |
| Paper trading | ❌ (CTA) | ✅ |
| Rapport PDF | ❌ (CTA) | ✅ (auto) |

---

## Testing Strategy

- **Unit:** Logique P&L, calcul signaux, génération IA
- **Integration:** Paper trading workflow (signal → position → close)
- **E2E:** Cron rapport PDF (mock 1er du mois)
- **Fixtures:** Données brvm_actions_daily, signals_daily, dividendes

---

## Success Criteria

1. **Heatmap:** Charge <1s, update 15 min, viral (shareable)
2. **Screener:** Filtrage <500ms, presets sauvegardés, export CSV
3. **Calendrier:** Toutes les dates exactes, countdown crédible
4. **Paper trading:** P&L exact, auto-close 30j, conversion premium >15%
5. **Rapport PDF:** Généré <5min, IA narration cohérente, délivré le 1er du mois sans fail

