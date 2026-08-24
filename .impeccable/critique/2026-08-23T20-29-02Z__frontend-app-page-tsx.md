---
timestamp: 2026-08-23T20-29-02Z
slug: frontend-app-page-tsx
---
# Critique — landing WESTBOURSE

Method: dual-agent (A: design review · B: detector/browser evidence)
Cible : frontend/app/page.tsx · branche feature/landing-v2 · 2026-08-23

## Score de santé design : 20/36 applicables (2,0/4 de moyenne)

| # | Heuristique | Score |
|---|---|---|
| 1 | Visibilité de l'état du système | 3 |
| 2 | Correspondance système / monde réel | 2 |
| 3 | Contrôle et liberté | 2 |
| 4 | Cohérence et standards | 1 |
| 5 | Prévention des erreurs | 2 |
| 6 | Reconnaissance plutôt que rappel | 2 |
| 7 | Flexibilité et efficience | 1 |
| 8 | Esthétique et design épuré | 2 |
| 9 | Récupération d'erreur | n/a |
| 10 | Aide et documentation | 3 |

## P0
- Barres de sous-scores : échelles hétérogènes non déclarées, barre PLEINE étiquetée « 0.00 ».
  RatingSpotlight.tsx:15-37 · HeroDeviceMockup.tsx:66-82
- Aucune navigation sous 1024 px ; aucune Connexion sous 640 px ; seul CTA collant = page premium.
  TasteTopbar.tsx:56-70
- <main> absent + aucun lien d'évitement. ConditionalShell.tsx:80-89

## P1
- Grille tarifaire vide (plan_features) + aucun bouton dans les cartes. PremiumCompare.tsx:38-53
- Trois promesses de fraîcheur contradictoires. ProofBand.tsx:60 · page.tsx:857,863,1156
- Contraste : text-faint échoue sur tous les fonds (2,68-4,22:1), 344 usages dont 99 en 10-11 px.
  Le commentaire globals.css:61 affirmant AA est FAUX.
- Saut de titre h1 -> h3. MarketStateCard.tsx:146
- Marquees sans pause utilisateur (WCAG 2.2.2). reduced-motion EST couvert par la règle globale.
- Teaser Diagnostic IA : texte LLM brut, coquille « L'DUSTRIE », sur BICB qui n'a aucun fondamental.

## P2
- Poids : 2,86 Mo, un chunk JS de 1101 Ko. bloomfield-logo.png = 94,7 Ko pour un rendu 16 px.
- Logos de sources à fond cuit : rectangles noirs en clair, blancs en sombre.
- Graphiques fondamentaux sans axe ni valeurs, aria-label sans chiffres.
- CTA principal sous 4 libellés différents. BUY/HOLD/SELL non traduits.
- Mobile = 21 écrans, 2x le desktop. 143 liens.
- 5 composants orphelins.

## Mesuré
- 0 lien mort, 0 img sans alt, 0 bouton sans nom accessible.
- 0 débordement horizontal sur 4 viewports.
- prefers-reduced-motion respecté (vérifié en navigateur).
- Détecteur : 0 finding sur la landing.
