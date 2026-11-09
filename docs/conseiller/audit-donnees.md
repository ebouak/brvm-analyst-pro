# Audit des données — Conseiller v2

Exécuté le 2026-11-09T14:30:50.575Z · empreinte des données `f9fed6b7ca3b03985f1ce0b619688f7bbec1be294462e2ff529a29e06f197762`
Calendrier : 1998-09-16 → 2026-11-09 (5905 séances), 49 valeurs.

## 0. Erreurs de saisie retirées (96 séances, 10 valeurs)

Allers-retours hors de [×0,8 ; ×1,25] revenus à ±10 % dans les 5 séances (spec §11.2), retirés avant tout calcul.

| Valeur | Séances retirées |
|---|---|
| ONTBF | 48 |
| BOAN | 32 |
| SLBC | 6 |
| BICC | 3 |
| SIVC | 2 |
| BNBC | 1 |
| NTLC | 1 |
| PRSC | 1 |
| SDSC | 1 |
| SGBC | 1 |

## 0 bis. Ruptures non expliquées (22)

Variation d'une séance hors de [×0,8 ; ×1,25] sans dividende détaché ce jour-là qui l'explique (spec §11.3). Les fenêtres qui les contiennent sont exclues du banc.

| Valeur | Date | Rapport |
|---|---|---|
| STAC | 2008-05-02 | 0.783 |
| ABJC | 2008-09-23 | 0.733 |
| CABC | 2008-12-19 | 0.668 |
| SHEC | 2009-04-24 | 0.732 |
| FTSC | 2009-07-07 | 1.354 |
| SMBC | 2009-08-27 | 0.747 |
| SMBC | 2009-09-01 | 0.792 |
| CFAC | 2010-03-04 | 0.791 |
| UNXC | 2010-03-05 | 0.792 |
| STBC | 2010-04-15 | 0.789 |
| SOGC | 2011-06-01 | 1.429 |
| SGBC | 2011-06-07 | 1.335 |
| SOGC | 2011-06-24 | 0.758 |
| PRSC | 2011-07-21 | 0.760 |
| BOAN | 2012-05-22 | 0.765 |
| SOGC | 2012-07-19 | 0.798 |
| BOABF | 2013-06-13 | 0.786 |
| ETIT | 2016-09-01 | 1.261 |
| PALC | 2017-11-06 | 0.478 |
| ONTBF | 2018-02-05 | 0.500 |
| SLBC | 2018-05-09 | 0.793 |
| UNLC | 2020-06-02 | 1.364 |

## 1. Sauts de cours hors de [×0,6 ; ×1,6] (3)

| Valeur | Date | Rapport |
|---|---|---|
| PALC | 2017-11-06 | 0.478 |
| ONTBF | 2018-02-05 | 0.500 |
| FTSC | 2025-09-26 | 0.581 |

À recouper un par un avec les opérations sur titres connues. Un fractionnement non ajusté exige une table d'ajustements AVANT le banc.

## 2. Cours figés (part de séances sans échange)

| Valeur | Séances | Part figée |
|---|---|---|
| ETIT | 3041 | 64.9 % |
| SVOC | 717 | 53.7 % |
| UNLC | 1790 | 48.0 % |
| BOAB | 4283 | 44.0 % |
| SLBC | 2502 | 42.4 % |
| BICC | 4160 | 41.9 % |
| SEMC | 2017 | 41.9 % |
| SIVC | 3917 | 41.4 % |
| SICC | 1664 | 41.2 % |
| NTLC | 3311 | 39.7 % |
| NEIC | 2337 | 39.6 % |
| STBC | 3459 | 39.4 % |
| PRSC | 2231 | 39.0 % |
| BNBC | 3560 | 38.8 % |
| STAC | 2265 | 38.6 % |
| SAFC | 1778 | 38.3 % |
| SNTS | 4944 | 38.0 % |
| CABC | 3278 | 37.6 % |
| SHEC | 4199 | 37.4 % |
| CFAC | 3257 | 37.3 % |
| SMBC | 3270 | 37.0 % |
| SDCC | 3818 | 36.4 % |
| CBIBF | 2374 | 35.8 % |
| BOAN | 4023 | 35.8 % |
| ABJC | 3944 | 35.5 % |
| CIEC | 4509 | 35.3 % |
| SDSC | 3836 | 33.7 % |
| BOABF | 3535 | 33.3 % |
| SOGC | 4348 | 32.7 % |
| ORGT | 1767 | 32.4 % |
| SPHC | 4570 | 32.1 % |
| TTLC | 3829 | 32.0 % |
| SGBC | 4356 | 31.3 % |
| BOAC | 3629 | 31.3 % |
| FTSC | 4341 | 31.1 % |
| UNXC | 3468 | 30.6 % |
| TTLS | 2937 | 30.1 % |
| ONTBF | 3956 | 29.4 % |
| BOAS | 3007 | 27.9 % |
| SCRC | 2452 | 27.7 % |
| NSBC | 2218 | 27.1 % |
| LNBB | 474 | 24.9 % |
| PALC | 2947 | 24.3 % |
| ECOC | 2244 | 23.9 % |
| BOAM | 2615 | 23.8 % |
| SIBC | 2528 | 23.8 % |
| ORAC | 959 | 20.2 % |
| BICB | 383 | 15.7 % |
| BBGC | 33 | 3.0 % |

## 3. Valeurs sans cotation depuis 30 jours (radiées ou suspendues)

SVOC

Sens du biais : si des sociétés radiées manquent à la base, le banc favorise la famille « risque » et pénalise « Vendre ».

## 4. Couverture fondamentale (valeurs couvertes par exercice)

```json
{"2012":1,"2013":1,"2015":2,"2016":1,"2017":2,"2018":2,"2019":3,"2020":14,"2021":47,"2022":47,"2023":47,"2024":46,"2025":44}
```

## 5. Dividendes

178 dividendes exploitables, dont 145 avec une ex-date réelle ou reconstituée (81 %).
Les autres excluent les fenêtres mai-août de leur valeur (spec §3.5b).
