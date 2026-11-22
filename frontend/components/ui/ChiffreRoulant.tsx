'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { colonnesRoulant } from '@/lib/realtime/roulant';

const CHIFFRES = '0123456789'.split('');
const DUREE_MS = 720;

/**
 * Nombre dont les chiffres roulent de l'ancienne valeur vers la nouvelle,
 * comme un compteur kilométrique.
 *
 * - Au rendu serveur et au repos : texte ordinaire (copiable, lisible par les
 *   lecteurs d'écran et les moteurs). Les bandes 0-9 n'existent que le temps
 *   de l'animation, puis le texte revient.
 * - `depuisZero` : à la première apparition à l'écran, les chiffres partent de
 *   zéro (révélation d'un bilan). Sans cette option, rien ne bouge avant le
 *   premier vrai changement de valeur.
 * - prefers-reduced-motion : la valeur change sans animation.
 * - Pendant l'animation, la couleur dit le sens (hausse ou baisse) ; les
 *   chiffres intermédiaires ne sont qu'un effet, la valeur réelle reste
 *   annoncée aux lecteurs d'écran.
 */
export function ChiffreRoulant({
  valeur,
  format,
  className = '',
  depuisZero = false,
}: {
  valeur: number | null;
  format: (v: number) => string;
  className?: string;
  depuisZero?: boolean;
}) {
  const texte = valeur == null ? '—' : format(valeur);
  const calme = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true, amount: 0.4 });

  const [roule, setRoule] = useState(false);
  const [affiche, setAffiche] = useState(texte);
  const [sens, setSens] = useState<'up' | 'down' | null>(null);
  const precedent = useRef<{ texte: string; valeur: number | null }>({ texte, valeur });
  const revele = useRef(false);

  // Lance une animation de `depart` vers `texte`.
  const lancer = (depart: string, dir: 'up' | 'down' | null) => {
    setAffiche(depart);
    setSens(dir);
    setRoule(true);
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setAffiche(texte));
    });
    const fin = setTimeout(() => { setRoule(false); setSens(null); }, DUREE_MS + 260);
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); clearTimeout(fin); };
  };

  // Révélation depuis zéro, une fois, à l'entrée dans l'écran.
  useEffect(() => {
    if (!depuisZero || !visible || revele.current || calme || valeur == null) return;
    revele.current = true;
    precedent.current = { texte, valeur };
    return lancer(texte.replace(/\d/g, '0'), null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, depuisZero, calme]);

  // Changement de valeur : roule de l'ancienne à la nouvelle.
  useEffect(() => {
    const avant = precedent.current;
    if (texte === avant.texte) return;
    precedent.current = { texte, valeur };
    if (calme || avant.valeur == null || valeur == null) {
      setRoule(false);
      setAffiche(texte);
      return;
    }
    return lancer(avant.texte, valeur > avant.valeur ? 'up' : valeur < avant.valeur ? 'down' : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texte, calme]);

  const couleur = sens === 'up' ? 'roulant-up' : sens === 'down' ? 'roulant-down' : '';

  if (!roule) {
    return <span ref={ref} className={`${className} ${couleur}`}>{texte}</span>;
  }
  const colonnes = colonnesRoulant(affiche);
  return (
    <span ref={ref} className={`${className} ${couleur}`}>
      <span className="sr-only">{texte}</span>
      <span aria-hidden className="roulant-cols select-none">
        {colonnes.map((c, i) =>
          'chiffre' in c ? (
            <span key={c.cle} className="roulant-col">
              <span
                className="roulant-bande"
                style={{
                  // 10 chiffres dans la bande : 10 % de sa hauteur par chiffre.
                  transform: `translateY(${-c.chiffre * 10}%)`,
                  transitionDelay: `${(colonnes.length - i) * 22}ms`,
                }}
              >
                {CHIFFRES.map((d) => <span key={d}>{d}</span>)}
              </span>
            </span>
          ) : (
            <span key={c.cle} className="roulant-car">{c.caractere}</span>
          ),
        )}
      </span>
    </span>
  );
}
