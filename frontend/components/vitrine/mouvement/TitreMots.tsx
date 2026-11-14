import { Fragment, type CSSProperties } from 'react';
import { decouperTitre } from '@/lib/vitrine/mouvement';

type Props = {
  /** Titre complet, accent compris : « Toute la BRVM. Au chiffre près. » */
  texte: string;
  /** Groupe de mots final, rendu en Instrument Serif italique : « Au chiffre près. » */
  accent?: string;
  as?: 'h1' | 'h2';
  className?: string;
};

/**
 * Titre révélé mot par mot (charte §8 : ressort, 0,07 s de décalage). Animation
 * CSS pure, composant serveur : le texte est dans le HTML initial (titre de page,
 * plus grand élément visible) et `prefers-reduced-motion` l'affiche tel quel.
 */
export function TitreMots({ texte, accent, as = 'h2', className }: Props) {
  const Tag = as;
  const { principaux, accentues } = decouperTitre(texte, accent);
  let rang = 0;
  const rendre = (liste: string[]) =>
    liste.map((mot, i) => {
      const style = { '--vm-rang': rang++ } as CSSProperties;
      return (
        <Fragment key={`${mot}-${i}`}>
          {i > 0 ? ' ' : null}
          <span className="vm-ligne"><span className="vm-mot" style={style}>{mot}</span></span>
        </Fragment>
      );
    });
  return (
    <Tag className={className}>
      {rendre(principaux)}
      {accentues.length > 0 && (
        <>
          {' '}
          <span className="vitrine-accent">{rendre(accentues)}</span>
        </>
      )}
    </Tag>
  );
}
