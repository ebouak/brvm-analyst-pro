import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

/**
 * « Le fil conducteur » — les sept étapes de la méthode, en vidéo carrée.
 *
 * DESTINÉE AUX RÉSEAUX, PAS À LA LANDING. La section du site est un `tablist`
 * ARIA : sept boutons, un panneau alimenté par un fait réel, navigation au
 * clavier. Un MP4 ne se clique pas — le remplacer supprimerait l'interaction,
 * les quatorze phrases indexables et le suivi du thème. Cette vidéo est un
 * SECOND support, pour le canal @westbourse7 et LinkedIn.
 *
 * UNE SEULE SOURCE DE LIBELLÉS. `ETAPES` recopie mot pour mot les sept étapes
 * de `frontend/app/page.tsx` (constante `STEPS`). Deux paquets TS distincts,
 * pas de module partagé : toute correction est à reporter des deux côtés,
 * comme pour `scraper/src/hebdo/pure/`. Un test le vérifierait mal — sept
 * phrases divergeant lentement se voient à l'œil, pas à l'assertion.
 *
 * AUCUN CHIFFRE. Les sept descriptions n'en contiennent pas, et on n'en ajoute
 * pas : une valeur gravée dans un MP4 devient fausse dès la séance suivante,
 * sans que rien ne le signale. Les chiffres vivent sur le site, où ils sont
 * datés.
 *
 * Composition carrée 1080×1080 : le seul format qui passe partout (Telegram,
 * LinkedIn, Instagram) sans recadrage.
 */

const BG = '#030303';
const SURFACE = '#0a1417';
const IVOIRE = '#fcfcfc';
const ATONE = '#b5b5b5';
const TENU = '#7a8a90';

const ACCENT = '#56d7fd';
const HAUSSE = '#3fe18b';
const ALERTE = '#f0b23a';
const POURPRE = '#8b6fc2';

/** Durées, en images à 30 i/s. L'intro et la sortie encadrent sept scènes. */
export const INTRO = 60;
export const PAR_ETAPE = 66;
export const SORTIE = 78;
export const TOTAL = INTRO + 7 * PAR_ETAPE + SORTIE; // 600 images = 20 s

interface Etape {
  k: string;
  t: string;
  d: string;
  c: string;
  ic: React.ReactNode;
}

/** Recopié de frontend/app/page.tsx — mêmes numéros, mêmes titres, mêmes
 *  phrases, mêmes tracés d'icône, mêmes couleurs de jeton. */
const ETAPES: Etape[] = [
  {
    k: '01', t: 'Données', c: ACCENT,
    d: 'Cours, volumes et publications collectés à la source.',
    ic: (<><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>),
  },
  {
    k: '02', t: 'Analyse', c: ACCENT,
    d: 'Fondamentaux, RSI, MACD, dividendes.',
    ic: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>),
  },
  {
    k: '03', t: 'Note A–F', c: HAUSSE,
    d: 'Un score quantitatif explicable par action.',
    ic: <path d="M4 20v-8M10 20V7M16 20V3M22 20H2" />,
  },
  {
    k: '04', t: 'Signal', c: ALERTE,
    d: 'BUY, HOLD ou SELL, avec son niveau de confiance.',
    ic: <path d="M3 16l5-6 4 4 5-8 4 5" />,
  },
  {
    k: '05', t: 'Dossier d’analyse', c: POURPRE,
    d: 'Forces, risques et valorisation mis en mots.',
    ic: <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-2 3 3 3 0 0 0 2 3v1a3 3 0 0 0 3 3h1V4H9zM15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 2 3 3 3 0 0 1-2 3v1a3 3 0 0 1-3 3h-1V4h1z" />,
  },
  {
    k: '06', t: 'Simulation', c: ACCENT,
    d: 'Ce que la décision aurait donné, dividendes inclus.',
    ic: (<><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" fill={SURFACE} /><circle cx="15" cy="12" r="2" fill={SURFACE} /><circle cx="8" cy="17" r="2" fill={SURFACE} /></>),
  },
  {
    k: '07', t: 'Décision', c: HAUSSE,
    d: 'À vous de trancher, avec les chiffres sous les yeux.',
    ic: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>),
  },
];

const MONO = 'ui-monospace, "JetBrains Mono", "DejaVu Sans Mono", monospace';
const SANS = '"Segoe UI", "Helvetica Neue", system-ui, sans-serif';

/**
 * Le fil, en bas de l'image : sept pastilles reliées par un trait qui avance.
 * Il tient lieu de barre de progression — la même forme dit où on en est et
 * de quoi il s'agit, plutôt que deux éléments qui se répètent.
 */
function Fil({ actif, avance }: { actif: number; avance: number }) {
  const GAUCHE = 150;
  const LARGEUR = 780;
  const pas = LARGEUR / (ETAPES.length - 1);
  // `avance` va de 0 à 6 en continu : le trait se remplit entre deux pastilles
  // au lieu de sauter de l'une à l'autre.
  const rempli = (avance / (ETAPES.length - 1)) * LARGEUR;

  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 132, height: 40 }}>
      <svg width="1080" height="40" viewBox="0 0 1080 40" style={{ display: 'block' }}>
        <line x1={GAUCHE} y1="20" x2={GAUCHE + LARGEUR} y2="20" stroke={TENU} strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
        <line x1={GAUCHE} y1="20" x2={GAUCHE + Math.max(0, rempli)} y2="20" stroke={ETAPES[actif]!.c} strokeWidth="2.5" strokeLinecap="round" />
        {ETAPES.map((e, i) => {
          const x = GAUCHE + i * pas;
          const franchie = i <= avance + 0.01;
          return (
            <circle
              key={e.k}
              cx={x}
              cy={20}
              r={i === actif ? 9 : 5}
              fill={franchie ? e.c : SURFACE}
              stroke={franchie ? e.c : TENU}
              strokeOpacity={franchie ? 1 : 0.5}
              strokeWidth="2"
            />
          );
        })}
      </svg>
    </div>
  );
}

function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entree = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const sousTitre = interpolate(frame, [16, 38], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, justifyContent: 'center', alignItems: 'center', fontFamily: SANS, padding: 90 }}>
      <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 6, color: ACCENT, opacity: sousTitre }}>
        WESTBOURSE
      </div>
      <div
        style={{
          color: IVOIRE, fontSize: 92, fontWeight: 700, letterSpacing: -2, textAlign: 'center',
          marginTop: 30, opacity: entree, transform: `translateY(${(1 - entree) * 22}px)`,
        }}
      >
        Le fil conducteur
      </div>
      <div style={{ color: ATONE, fontSize: 34, marginTop: 26, textAlign: 'center', opacity: sousTitre, maxWidth: 760, lineHeight: 1.4 }}>
        Sept étapes, de la donnée à la décision.
      </div>
    </AbsoluteFill>
  );
}

function Scene({ i }: { i: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = ETAPES[i]!;

  const entree = spring({ frame, fps, config: { damping: 15, stiffness: 100 } });
  // Fondu de sortie sur les 10 dernières images : les scènes s'enchaînent sans
  // coupure sèche.
  const sortie = interpolate(frame, [PAR_ETAPE - 10, PAR_ETAPE], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const texte = interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // Le fil avance pendant toute la scène, de l'étape précédente à celle-ci.
  const avance = i === 0 ? 0 : interpolate(frame, [0, 26], [i - 1, i], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: SANS }}>
      {/* En-tête fixe. Sans lui, le carré avait 225 px de vide en haut et
          235 px entre le texte et le fil : l'œil lisait un cadrage raté, pas
          une respiration. Il sert aussi de signature sur les plateformes où
          la vidéo est reprise hors contexte. */}
      <div style={{ position: 'absolute', top: 76, left: 0, right: 0, textAlign: 'center', fontFamily: MONO, fontSize: 21, letterSpacing: 5, color: TENU }}>
        WESTBOURSE
        <span style={{ color: ACCENT, margin: '0 12px' }}>·</span>
        LE FIL CONDUCTEUR
      </div>

      {/* Le fondu porte sur le CONTENU seul, pas sur la scène entière : sinon
          le fil s'éteint puis se rallume à chaque changement d'étape, et le
          trait censé être continu clignote six fois. */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '110px 110px 130px', opacity: sortie }}>
        <div
          style={{
            width: 220, height: 220, borderRadius: '50%',
            background: `${e.c}24`, color: e.c,
            display: 'grid', placeItems: 'center',
            transform: `scale(${0.86 + entree * 0.14})`, opacity: entree,
          }}
        >
          <svg width="104" height="104" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {e.ic}
          </svg>
        </div>

        <div style={{ fontFamily: MONO, fontSize: 26, color: TENU, marginTop: 40, opacity: texte, letterSpacing: 1 }}>
          {e.k}
        </div>
        <div
          style={{
            color: IVOIRE, fontSize: 68, fontWeight: 700, letterSpacing: -1.5, marginTop: 10,
            textAlign: 'center', opacity: texte, transform: `translateY(${(1 - texte) * 14}px)`,
          }}
        >
          {e.t}
        </div>
        <div style={{ color: ATONE, fontSize: 34, marginTop: 22, textAlign: 'center', maxWidth: 800, lineHeight: 1.42, opacity: texte }}>
          {e.d}
        </div>
      </AbsoluteFill>

      <Fil actif={i} avance={avance} />
    </AbsoluteFill>
  );
}

function Sortie() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entree = spring({ frame, fps, config: { damping: 13, stiffness: 100 } });
  const second = interpolate(frame, [20, 42], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: BG, justifyContent: 'center', alignItems: 'center', fontFamily: SANS, padding: 90 }}>
      <div
        style={{
          color: IVOIRE, fontSize: 60, fontWeight: 700, textAlign: 'center', lineHeight: 1.25,
          opacity: entree, transform: `scale(${0.94 + entree * 0.06})`, maxWidth: 840,
        }}
      >
        Chaque étape s’appuie sur la précédente.
      </div>
      <div style={{ color: ATONE, fontSize: 32, marginTop: 26, textAlign: 'center', opacity: second, maxWidth: 780, lineHeight: 1.4 }}>
        Rien n’est affirmé sans la donnée qui le justifie.
      </div>
      <div
        style={{
          marginTop: 52, fontFamily: MONO, fontSize: 30, letterSpacing: 2,
          color: '#03222b', background: `linear-gradient(180deg, #8fe6ff, ${ACCENT})`,
          padding: '16px 34px', borderRadius: 999, opacity: second,
        }}
      >
        westbourse.com
      </div>
      <div style={{ position: 'absolute', bottom: 92, opacity: second, color: TENU, fontSize: 22, textAlign: 'center', maxWidth: 820, lineHeight: 1.4 }}>
        Outil d’analyse. Pas un conseil en investissement.
      </div>
    </AbsoluteFill>
  );
}

export default function FilConducteurVideo() {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Sequence durationInFrames={INTRO}>
        <Intro />
      </Sequence>
      {ETAPES.map((e, i) => (
        <Sequence key={e.k} from={INTRO + i * PAR_ETAPE} durationInFrames={PAR_ETAPE}>
          <Scene i={i} />
        </Sequence>
      ))}
      <Sequence from={INTRO + ETAPES.length * PAR_ETAPE} durationInFrames={SORTIE}>
        <Sortie />
      </Sequence>
    </AbsoluteFill>
  );
}
