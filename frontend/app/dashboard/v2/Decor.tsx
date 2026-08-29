'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Le decor de la page : la trame de l'axe, le meridien continu, la teinte.
 *
 * LA TRAME. La graduation ne vivait que dans les colonnes de graphique. Elle se
 * prolonge sur toute la page, calee sur l'abscisse REELLE du meridien - lue sur
 * le DOM, jamais codee en dur, donc elle suit si la mise en page change.
 *
 * LE MERIDIEN CONTINU. Un trait fixe a l'abscisse du zero, visible tant que
 * l'axe est a l'ecran. L'axe cesse d'etre un detail repete : il devient la
 * colonne vertebrale de la page.
 *
 * LA TEINTE. Tres faible, derivee de la part baissiere de la seance. Elle n'est
 * pas decorative : rouge sourd quand les capitaux penchent a la vente, vert
 * sourd sinon, intensite proportionnelle a l'ecart. Le decor dit ce que disent
 * les chiffres.
 *
 * Rien de tout cela ne bouge : il n'y a donc rien a neutraliser sous
 * prefers-reduced-motion, hormis le fondu de la teinte.
 */
export function Decor({ partBaissiere }: { partBaissiere: number }) {
  const [pas, setPas] = useState<number | null>(null);
  const [origine, setOrigine] = useState(0);
  const [gauche, setGauche] = useState<number | null>(null);
  const tick = useRef(false);

  useEffect(() => {
    const maj = () => {
      tick.current = false;
      const champ = document.querySelector('.dash-v2 .v2-comb');
      const axe = champ?.querySelector('.v2-meridien');
      if (!champ || !axe) {
        setGauche(null);
        return;
      }
      const rc = champ.getBoundingClientRect();
      const ra = axe.getBoundingClientRect();
      if (rc.width < 40) return;
      const p = rc.width / 8; // 8 divisions, comme la graduation
      setPas(p);
      setOrigine(((ra.left % p) + p) % p);
      const vu = rc.bottom > 80 && rc.top < window.innerHeight - 40;
      setGauche(vu ? Math.round(ra.left) : null);
    };
    const demande = () => {
      if (tick.current) return;
      tick.current = true;
      requestAnimationFrame(maj);
    };
    maj();
    window.addEventListener('scroll', demande, { passive: true });
    window.addEventListener('resize', demande);
    return () => {
      window.removeEventListener('scroll', demande);
      window.removeEventListener('resize', demande);
    };
  }, []);

  const ecart = (partBaissiere - 50) / 50;
  const teinte = ecart >= 0 ? '255 107 107' : '63 225 139';
  const force = Math.min(1, Math.abs(ecart) * 2.6);

  return (
    <>
      <div
        className="v2-teinte"
        aria-hidden
        style={{ ['--tc' as string]: teinte, opacity: (0.35 + 0.65 * force).toFixed(3) }}
      />
      {pas != null && (
        <div
          className="v2-grille"
          aria-hidden
          style={{
            ['--pas' as string]: `${pas.toFixed(2)}px`,
            backgroundPositionX: `${origine.toFixed(2)}px`,
          }}
        />
      )}
      {gauche != null && <div className="v2-spine" aria-hidden style={{ left: `${gauche}px` }} />}
    </>
  );
}
