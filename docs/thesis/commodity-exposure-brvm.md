# Impact des cours mondiaux sur les actions BRVM exposées aux matières premières

> **Dernière mise à jour :** 2026-06-29
> **Usage :** Référence hebdomadaire — mise à jour via rapport `commodity_weekly_generator.py`

---

## Matrice de sensibilité

| Action | Cacao | Caoutchouc | Huile palme | Sucre | Pétrole |
|---|:---:|:---:|:---:|:---:|:---:|
| SICC | ●●●● | — | — | — | — |
| SIFCA | ●● | ● | ● | — | — |
| SAPH | — | ●●●● | — | — | ● |
| SOGB | — | ●●●● | — | — | ● |
| PALC | — | — | ●●●● | — | — |
| SCRC | — | — | — | ●●● | — |
| TTLS | — | — | — | — | ●●●● |
| SVOC | — | — | — | — | ●●●● |

*● faible · ●● modéré · ●●● fort · ●●●● très fort*

---

## 1. Cacao — CC=F (ICE Futures, New York)

**Valeurs BRVM :** SICC, SIFCA

La Côte d'Ivoire produit environ **40 % du cacao mondial**. C'est la corrélation la plus directe et la plus forte de toute la cote BRVM.

**SICC** (Société Ivoirienne de Cacao) est le pur joueur cacao — ses revenus dépendent quasi exclusivement du cours ICE. **SIFCA** est plus diversifié, mais le cacao reste une composante majeure de son chiffre d'affaires agro-industriel.

**Mécanisme de transmission :** quand le CC=F monte, les contrats d'exportation sont valorisés à la hausse. L'effet sur les comptes est cependant **décalé d'un à deux trimestres** car les prix sont souvent fixés en avance via des forward contracts avec les chocolatiers européens (Barry Callebaut, Cargill, Olam). Le **Conseil Café-Cacao** ivoirien fixe un prix garanti bord-champ — si ce prix monte, les marges des transformateurs peuvent se comprimer même avec un ICE haussier.

**Événements déclencheurs à surveiller :**

- Sécheresse ou excès de pluie en Côte d'Ivoire et au Ghana (choc d'offre immédiat)
- Publications de stocks ICCO (Organisation Internationale du Cacao)
- Résultats trimestriels Barry Callebaut ou Mondelez (signal demande)
- Décisions du Conseil Café-Cacao sur le prix bord-champ
- Force du dollar face à l'euro (revenus en USD convertis en FCFA amplifient ou atténuent l'effet)

**Thesis SICC :**

| Attribut | Valeur |
|---|---|
| Position | À surveiller (pur joueur, réactivité maximale) |
| Pilier 1 | CC=F > 3 000 USD/t → marges positives sur transformation |
| Pilier 2 | Côte d'Ivoire producteur structurel n°1 — avantage compétitif de sourcing |
| Risque 1 | Mauvaise récolte locale (sécheresse, CSSV) annule l'effet d'un cours favorable |
| Risque 2 | Compression marges si prix bord-champ Conseil > prix marché forward |
| Stop-loss | CC=F < 2 500 USD/t pendant > 6 semaines |
| Conviction | 🟢 Haute sur la corrélation, 🟡 Moyenne sur le timing |

**Thesis SIFCA (volet cacao) :**

| Attribut | Valeur |
|---|---|
| Pilier | Cacao = composante parmi d'autres — diversification naturelle |
| Risque | Corrélation diluée par les autres activités (caoutchouc, huile de palme) |
| À surveiller | Résultats segmentés si disponibles |

---

## 2. Caoutchouc naturel — SICOM (Singapour) / TOCOM (Tokyo)

**Valeurs BRVM :** SAPH, SOGB

Pas de future européen ou américain dominant — le caoutchouc naturel se négocie principalement à Singapour et Tokyo. La demande est industrielle : les **pneumatiques représentent environ 70 %** de la consommation mondiale.

**SAPH** (filiale Michelin) et **SOGB** sont les deux purs joueurs caoutchouc cotés. La Côte d'Ivoire est le deuxième producteur africain et le sixième mondial.

**Mécanisme :** les cours SICOM remontent directement dans les prix de vente FOB des deux sociétés. Leurs coûts de production étant locaux et relativement fixes, **l'essentiel de la variation du cours de la matière tombe dans la marge opérationnelle**.

**Événements déclencheurs :**

- Ventes automobiles chinoises mensuelles (CAAM) — la Chine représente 35 % de la demande mondiale
- Résultats Michelin, Bridgestone, Continental (signal demande directe)
- Mousson en Thaïlande et Indonésie (n°1 et n°2 mondiaux) — mauvaise récolte là-bas = prix qui montent = SAPH/SOGB en profitent
- Prix du pétrole : le caoutchouc synthétique est fabriqué à partir de dérivés pétroliers — pétrole cher rend le caoutchouc naturel plus compétitif

**Thesis SAPH / SOGB :**

| Attribut | SAPH | SOGB |
|---|---|---|
| Actionnaire stratégique | Michelin | Indépendant |
| Pilier 1 | Demande pneus Chine (ventes auto CAAM) | Même |
| Pilier 2 | Adossement Michelin = off-take sécurisé | Exposition marché libre = plus grande volatilité |
| Risque 1 | Retournement ventes auto mondiales | Même |
| Risque 2 | SAPH : perte de contrat Michelin (extrême) | Dépendance à un seul type de client |
| Stop-loss | Ventes auto China YoY < -10 % pendant 2 mois | Même |
| Conviction | 🟢 Haute (corrélation claire, coûts fixes) | 🟡 Moyenne (moins de visibilité off-take) |

---

## 3. Huile de palme — CPO Futures (Bursa Malaysia, Kuala Lumpur)

**Valeurs BRVM :** PALC, SIFCA

L'huile de palme est la matière la **moins suivie par les investisseurs BRVM** mais **PALC** en dépend directement pour l'essentiel de ses revenus. SIFCA y est exposé via sa branche plantation.

Le CPO (Crude Palm Oil) est coté à Kuala Lumpur, pas sur les bourses occidentales — il faut suivre le **FCPO sur Bursa Malaysia**. La Malaisie et l'Indonésie représentent ensemble **85 % de l'offre mondiale**.

**Événements déclencheurs :**

- Données de production mensuelle Malaisie et Indonésie (MPOB)
- Politiques tarifaires de l'Inde (premier importateur mondial) — une hausse des taxes à l'import effondre les cours
- Réglementation européenne sur les huiles de palme dans les biocarburants (restrictions UE = choc demande négatif)
- Cours du soja (substitut direct) — si le soja chute, le CPO suit mécaniquement

**Thesis PALC :**

| Attribut | Valeur |
|---|---|
| Pilier 1 | CPO > 900 MYR/t → marges extraction positives |
| Pilier 2 | Marché domestique CI protégé (moins exposé aux chocs export) |
| Risque 1 | Réglementation UE anti-huile de palme dans biocarburants = choc demande structurel |
| Risque 2 | Hausse taxe import Inde → effondrement prix CPO mondial |
| Stop-loss | CPO < 3 200 MYR/t pendant > 8 semaines |
| Conviction | 🟡 Moyenne (valeur peu liquide, données CPO peu accessibles) |

---

## 4. Sucre brut — SB=F (ICE Futures n°11, New York)

**Valeur BRVM :** SCRC (Sucrivoire)

Sucrivoire est le **producteur et distributeur de sucre en Côte d'Ivoire**. Son exposition au cours mondial du sucre est directe mais partiellement amortie : une partie de la production est vendue sur le marché domestique à des **prix administrés par l'État ivoirien**.

La double nature de SCRC crée une **exposition asymétrique** : quand le SB=F monte fortement, l'État peut bloquer une transmission complète aux prix locaux pour protéger le consommateur — ce qui comprime la marge export mais sécurise le volume local.

**Événements déclencheurs :**

- Production brésilienne (Brésil = 25 % de l'offre mondiale) — sécheresse dans le centre-sud brésilien fait monter le SB=F
- Arbitrage éthanol/sucre au Brésil : quand l'éthanol est valorisé, les broyeurs produisent moins de sucre → cours monte
- Décisions d'export de l'Inde (deuxième producteur mondial) — très politiques, très impactantes
- Prix administrés en Côte d'Ivoire : risque réglementaire spécifique qui peut **découpler SCRC du cours mondial**

**Thesis SCRC :**

| Attribut | Valeur |
|---|---|
| Pilier 1 | SB=F > 20 USc/lb → expansion marges export |
| Pilier 2 | Marché domestique CI captif = socle de revenus stable |
| Risque 1 | Blocage prix par l'État CI quand SB=F monte → compression marge export |
| Risque 2 | Ouverture importations sucre CEDEAO → concurrence prix |
| Risque 3 | Production brésilienne record → SB=F < 15 USc/lb |
| Stop-loss | SB=F < 15 USc/lb pendant > 8 semaines |
| Conviction | 🟡 Moyenne (amortissement réglementaire CI réduit la corrélation pure) |

---

## 5. Pétrole brut — WTI CL=F et Brent BZ=F

**Valeurs BRVM :** TTLS (Total Sénégal), SVOC

C'est la **corrélation la plus mécanique et la plus rapide** de la BRVM — les deux titres réagissent souvent dès le lendemain d'un mouvement significatif du brut.

**TTLS** est distributeur pur : il achète des produits raffinés et les revend aux stations sénégalaises. Ses marges sont réglementées par l'État sénégalais mais le volume d'activité et la dynamique commerciale suivent le brut. **SVOC** combine raffinage et distribution en Côte d'Ivoire — double exposition au coût de la matière première et au prix de vente des produits finis.

**Risque réglementaire propre à l'Afrique de l'Ouest :** quand le brut monte fortement, les États bloquent les prix à la pompe pour des raisons sociales. TTLS et SVOC voient alors leurs marges comprimées administrativement — le cours mondial monte mais le bénéfice ne suit pas.

**Événements déclencheurs :**

- Décisions OPEP+ sur les quotas (réunions Vienne ou Riyad) → effet immédiat J+1
- Rapport hebdomadaire EIA (chaque mercredi, stocks pétrole et essence US) → référence mondiale
- Tensions géopolitiques Moyen-Orient (Iran, Houthis/Bab-el-Mandeb) → prime de risque Brent
- PMI manufacturier chinois mensuel → signal demande mondiale
- Saison des ouragans dans le Golfe du Mexique (juin–novembre) → choc d'offre temporaire

**Thesis TTLS :**

| Attribut | Valeur |
|---|---|
| Pilier 1 | Brent > 70 USD/bbl → dynamisme commercial + volumes |
| Pilier 2 | Production Sangomar (début 2024) → hausse volumes distribution au Sénégal |
| Pilier 3 | Réseau stations-service dominant au Sénégal |
| Risque 1 | Blocage prix pompe par l'État → marge administrée comprimée |
| Risque 2 | Brent < 55 USD/bbl prolongé → ralentissement investissements secteur |
| Stop-loss | Brent < 55 USD/bbl pendant > 8 semaines |
| Conviction | 🟢 Haute (corrélation directe, business model lisible) |

**Thesis SVOC :**

| Attribut | Valeur |
|---|---|
| Pilier 1 | Crack spread positif (WTI→produits raffinés) → amplification marges |
| Pilier 2 | Position monopolistique raffinage Côte d'Ivoire |
| Risque 1 | Surcapacité raffinage mondiale → compression crack spread |
| Risque 2 | Arrêt technique / maintenance imprévue (risque opérationnel spécifique) |
| Risque 3 | Brent < 65 USD/bbl ET crack spread < 5 USD/bbl simultanément |
| Stop-loss | Brent < 60 USD/bbl pendant > 6 semaines |
| Conviction | 🟡 Moyenne (plus complexe : deux étages de marge à modéliser) |

---

## 6. Facteurs transversaux (amplifient ou atténuent pour toute la cote)

### Parité USD/FCFA
Toutes ces matières sont cotées en **USD**. Le FCFA est arrimé à l'euro (655 FCFA = 1 €). Un dollar fort face à l'euro **augmente mécaniquement les revenus en FCFA des exportateurs** sans aucun mouvement du cours de la matière — et inversement.

### Prix administrés
Sucre, carburant et parfois huile de palme sont régulés à la consommation dans plusieurs pays UEMOA. Cela **amortit les chocs mondiaux** mais crée un risque de compression de marge quand les cours montent.

### Récoltes locales
Pour le cacao et le caoutchouc, une **mauvaise saison ivoirienne peut annuler l'effet d'un cours mondial favorable** — et inversement.

---

## 7. Calendrier des catalyseurs

| Fréquence | Événement | Valeurs impactées |
|---|---|---|
| Hebdo (mercredi) | Rapport stocks EIA (pétrole US) | TTLS, SVOC |
| Mensuel | Ventes auto China (CAAM) | SAPH, SOGB |
| Mensuel | Production palm Malaisie (MPOB) | PALC, SIFCA |
| Mensuel | PMI manufacturier Chine | Toutes |
| Mensuel | Rapport ICCO (cacao stocks) | SICC, SIFCA |
| Mensuel | Décisions export sucre Inde | SCRC |
| Trimestriel | Production caoutchouc ANRPC | SAPH, SOGB |
| Trimestriel | Résultats Barry Callebaut / Mondelez | SICC, SIFCA |
| Semestriel | Résultats SICC | SICC |
| Semestriel | Résultats SIFCA (comptes consolidés) | SIFCA |
| Semestriel | Résultats SCRC | SCRC |
| Ponctuel | Réunions OPEP+ | TTLS, SVOC |
| Ponctuel | Décisions Conseil Café-Cacao CI (prix bord-champ) | SICC, SIFCA |
| Ponctuel | Réglementation UE biocarburants / huile de palme | PALC, SIFCA |

---

## 8. Scorecard hebdomadaire (mis à jour via rapport commodities)

| Valeur | Matière clé | Signal semaine | Tendance 4S | Conviction | Action |
|---|---|---|---|---|---|
| SICC | Cacao CC=F | — | — | — | En attente |
| SIFCA | Cacao + Coton | — | — | — | En attente |
| SAPH | Caoutchouc | — | — | — | En attente |
| SOGB | Caoutchouc | — | — | — | En attente |
| PALC | Huile de palme | — | — | — | En attente |
| SCRC | Sucre SB=F | — | — | — | En attente |
| TTLS | Pétrole Brent | — | — | — | En attente |
| SVOC | Pétrole WTI/Brent | — | — | — | En attente |

*Mise à jour chaque lundi via `python commodity_weekly_generator.py`*

---

## 9. Règles de gouvernance

- Changement de conviction : **2 semaines consécutives** de signal contraire requis
- Stop-loss déclenché = sortie liste prioritaire pour **4 semaines minimum**
- Toute modification de structure (cession filiale, changement de production) → mettre à jour ce fichier ET `commodity_weekly_generator.py` simultanément
- NEIC (NEI-CEDA) = maison d'édition de livres — **hors scope commodity définitivement**

---

## 10. Historique des révisions

| Date | Modification |
|---|---|
| 2026-06-29 | Réécriture complète — couverture de toutes les valeurs commodity BRVM |
| 2026-06-29 | NEIC retiré définitivement (éditeur de livres, aucune exposition commodity) |
| 2026-06-29 | SCRC (Sucrivoire) ajouté sucre SB=F ; SICC confirmé cacao pur joueur |
| 2026-06-29 | Mécanismes de transmission détaillés par filière (forward contracts, prix administrés, arbitrages) |
