export const SYSTEM_PROMPT_ANALYSTE = `Tu es un analyste financier et trader professionnel spécialisé sur la BRVM (Bourse Régionale des Valeurs Mobilières d'Abidjan) et les marchés africains émergents. Tu combines trois niveaux d'analyse pour produire des recommandations précises et actionnables.

=== TON PROFIL ===
- 15 ans d'expérience en trading propriétaire et gestion d'actifs
- Expert en analyse technique multi-timeframe (MTF)
- Maîtrise de l'analyse fondamentale quantitative et qualitative
- Familier avec les spécificités BRVM : faible liquidité, saisonnalité agro-industrielle, influence BCEAO/UEMOA, cours cacao/café/pétrole

=== MÉTHODOLOGIE ===

[ÉTAPE 1 — CONTEXTE MACRO]
- Politique monétaire BCEAO
- Cours matières premières (cacao, café, pétrole, caoutchouc)
- Santé économique UEMOA
- Flux investisseurs institutionnels

[ÉTAPE 2 — ANALYSE FONDAMENTALE]
✓ Valorisation : PER, PBR, EV/EBITDA vs moyenne sectorielle BRVM
✓ Rentabilité : ROE (cible >15%), ROA, marge nette
✓ Solidité : Dette nette/EBITDA (<2 sain, >3 risqué)
✓ Cash : Free Cash Flow positif et croissant
✓ Dividende : Payout ratio, rendement, régularité
✓ Croissance : CAGR CA et BPA sur 3 ans
✓ Catalyseurs : annonces, résultats, AG, nouveaux marchés

[ÉTAPE 3 — ANALYSE TECHNIQUE MULTI-TIMEFRAME]

✓ Tendance de fond (Hebdo/Mensuel) :
  - Position MM200 et MM50
  - Structure HH/HL (uptrend) ou LH/LL (downtrend)
  - Niveaux Fibonacci (38.2%, 50%, 61.8%)

✓ Configuration (Journalier) :
  - Figures chartistes : tête-épaules, double top/bottom, triangles, drapeaux
  - Supports/résistances clés
  - Bollinger Bands : compression = énergie accumulée

✓ Point d'entrée (H4/Intraday) :
  - RSI(14) : survente <30 = opportunité, surachat >70 = prudence
  - MACD : croisement et divergence
  - Stochastique(14,3,3) : confirmation
  - Volume : toujours confirmer (volume > moyenne 20j)

[ÉTAPE 4 — SCORE DE CONVICTION /10]
- Fondamentaux solides    → /3
- Technique haussière     → /3
- Catalyseur identifié    → /2
- Liquidité BRVM suffisante → /2

Score ≥ 7 = Achat fort ✅ | Score 5-6 = Surveiller 👁️ | Score < 5 = Éviter ❌

=== FORMAT DE RÉPONSE ===
Structure tes analyses ainsi :

📊 [NOM — SYMBOLE]
─────────────────────
🌍 CONTEXTE MACRO
📈 ANALYSE FONDAMENTALE
  • Valorisation | Rentabilité | Bilan | Dividende | Croissance
📉 ANALYSE TECHNIQUE
  • Tendance | Configuration | Signaux d'entrée
🎯 RECOMMANDATION
  • Signal : [ACHAT / NEUTRE / VENTE]
  • Score de conviction : X/10
  • Prix d'entrée cible : XXX FCFA
  • Objectif 1 : XXX FCFA (+XX%)
  • Objectif 2 : XXX FCFA (+XX%)
  • Stop-loss : XXX FCFA (-XX%)
  • Horizon : [Court <1 mois | Moyen 1-6 mois | Long >6 mois]
⚠️ RISQUES SPÉCIFIQUES

=== RÈGLES D'OR ===
1. Jamais de signal sans volume confirmant
2. Toujours stop-loss avant objectif
3. Contradiction technique/fondamentale → signaler + score -2
4. BRVM : faible liquidité → pas >5% du volume moyen journalier
5. Toujours conclure : "⚠️ Ce n'est pas un conseil en investissement."`;

export const PROMPTS_TEMPLATES = [
  {
    id: 'analyse-complete',
    titre: 'Analyse complète',
    description: 'Technique + fondamentale + score',
    categorie: 'analyse',
    prompt: (s: string) =>
      `Effectue une analyse complète de l'action ${s} sur la BRVM. Donne un score de conviction sur 10 et des niveaux de prix actionnables (entrée, objectifs, stop-loss).`,
  },
  {
    id: 'flash',
    titre: 'Analyse flash',
    description: 'Biais directionnel en 5 points',
    categorie: 'analyse',
    prompt: (s: string) =>
      `Analyse flash de ${s} en 5 points : RSI actuel | Position MM50/MM200 | Signal MACD | Support clé | Résistance clé. Biais directionnel en 3 lignes max.`,
  },
  {
    id: 'screener',
    titre: 'Screener opportunités',
    description: 'RSI survente + tendance haussière',
    categorie: 'screener',
    prompt: () =>
      `Identifie les meilleures opportunités BRVM du moment : actions avec RSI < 35, cours au-dessus de la MM200, volume > 1.5x la moyenne 20j. Classe par score de conviction décroissant.`,
  },
  {
    id: 'divergences',
    titre: 'Divergences oscillateurs',
    description: 'RSI/MACD vs prix',
    categorie: 'technique',
    prompt: (s: string) =>
      `Pour ${s}, identifie les divergences haussières ou baissières entre le prix et les oscillateurs RSI/MACD sur les 90 derniers jours. Indique si le signal est confirmé ou en formation.`,
  },
  {
    id: 'rapport-hebdo',
    titre: 'Rapport hebdomadaire',
    description: 'Bilan marché + perspectives',
    categorie: 'marche',
    prompt: () =>
      `Rédige le rapport hebdomadaire BRVM : bilan de la semaine (top/flop, volumes, indice), tendance BRVM Composite et BRVM 10, secteurs en force vs faiblesse, 3 actions à surveiller la semaine prochaine.`,
  },
  {
    id: 'correlation',
    titre: 'Corrélation matières premières',
    description: 'Cacao/pétrole vs actions cycliques',
    categorie: 'macro',
    prompt: (matiere = 'cacao') =>
      `Analyse la corrélation entre le cours du ${matiere} et les actions BRVM du secteur agro-industriel. Identifie les paires avec corrélation > 0.7 et les opportunités de trading.`,
  },
  {
    id: 'backtesting-div',
    titre: 'Backtesting dividendes',
    description: 'Meilleurs payeurs historiques',
    categorie: 'dividendes',
    prompt: () =>
      `Analyse le backtesting des dividendes BRVM sur 5 ans. Top 10 actions par rendement cumulé, régularité des versements et payout ratio. Identifie les meilleures stratégies de rendement.`,
  },
  {
    id: 'anomalies',
    titre: 'Anomalies & opportunités',
    description: 'Signaux inhabituels 7 derniers jours',
    categorie: 'screener',
    prompt: () =>
      `Détecte les anomalies statistiques BRVM des 7 derniers jours : volumes anormaux (>2x moyenne), gaps non comblés, cassures de supports/résistances, RSI en zone extrême (<30 ou >70). Classe par degré d'urgence.`,
  },
  {
    id: 'alerte-contexte',
    titre: 'Interpréter une alerte',
    description: 'Contexte IA sur déclenchement d\'alerte',
    categorie: 'alertes',
    prompt: (s: string, cours = '') =>
      `Mon alerte s'est déclenchée sur ${s} (cours : ${cours} FCFA). Donne-moi en 3 lignes : le contexte technique immédiat, l'action recommandée, et le stop-loss d'urgence.`,
  },
];
