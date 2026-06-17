import { type CSSProperties } from 'react';

export interface AnimatedLogoProps {
  /** px of the square mark (defaults 48) */
  size?: number;
  /** mark only, or mark + WESTBOURSE wordmark */
  variant?: 'mark' | 'lockup';
  /** play the stroke-draw animation (default true) */
  animate?: boolean;
  /** loop the animation (loaders/splash) vs play once (default false) */
  loop?: boolean;
  /** render the rounded night-blue box behind the mark (default true) */
  background?: boolean;
  className?: string;
}

const NAVY = '#0c1d2e';
const WHITE = '#ffffff';
const TEAL = '#16b6a4';

export function AnimatedLogo({
  size = 48,
  variant = 'mark',
  animate = true,
  loop = false,
  background = true,
  className,
}: AnimatedLogoProps) {
  const animClass = animate ? (loop ? 'wslogo-anim wslogo-loop' : 'wslogo-anim') : '';
  const markStyle: CSSProperties = { width: size, height: (size * 105) / 130 };

  return (
    <span
      className={['wslogo', className].filter(Boolean).join(' ')}
      role="img"
      aria-label="WESTBOURSE"
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28 }}
    >
      <svg className={animClass} viewBox="0 0 130 105" style={markStyle} aria-hidden="true">
        {background && <rect x="2" y="2" width="126" height="101" rx="22" fill={NAVY} />}
        <path className="wslogo-w" d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke={WHITE} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
        <path className="wslogo-shaft" d="M76 82 L100 33" fill="none" stroke={TEAL} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
        <polygon className="wslogo-head" points="110,12 117,40 86,28" fill={TEAL} />
      </svg>
      {variant === 'lockup' && (
        <span
          style={{ fontWeight: 700, letterSpacing: '.42em', color: '#f4f6f8', fontSize: size * 0.42, paddingLeft: '.42em', whiteSpace: 'nowrap' }}
        >
          WESTBOURSE
        </span>
      )}
    </span>
  );
}

export default AnimatedLogo;
