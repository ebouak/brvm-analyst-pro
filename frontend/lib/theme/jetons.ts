'use client';

import { useEffect, useState } from 'react';

/**
 * Lecture des jetons de couleur À L'EXÉCUTION.
 *
 * POURQUOI CE MODULE EXISTE. Le design system pilote ses couleurs par variables
 * CSS (`--color-up`, `--color-accent`… voir `app/globals.css`) et le mode clair
 * les REDÉFINIT : `--color-up` passe de `63 225 139` à `13 138 79`. Une classe
 * Tailwind (`text-up`, `stroke-accent`) suit donc le thème sans qu'on fasse
 * rien. Recharts, lui, prend ses couleurs en PROPS — `stroke`, `fill`,
 * `contentStyle`, `tick={{ fill }}` — qui ne traversent aucune feuille de
 * style : un `#3fe18b` écrit là reste le vert néon du mode sombre sur fond
 * papier, où il tombe sous 2 : 1 de contraste. Ce hook rend les variables
 * lisibles depuis le JS.
 *
 * ⚠️ NE PAS L'UTILISER LÀ OÙ UNE CLASSE SUFFIT. Un SVG écrit à la main, une
 * bordure, un texte : la classe de jeton reste la bonne réponse — elle ne coûte
 * aucun rendu et ne peut pas se désynchroniser. Ce module est réservé aux
 * valeurs qu'on ne PEUT pas exprimer en classe.
 *
 * ⚠️ RENVOIE `''` AU RENDU SERVEUR. Il n'y a pas de `document` là-bas, donc pas
 * de variable à lire. C'est sans conséquence pour Recharts, dont le
 * `ResponsiveContainer` ne rend aucun enfant tant qu'il n'a pas mesuré sa
 * largeur — donc rien de coloré n'atteint le HTML du serveur. Un appelant qui
 * ferait rendre cette couleur côté serveur créerait, lui, une divergence
 * d'hydratation : ce n'est pas l'outil qu'il lui faut.
 */

/** Jetons lus tels que `globals.css` les écrit : des TRIPLETS RGB
 *  (`86 215 253`), forme imposée par les modificateurs d'opacité de Tailwind
 *  (voir `withAlpha` dans `tailwind.config.ts`). D'où le `rgb(...)` reconstruit
 *  ici : une variable qui porterait déjà une couleur complète produirait une
 *  valeur invalide, et il n'y en a aucune dans ce projet. */
function lire<K extends string>(noms: readonly K[]): Record<K, string> {
  const sortie = {} as Record<K, string>;
  if (typeof document === 'undefined') {
    for (const nom of noms) sortie[nom] = '';
    return sortie;
  }
  const calcule = getComputedStyle(document.documentElement);
  for (const nom of noms) {
    const triplet = calcule.getPropertyValue(`--color-${nom}`).trim();
    sortie[nom] = triplet ? `rgb(${triplet})` : '';
  }
  return sortie;
}

/**
 * Renvoie les jetons demandés sous forme de couleurs CSS, et les remet à jour
 * quand le thème change.
 *
 * `noms` doit être une constante de module (`as const` hors du composant) : un
 * littéral reconstruit à chaque rendu ferait reboucler l'effet.
 *
 *   const JETONS = ['up', 'down', 'accent'] as const;
 *   const c = useJetons(JETONS);   // c.up === 'rgb(63 225 139)'
 */
export function useJetons<K extends string>(noms: readonly K[]): Record<K, string> {
  const cle = noms.join(',');
  // Initialisation PARESSEUSE, lue pendant le premier rendu client : la feuille
  // de style est déjà en place et `data-theme` déjà posé par le script
  // anti-flash de `layout.tsx`. Les couleurs sont donc justes dès la première
  // peinture, sans reprise visible.
  const [jetons, setJetons] = useState<Record<K, string>>(() => lire(noms));

  useEffect(() => {
    const appliquer = () =>
      setJetons((precedent) => {
        const suivant = lire(noms);
        // Un nouvel objet à chaque relecture forcerait un rendu pour rien.
        return noms.every((nom) => precedent[nom] === suivant[nom]) ? precedent : suivant;
      });

    appliquer();
    // `ThemeToggle` pose ou retire `data-theme` sur <html> : c'est le seul
    // signal de changement de thème, il n'y a pas d'événement à écouter.
    const observateur = new MutationObserver(appliquer);
    observateur.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observateur.disconnect();
    // `cle` est la forme stable de `noms` ; dépendre du tableau reboucherait
    // chez tout appelant qui passe un littéral.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  return jetons;
}

/** Applique une opacité à une couleur rendue par `useJetons`. Une couleur vide
 *  (rendu serveur) reste vide plutôt que de devenir une valeur CSS invalide. */
export function avecAlpha(couleur: string, opacite: number): string {
  if (!couleur.startsWith('rgb(')) return couleur;
  return `${couleur.slice(0, -1)} / ${opacite})`;
}
