'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type CourbeValeur from './CourbeValeur';

/**
 * Chargement paresseux de la courbe du portefeuille (recharts, ~360 KB bruts) :
 * c'était la plus grosse bibliothèque du tableau de bord, évaluée avant que le
 * contenu de la page ne soit affiché — mesuré à 2,5 s de processeur sur un
 * mobile bridé ×4. ResponsiveContainer ne rend rien côté serveur (il lui faut
 * la largeur réelle) : ne pas la rendre au serveur ne retire donc rien.
 * La réserve garde la hauteur du graphique (h-56) pour éviter tout décalage.
 */
const LazyCourbe = dynamic(() => import('./CourbeValeur'), {
  ssr: false,
  loading: () => <div className="h-56 w-full animate-pulse rounded-xl bg-white/[0.03]" aria-hidden />,
});

export default function CourbeValeurLazy(props: ComponentProps<typeof CourbeValeur>) {
  return <LazyCourbe {...props} />;
}
