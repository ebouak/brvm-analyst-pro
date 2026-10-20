import type { IconeFlux } from '@/lib/academy/types';

/**
 * Pictogrammes au trait des schémas de mécanisme (bloc `flux` d'une leçon).
 * Dessinés ici, en SVG inline : aucune dépendance, couleur héritée
 * (`currentColor`), purement décoratifs (le titre de l'étape porte le sens).
 */
const TRACES: Record<IconeFlux, JSX.Element> = {
  entreprise: (
    <>
      <path d="M4 21V6l7-3v18" />
      <path d="M11 21V9l9 3v9" />
      <path d="M2.5 21h19" />
      <path d="M7 9v.01M7 12.5v.01M7 16v.01M15 14.5v.01M15 18v.01" />
    </>
  ),
  benefices: (
    <>
      <path d="M3 21h18" />
      <path d="M6 17v-4M10.5 17V9.5M15 17v-6M19.5 17V6" />
      <path d="M5 9.5l5-4 4 2.5 5.5-4.5" />
      <path d="M16.5 3.5h3v3" />
    </>
  ),
  decision: (
    <>
      <path d="M7 3h7.5L19 7.5V21H7z" />
      <path d="M14.5 3v4.5H19" />
      <path d="M10 14l2.2 2.2L16.5 12" />
      <path d="M4.5 7v14.5" />
    </>
  ),
  actionnaires: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c.4-3.3 2.6-5.5 5.5-5.5s5.1 2.2 5.5 5.5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16.2 14.2c2.4.2 4 2 4.3 4.8" />
    </>
  ),
  paiement: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v.01M18 14.5v.01" />
    </>
  ),
  calendrier: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14h2M14 14h2M8 17.5h2" />
    </>
  ),
  graphique: (
    <>
      <path d="M3.5 3.5V20.5h17" />
      <path d="M7 15.5l3.5-4 3 2.5 5-6.5" />
    </>
  ),
  piece: (
    <>
      <ellipse cx="12" cy="6.5" rx="7" ry="2.8" />
      <path d="M5 6.5v5c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-5" />
      <path d="M5 11.5v5c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-5" />
    </>
  ),
};

export default function Pictogramme({ icone }: { icone: IconeFlux }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRACES[icone]}
    </svg>
  );
}
