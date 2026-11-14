import type { CSSProperties, ReactNode } from 'react';
import './mouvement.css';

type Props = {
  children: ReactNode;
  /** Durée d'une boucle en secondes (38 à 46). */
  duree?: number;
  sens?: 'normal' | 'inverse';
  className?: string;
};

/** Texte défilant en boucle, CSS pur. Décoratif : masqué aux lecteurs d'écran. */
export function Bandeau({ children, duree = 42, sens = 'normal', className }: Props) {
  const d = Math.min(46, Math.max(38, duree));
  const style = { '--vm-duree': `${d}s` } as CSSProperties;
  return (
    <div
      aria-hidden="true"
      className={`vm-bandeau${sens === 'inverse' ? ' vm-bandeau--inverse' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      <div className="vm-bandeau__rail">
        <div className="vm-bandeau__piste">{children}</div>
        <div className="vm-bandeau__piste">{children}</div>
      </div>
    </div>
  );
}
