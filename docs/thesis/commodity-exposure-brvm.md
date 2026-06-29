# Impact des cours mondiaux sur les actions BRVM exposées aux matières premières

> **Dernière mise à jour :** 2026-06-29
> **Usage :** Référence hebdomadaire — mise à jour via rapport `commodity_weekly_generator.py`
>
> **Conventions de lecture :**
> - `#FACT` — donnée vérifiée (profil BRVM officiel, rapports d'activité publics)
> - `#MODEL` — analyse interne / modèle de transmission économique (pas donnée BRVM officielle)

---

## 0. Univers retenu

`#FACT` — Valeurs BRVM avec exposition directe ou très forte à une matière première mondiale.

| Ticker | Société | Pays | Filière principale | Matière(s) clé(s) |
|---|---|---|---|---|
| SICC | Société Ivoirienne de Coco Râpé (SICOR) | CI | Coco / coprah | Huiles végétales (proxy) |
| SIFCA | SIFCA | CI | Groupe agro-industriel multi-filières | Huile de palme, hévéa, sucre |
| SAPH | SAPH Côte d'Ivoire | CI | Plantation d'hévéas | Caoutchouc naturel |
| SOGB | SOGB Côte d'Ivoire | CI | Plantation hévéa + palmier à huile | Caoutchouc naturel, huile de palme |
| PALC | PALM CI (PALMCI) | CI | Huile de palme brute | Huile de palme (CPO) |
| SCRC | SUCRIVOIRE | CI | Production de sucre | Sucre brut |
| TTLS | Total Sénégal | SN | Distribution produits pétroliers | Produits raffinés / pétrole brut |
| SVOC | Société pétrolière CI *(profil à confirmer sur fiche BRVM)* | CI | Raffinage + distribution | Pétrole brut (Brent/WTI) |

> **NEIC (NEI-CEDA)** = maison d'édition de livres → **hors scope commodity définitivement.**

---

## 1. Matrice de sensibilité

`#MODEL` — Sensibilité directionnelle indicative (analyse interne, pas données BRVM officielles).

| Action | Cacao | Caoutchouc | Huile palme | Sucre | Pétrole | Coco / huiles végétales |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| SICC | — | — | ●● | — | — | ●●●● |
| SIFCA | ● | ●● | ●● | ●● | — | — |
| SAPH | — | ●●●● | — | — | ● | — |
| SOGB | — | ●●● | ●● | — | ● | — |
| PALC | — | — | ●●●● | — | — | — |
| SCRC | — | — | — | ●●● | — | — |
| TTLS | — | — | — | — | ●●●● | — |
| SVOC | — | — | — | — | ●●●● | — |

*● faible · ●● modéré · ●●● fort · ●●●● très fort*

> Le caoutchouc (SICOM/TOCOM) et l'huile de palme (CPO Bursa Malaysia) n'ont pas de futures trackés dans notre générateur Python — les proxies CC=F et SB=F sont utilisés à titre indicatif dans le scorecard ; interpréter avec prudence.

---

## 2. Coco / huiles végétales — SICC (SICOR)

`#FACT` — **SICC = Société Ivoirienne de Coco Râpé**, spécialisée dans la transformation et commercialisation de noix de coco et d'huile de coprah. Secteur BRVM : Agriculture / Consommation de base. Sources : BRVM, RichBourse, Zonebourse.

> ⚠️ **SICC n'est pas une société de cacao.** Toute association SICC–CC=F (cacao ICE) est erronée.

`#MODEL` — **Mécanisme de transmission :** les produits coco/coprah sont en concurrence partielle avec d'autres huiles végétales (palme, soja, colza). La sensibilité de SICC est donc naturelle au panier d'huiles végétales (CPO Bursa, soja CBOT…) plutôt qu'au contrat cacao CC=F. Quand ce panier monte, les prix de vente SICOR peuvent être soutenus, les coûts de production restant majoritairement locaux et rigides.

`#MODEL` — **Thesis SICC :**

| Attribut | Valeur |
|---|---|
| Pilier 1 | Hausse généralisée des huiles végétales → pricing power sur dérivés coco/coprah |
| Pilier 2 | Spécialisation mono-produit = pureté thématique mais risque concentré |
| Risque 1 | Sécheresse / maladies sur les cocoteraies locales |
| Risque 2 | Concurrence d'huiles substituables meilleur marché (palme, soja) |
| Stop-loss indicatif | Cassure durable panier huiles végétales + détérioration résultats |
| Conviction | 🟡 Moyenne (données moins accessibles, marché étroit) |

---

## 3. Cacao — CC=F (ICE Futures, New York)

`#FACT` — **Il n'existe pas de pur joueur cacao coté à la BRVM.** Le cacao affecte l'économie ivoirienne (≈ 40 % de la production mondiale) et certaines branches de SIFCA, mais sans titre dédié coté. Sources : rapports sectoriels cacao, documents SIFCA publics.

`#MODEL` — L'impact cacao sur la BRVM est davantage **macro** (revenus d'export UEMOA, sentiment sur la place) que **micro** (driver titre). SIFCA peut être touchée à la marge via certaines plantations, mais le cœur de sa valeur repose sur palmier, hévéa et sucre.

**Événements déclencheurs à surveiller pour la macro BRVM :**

- Sécheresse ou excès de pluie en Côte d'Ivoire et au Ghana
- Publications de stocks ICCO (Organisation Internationale du Cacao)
- Décisions du Conseil Café-Cacao ivoirien sur le prix bord-champ
- Résultats trimestriels Barry Callebaut ou Mondelez (signal demande)
- Parité USD/EUR (amplification ou atténuation en FCFA)

---

## 4. Caoutchouc naturel — SICOM (Singapour) / TOCOM (Tokyo)

`#FACT` — **SAPH** : Société Africaine de Plantation d'Hévéas, secteur Agriculture BRVM, plantations d'hévéas pour caoutchouc naturel. **SOGB** : Société des Caoutchoucs de Grand-Béréby, activités hévéa et palmier à huile, secteur Agriculture. Sources : fiches BRVM SAPH et SOGB, rapports financiers.

`#MODEL` — **Mécanisme :** les cours SICOM/TOCOM se répercutent directement dans les prix FOB de SAPH et SOGB. Coûts locaux rigides → l'essentiel de la variation du cours tombe dans la marge opérationnelle. La demande pneumatiques représente ≈ 70 % de la consommation mondiale.

**Événements déclencheurs :**
- Ventes auto chinoises mensuelles (CAAM) — Chine ≈ 35 % de la demande mondiale
- Résultats Michelin, Bridgestone, Continental (signal demande)
- Mousson en Thaïlande et Indonésie (n°1 et n°2 mondiaux) — mauvaise récolte là-bas = prix qui montent = SAPH/SOGB en profitent
- Prix du pétrole : caoutchouc synthétique fabriqué à partir de dérivés pétroliers → pétrole cher rend le naturel plus compétitif

`#MODEL` — **Thesis SAPH / SOGB :**

| Attribut | SAPH | SOGB |
|---|---|---|
| Actionnaire stratégique | Adossement Michelin → off-take partiellement sécurisé | Moins intégré à un grand groupe international |
| Pilier 1 | Demande pneus (ventes auto Chine / US / Europe) | Idem |
| Pilier 2 | Visibilité off-take long terme → volatilité résultats plus lissée | Exposition marché spot → plus grande volatilité |
| Risque 1 | Reflux durable ventes auto mondiales | Idem |
| Risque 2 | Baisse SICOM avec coûts locaux rigides | Idem |
| Stop-loss indicatif | Ventes auto China YoY < -10 % + prix SICOM baissiers prolongés | Idem |
| Conviction | 🟢 Haute (corrélation claire, business lisible) | 🟡 Moyenne (plus volatile, moins de visibilité) |

---

## 5. Huile de palme — CPO (Bursa Malaysia, Kuala Lumpur)

`#FACT` — **PALC (PALMCI)** : spécialisée production et commercialisation d'huile de palme brute en CI. **SIFCA** : groupe actif sur trois filières — palmier à huile, hévéa, sucre (via Sucrivoire). **SOGB** : palmier à huile en complément de l'hévéa. Sources : fiche BRVM PALMCI, rapports SIFCA, profil SOGB.

`#MODEL` — **Benchmark :** contrat CPO (Crude Palm Oil) FCPO sur Bursa Malaysia. Malaisie + Indonésie = ≈ 85 % de l'offre mondiale.

**Événements déclencheurs :**
- Données de production mensuelle MPOB (Malaisie)
- Politiques tarifaires Inde (premier importateur) — hausse taxes = effondrement cours
- Réglementation européenne biocarburants / huile de palme (restrictions = choc demande)
- Cours du soja (substitut direct) — soja bas → CPO baisse mécaniquement

`#MODEL` — **Thesis PALC :**

| Attribut | Valeur |
|---|---|
| Pilier 1 | FCPO haussier → marges d'extraction soutenues, coûts locaux rigides |
| Pilier 2 | Marchés domestiques et régionaux partiellement captifs (lissage résultats) |
| Risque 1 | Réglementations UE anti-palme dans les biocarburants |
| Risque 2 | Hausse taxes import Inde → effondrement prix CPO mondial |
| Risque 3 | Surproduction Asie du Sud-Est → CPO durablement bas |
| Stop-loss indicatif | FCPO sous seuil clé plusieurs semaines + signaux marges en baisse |
| Conviction | 🟡 Moyenne (valeur peu liquide, données CPO techniques à suivre) |

---

## 6. Sucre brut — SB=F (ICE Futures n°11, New York)

`#FACT` — **SCRC — SUCRIVOIRE** : société ivoirienne de production et distribution de sucre, cotée à la BRVM, rapports d'activité réguliers publiés. Source : fiche BRVM SUCRIVOIRE.

`#MODEL` — **Mécanisme :** benchmark = sucre brut n°11 SB=F sur ICE New York. Partie production vendue sur marché domestique (potentiellement à prix administrés — *hypothèse raisonnable, non documentée officiellement*) ; partie exportée aux prix mondiaux. Quand SB=F monte, marge export augmente, mais l'État peut brider la transmission vers les consommateurs locaux → **exposition asymétrique**.

**Événements déclencheurs :**
- Production brésilienne (Brésil ≈ 25 % de l'offre mondiale) — sécheresse centre-sud = hausse SB=F
- Arbitrage éthanol/sucre au Brésil : si l'éthanol est mieux valorisé, moins de sucre produit → cours monte
- Décisions export Inde (deuxième producteur) — très politiques, très impactantes
- Changements prix administrés en CI : risque réglementaire spécifique

`#MODEL` — **Thesis SCRC :**

| Attribut | Valeur |
|---|---|
| Pilier 1 | SB=F durablement élevé → soutien marges export |
| Pilier 2 | Marché domestique captif = socle de revenus récurrents stables |
| Risque 1 | Blocage prix par l'État CI en période haussière → compression marge export |
| Risque 2 | Concurrence importations CEDEAO si droits de douane évoluent |
| Risque 3 | Surproduction mondiale (Brésil, Inde) → SB=F sous seuil critique |
| Stop-loss indicatif | SB=F sous seuil + détérioration résultats semestriels |
| Conviction | 🟡 Moyenne (fort poids risque réglementaire local) |

---

## 7. Pétrole brut — Brent BZ=F / WTI CL=F

`#FACT` — **TTLS (Total Sénégal)** : distribution de produits pétroliers au Sénégal, cotée BRVM. **SVOC** : société pétrolière ivoirienne (raffinage et/ou distribution — *profil exact à confirmer sur fiche BRVM officielle*). Sources : fiche BRVM Total Sénégal, fiche BRVM société pétrolière CI.

`#MODEL` — Corrélation la plus mécanique et la plus rapide de la BRVM. TTLS achète des produits raffinés indexés brut et les revend sur un marché à prix encadrés ; volumes et dynamique commerciale suivent le cycle pétrolier. SVOC ajoute une couche via le crack spread (écart brut → produits raffinés).

**Risque réglementaire propre UEMOA** `#MODEL` : en période de hausse forte du brut, les États bloquent les prix à la pompe pour des raisons sociales → marges comprimées administrativement. *C'est une pratique courante documentée dans la région, pas une clause contractuelle BRVM.*

**Événements déclencheurs :**
- Décisions OPEP+ quotas (réunions Vienne / Riyad) → effet J+1
- Rapport hebdomadaire EIA (chaque mercredi, stocks US) → référence mondiale
- Tensions géopolitiques Moyen-Orient (Iran, Houthis/Bab-el-Mandeb) → prime risque Brent
- PMI manufacturier chinois mensuel → signal demande mondiale
- Saison ouragans Golfe du Mexique (juin–novembre) → choc d'offre temporaire

`#MODEL` — **Thesis TTLS :**

| Attribut | Valeur |
|---|---|
| Pilier 1 | Brent dans une zone de prix « confortable » → volumes et marges solides |
| Pilier 2 | Position forte réseau stations Sénégal ; production Sangomar (2024+) → hausse volumes |
| Risque 1 | Blocage prix pompe par l'État → marges comprimées administrativement |
| Risque 2 | Brent très bas prolongé → pression sur l'ensemble de la filière |
| Stop-loss indicatif | Dégradation visible marges sur 2 semestres consécutifs |
| Conviction | 🟢 Haute (corrélation directe, modèle business lisible) |

`#MODEL` — **Thesis SVOC :**

| Attribut | Valeur |
|---|---|
| Pilier 1 | Crack spread positif → création de valeur au raffinage |
| Pilier 2 | Position clé chaîne énergie CI |
| Risque 1 | Surcapacité mondiale raffinage → crack spread comprimé |
| Risque 2 | Arrêt technique / maintenance lourde → pertes ponctuelles |
| Stop-loss indicatif | Brent bas + crack spread faible + signaux opérationnels négatifs |
| Conviction | 🟡 Moyenne (structure plus complexe que TTLS) |

---

## 8. Facteurs transversaux

`#MODEL`

### Parité USD / FCFA
Toutes les matières premières sont cotées en USD. Le FCFA est arrimé à l'euro (655 FCFA = 1 €). Un dollar fort face à l'euro **augmente mécaniquement les revenus en FCFA des exportateurs** sans aucun mouvement du cours de la matière.

### Prix administrés
Carburants, sucre, et parfois huile de palme peuvent être soumis à prix plafonnés dans plusieurs pays UEMOA. Cela **amortit les chocs mondiaux** pour le consommateur mais crée un risque de compression de marge. *Pratique courante dans la région, à vérifier au cas par cas sur chaque titre.*

### Récoltes locales
Pour toutes les valeurs agricoles (SAPH, SOGB, PALC, SICC, SCRC, SIFCA), le volume de récolte locale peut **neutraliser ou amplifier** l'impact d'un mouvement mondial de prix.

---

## 9. Calendrier des catalyseurs

`#MODEL`

| Fréquence | Événement | Valeurs impactées |
|---|---|---|
| Hebdo (mercredi) | Rapport stocks EIA (pétrole US) | TTLS, SVOC |
| Mensuel | Ventes auto Chine (CAAM) | SAPH, SOGB |
| Mensuel | Production palm oil Malaisie (MPOB) | PALC, SIFCA, SOGB |
| Mensuel | Rapports agro (USDA, etc.) | SCRC, SIFCA |
| Mensuel | Rapports sectoriels huiles végétales | SICC, PALC, SOGB, SIFCA |
| Mensuel | Rapport ICCO (cacao stocks — macro CI) | Sentiment BRVM |
| Trimestriel | Résultats groupes pneumatiques (Michelin…) | SAPH, SOGB |
| Semestriel | Résultats SAPH / SOGB / PALC / SICC / SCRC / SIFCA | Toutes agro |
| Ponctuel | Réunions OPEP+ (quotas production) | TTLS, SVOC |
| Ponctuel | Décisions réglementaires locales (prix administrés) | TTLS, SVOC, SCRC, PALC |
| Ponctuel | Décisions Conseil Café-Cacao CI | Macro CI / SIFCA |
| Ponctuel | Réglementation UE biocarburants / huile de palme | PALC, SIFCA |

---

## 10. Scorecard hebdomadaire

*Mis à jour chaque lundi via `python commodity_weekly_generator.py`*

| Valeur | Matière clé | Signal semaine | Tendance 4S | Conviction | Action |
|---|---|---|---|---|---|
| SICC | Huiles végétales (proxy) | — | — | — | En attente |
| SIFCA | Huile de palme / Hévéa / Sucre | — | — | — | En attente |
| SAPH | Caoutchouc SICOM | — | — | — | En attente |
| SOGB | Caoutchouc + Huile palme | — | — | — | En attente |
| PALC | CPO Bursa Malaysia | — | — | — | En attente |
| SCRC | Sucre brut SB=F | — | — | — | En attente |
| TTLS | Pétrole Brent | — | — | — | En attente |
| SVOC | Pétrole Brent / WTI | — | — | — | En attente |

---

## 11. Règles de gouvernance du modèle

`#MODEL` — *Méthodologie interne, pas standard marché.*

- Changement de conviction : **2 semaines consécutives** de signaux contraires requis
- Stop-loss indicatif déclenché = mise en quarantaine **4 semaines minimum**
- Toute modification de structure (cession filiale, changement de filière) → mise à jour simultanée de ce fichier et de `commodity_weekly_generator.py`
- **NEIC (NEI-CEDA)** = éditeur de livres → hors scope commodity définitivement
- **SICC ≠ cacao** : Société Ivoirienne de Coco Râpé (coprah / huiles végétales)

---

## 12. Historique des révisions

| Date | Modification |
|---|---|
| 2026-06-29 | Création initiale (v1) |
| 2026-06-29 | Correction SICC : coco râpé / coprah, pas cacao |
| 2026-06-29 | NEIC retiré définitivement |
| 2026-06-29 | SCRC (Sucrivoire) confirmé sucre |
| 2026-06-29 | Réécriture complète v3 : labels #FACT / #MODEL, profils vérifiés, mécanismes labellisés comme modèles internes, SVOC marqué « à confirmer fiche BRVM » |
