import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { t, type Theme } from './theme';

/* ── Forme de public/seance/seance.json (écrit par video/genere.mjs) ───── */
export interface Mouvement { code: string; variation_pct: number }
export interface Temps { type: string; texte: string; debut_s: number; duree_s: number }
export interface Fiche {
  seance: string;
  date_fr: string;
  valeurs: number;
  hausses: number;
  baisses: number;
  stables: number;
  capitaux_fcfa: number;
  capitaux_estimes: boolean;
  composite: { valeur: number; variation_pct: number } | null;
  ligne_lourde: { code: string; part_pct: number; variation_pct: number };
  secteurs: { secteur: string; valeurs: number; hausses: number; part_pct: number }[];
  historique_indice: { date: string; valeur: number }[];
  /* Pour le brief écrit, réutilisés par la version 16:9 du site. */
  meilleures5?: { code: string; designation?: string; variation_pct: number }[];
  pires5?: { code: string; designation?: string; variation_pct: number }[];
  transactions?: number | null;
  duree_s: number;
  publiable: boolean;
  video: {
    modele: 'nuit' | 'papier' | 'mosaique' | 'verre';
    angle: string | null;
    accroche: string | null;
    faits: { sens: number; serie: number; serie_plafonnee: boolean; record: boolean; fenetre: number; evolution_pct: number | null } | null;
    plan: Temps[];
    cotes: { code: string; variation_pct: number; part_pct: number }[];
    indices?: { code: string; valeur: number; variation_pct: number | null }[];
    seconde?: { code: string; designation: string; part_pct: number } | null;
    volume?: number;
    cours_lourde?: number | null;
    meilleures: Mouvement[];
    pires: Mouvement[];
    part_baissiere_pct: number;
    frise: string[];
    noms: Record<string, string>;
  };
  logos: Record<string, string>;
}

/* Zones sûres du format vertical : les applications posent leur légende en
   bas (≈ 380 px) et leur colonne d'icônes à droite. Rien d'important n'y va. */
export const MARGE = { haut: 250, bas: 340, gauche: 80, droite: 110 };

/* ── Fond ─────────────────────────────────────────────────────────────── */
export function Fond({ th }: { th: Theme }) {
  const f = useCurrentFrame();
  if (th.modele === 'verre') return <Studio f={f} th={th} />;
  const glisse = th.modele === 'papier' ? `0 ${f * 0.25}px` : `${-f * 0.4}px 0`;
  return (
    <AbsoluteFill style={{ background: th.halo }}>
      <AbsoluteFill style={{ backgroundImage: th.trame, backgroundPosition: glisse }} />
    </AbsoluteFill>
  );
}

/* ── Studio (modèle verre) ────────────────────────────────────────────────
   Un décor, pas une donnée : lumière du haut, trois rayons qui glissent
   lentement, un sol quadrillé en perspective et sa ligne d'horizon. Il donne
   au verre quelque chose à flouter et à refléter ; il ne porte aucun chiffre. */
export function Studio({ f, th, horizon = 0.62 }: { f: number; th: Theme; horizon?: number }) {
  const { height } = useVideoConfig();
  const H = height * horizon;
  return (
    <AbsoluteFill style={{ background: th.halo, overflow: 'hidden' }}>
      <AbsoluteFill style={{
        transform: `translateX(${Math.sin(f / 200) * 160}px)`,
        background: 'radial-gradient(ellipse 45% 32% at 50% 18%, rgba(170,240,235,.12), transparent 70%)',
      }} />
      <AbsoluteFill style={{ filter: 'blur(28px)' }}>
        {[0.16, 0.5, 0.8].map((x, i) => (
          <div key={i} style={{
            position: 'absolute', top: -300, bottom: -300, left: `${x * 100}%`, width: 120 + i * 70,
            transform: `translateX(${Math.sin(f / 240 + i * 2) * 140}px) rotate(18deg)`,
            background: 'linear-gradient(90deg, transparent, rgba(160,235,230,.075), transparent)',
          }} />
        ))}
      </AbsoluteFill>
      <div style={{
        position: 'absolute', left: -1600, right: -1600, top: H, height: 1800, transformOrigin: '50% 0',
        transform: 'perspective(700px) rotateX(74deg)',
        backgroundImage: 'linear-gradient(rgba(63,224,203,.22) 2px, transparent 2px), linear-gradient(90deg, rgba(63,224,203,.15) 2px, transparent 2px)',
        backgroundSize: '130px 130px', backgroundPosition: `0 ${(f * 0.9) % 130}px`,
        WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 22%, #000 55%, transparent 100%)',
      }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: H - 160, height: 320, background: 'radial-gradient(ellipse 55% 50% at 50% 50%, rgba(24,182,164,.12), transparent 70%)' }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, top: H - 1, height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(120,240,225,.7) 50%, transparent)',
        boxShadow: '0 0 24px rgba(63,224,203,.5)',
      }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)' }} />
    </AbsoluteFill>
  );
}

/** Panneau de verre : flou de ce qui est derrière, liseré clair en haut à
 *  gauche qui vire au turquoise en bas à droite, reflet qui balaie à l'entrée. */
export function Verre({ children, style, rayon = 44, reflet = 0 }: { children?: React.ReactNode; style?: React.CSSProperties; rayon?: number; reflet?: number }) {
  return (
    <div style={{
      position: 'relative', borderRadius: rayon, overflow: 'hidden',
      background: 'linear-gradient(160deg, rgba(255,255,255,.10), rgba(255,255,255,.025) 45%, rgba(255,255,255,.05))',
      backdropFilter: 'blur(20px) saturate(1.5) brightness(1.06)', WebkitBackdropFilter: 'blur(20px) saturate(1.5) brightness(1.06)',
      boxShadow: 'inset 0 2px 0 rgba(255,255,255,.38), inset 0 0 50px rgba(255,255,255,.04), 0 50px 110px rgba(0,0,0,.5)',
      ...style,
    }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: rayon, pointerEvents: 'none',
        background: 'radial-gradient(120% 60% at 12% -10%, rgba(255,255,255,.18), transparent 45%), radial-gradient(80% 50% at 110% 115%, rgba(63,224,203,.13), transparent 55%)' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: rayon, padding: 2, pointerEvents: 'none',
        background: 'linear-gradient(135deg, rgba(255,255,255,.6), rgba(255,255,255,.06) 35%, rgba(255,255,255,.03) 65%, rgba(63,224,203,.5))',
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' }} />
      {reflet > 0 && reflet < 1 && (
        <div style={{ position: 'absolute', top: '-30%', bottom: '-30%', width: '28%', pointerEvents: 'none',
          left: `${-40 + reflet * 150}%`, transform: 'skewX(-14deg)',
          background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.14) 45%, rgba(255,255,255,.3) 50%, rgba(255,255,255,.14) 55%, transparent)' }} />
      )}
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}

/* ── Logo WESTBOURSE, tracé ───────────────────────────────────────────── */
export function Logo({ th, taille, prog = 1 }: { th: Theme; taille: number; prog?: number }) {
  const p1 = Math.min(1, prog * 1.6), p2 = Math.max(0, Math.min(1, (prog - 0.5) * 3)), p3 = Math.max(0, Math.min(1, (prog - 0.75) * 4));
  const trait = th.logoClair ? '#FCFCFC' : th.encre;
  const teal = th.modele === 'papier' ? '#0E8C80' : '#16B6A4';
  // Modèle verre : le logo officiel, avec sa tuile bleu nuit.
  const tuile = th.modele === 'verre';
  return (
    <svg width={taille} height={taille * 0.78} viewBox="6 4 122 90" style={{ overflow: 'visible' }}>
      {tuile && <rect x={-2} y={-10} width={138} height={112} rx={26} fill="#0D1E2F" stroke="rgba(255,255,255,.28)" strokeWidth={2} opacity={Math.min(1, prog * 4)} />}
      <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke={trait} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p1} opacity={p1 > 0 ? 1 : 0} />
      <path d="M76 82 L100 33" fill="none" stroke={teal} strokeWidth={12} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p2} opacity={p2 > 0 ? 1 : 0} />
      <polygon points="110,12 117,40 86,28" fill={teal} opacity={p3} />
    </svg>
  );
}

/** Logo d'une société, sur fond blanc (image de marque, jamais teintée), ou son code. */
export function Vignette({ th, fiche, code, taille }: { th: Theme; fiche: Fiche; code: string; taille: number }) {
  const src = fiche.logos[code];
  const rayon = th.modele === 'mosaique' ? taille * 0.06 : taille * 0.14;
  if (src) {
    return (
      <Img src={staticFile(src)} style={{
        width: taille, height: taille, objectFit: 'contain', background: '#fff', padding: taille * 0.09,
        borderRadius: rayon, flex: '0 0 auto', border: th.modele === 'papier' ? `1px solid ${th.bord}` : 'none',
      }} />
    );
  }
  return (
    <div style={{
      width: taille, height: taille, borderRadius: rayon, background: th.surface, border: `1px solid ${th.bord}`,
      color: th.doux, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: th.chiffre, fontSize: taille * 0.24, flex: '0 0 auto',
    }}>{code}</div>
  );
}

/* ── En-tête permanent : marque, date, et repère du modèle ────────────── */
export function EnTete({ th, fiche }: { th: Theme; fiche: Fiche }) {
  if (th.modele === 'papier') {
    return (
      <div style={{ position: 'absolute', top: 92, left: MARGE.gauche, right: MARGE.gauche, color: th.encre }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `3px solid ${th.encre}`, paddingBottom: 14 }}>
          <span style={{ fontFamily: th.titre, fontSize: 46, fontWeight: 700, letterSpacing: '.02em' }}>Westbourse</span>
          <span style={{ fontFamily: th.texte, fontSize: 24, letterSpacing: '.16em', textTransform: 'uppercase', color: th.doux }}>Séance BRVM</span>
        </div>
        <div style={{ borderBottom: `1px solid ${th.encre}`, padding: '10px 0', fontFamily: th.texte, fontSize: 24, color: th.doux }}>
          {fiche.date_fr}
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', top: 96, left: MARGE.gauche, right: MARGE.gauche, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Logo th={th} taille={62} />
        <span style={{ fontFamily: th.chiffre, fontSize: 28, letterSpacing: '.34em', fontWeight: 600, color: th.encre }}>WESTBOURSE</span>
      </div>
      <span style={{ fontFamily: th.chiffre, fontSize: 22, letterSpacing: '.14em', color: th.sourd, textTransform: 'uppercase' }}>
        {th.modele === 'mosaique' ? 'carte · ' : ''}{fiche.date_fr}
      </span>
    </div>
  );
}

/* ── Progression façon « story » : un segment par temps du récit ──────── */
export function Progression({ th, plan, total }: { th: Theme; plan: { d0: number; duree: number }[]; total: number }) {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', top: 52, left: MARGE.gauche, right: MARGE.gauche, display: 'flex', gap: 8 }}>
      {plan.map(({ d0, duree }, i) => {
        const p = Math.max(0, Math.min(1, (f - d0) / Math.max(1, i === plan.length - 1 ? total - d0 : duree)));
        return (
          <div key={i} style={{ flex: duree, height: th.modele === 'mosaique' ? 10 : 6, background: th.modele === 'verre' ? 'rgba(255,255,255,.09)' : th.bord, borderRadius: th.modele === 'mosaique' ? 0 : 3, overflow: 'hidden' }}>
            <div style={{ width: `${p * 100}%`, height: '100%', borderRadius: 3, background: th.modele === 'verre' ? 'linear-gradient(90deg, #18B6A4, #3FE0CB)' : th.accent, boxShadow: th.modele === 'verre' ? '0 0 12px #18B6A4' : 'none' }} />
          </div>
        );
      })}
    </div>
  );
}

/* ── Apparitions : chaque modèle entre en scène à sa manière ──────────── */
export function Entre({ th, debut, children, style }: { th: Theme; debut: number; children: React.ReactNode; style?: React.CSSProperties }) {
  const f = useCurrentFrame();
  const p = t(f, debut, debut + 18);
  const effet: React.CSSProperties =
    th.entree === 'volet'
      ? { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, transform: `translateX(${(1 - p) * -24}px)` }
      : th.entree === 'zoom'
        ? { opacity: p, transform: `scale(${0.92 + p * 0.08})` }
        : th.entree === 'bascule'
          ? { opacity: p, transform: `perspective(1400px) translateY(${(1 - p) * 46}px) rotateX(${(1 - p) * 20}deg)`, filter: `blur(${(1 - p) * 9}px)` }
        : { opacity: p, transform: `translateY(${(1 - p) * 40}px)`, filter: `blur(${(1 - p) * 8}px)` };
  return <div style={{ ...effet, ...style }}>{children}</div>;
}

/** Enveloppe de scène : fondu d'entrée/sortie et très lente poussée de caméra,
 *  pour qu'aucune image ne reste figée pendant qu'on parle. */
export function Scene({ th, duree, children, centre = false }: { th: Theme; duree: number; children: React.ReactNode; centre?: boolean }) {
  const f = useCurrentFrame();
  const o = Math.min(t(f, 0, 8), t(f, duree - 8, duree, 1, 0));
  const zoom = 1 + (f / Math.max(1, duree)) * 0.025;
  if (th.modele === 'verre') {
    // Tout le contenu de la scène tient dans un seul panneau de verre, qui
    // bascule en place puis laisse passer un reflet.
    const p = t(f, 0, 22);
    return (
      <AbsoluteFill style={{
        opacity: o, transform: `scale(${zoom})`,
        padding: `${MARGE.haut}px ${MARGE.droite - 40}px ${MARGE.bas - 40}px ${MARGE.gauche - 30}px`,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', color: th.encre, fontFamily: th.texte,
      }}>
        <div style={{ transform: `perspective(1800px) translateY(${(1 - p) * 70}px) rotateX(${(1 - p) * 16}deg)`, opacity: Math.min(1, p * 1.4) }}>
          <Verre reflet={t(f, 14, 46)} style={{ padding: '64px 56px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: centre ? 'center' : 'stretch', textAlign: centre ? 'center' : 'left' }}>
              {children}
            </div>
          </Verre>
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{
      opacity: o, transform: `scale(${zoom})`,
      padding: `${MARGE.haut}px ${MARGE.droite}px ${MARGE.bas}px ${MARGE.gauche}px`,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: centre ? 'center' : 'stretch', textAlign: centre ? 'center' : 'left',
      color: th.encre, fontFamily: th.texte,
    }}>{children}</AbsoluteFill>
  );
}

export function Etiquette({ th, texte }: { th: Theme; texte: string }) {
  if (th.modele === 'papier') {
    return <div style={{ fontFamily: th.texte, fontSize: 28, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: th.accent, borderTop: `2px solid ${th.accent}`, paddingTop: 14, marginBottom: 30, alignSelf: 'flex-start' }}>{texte}</div>;
  }
  return <div style={{ fontFamily: th.chiffre, fontSize: 28, letterSpacing: '.26em', textTransform: 'uppercase', color: th.accent, marginBottom: 34 }}>{th.modele === 'mosaique' ? `▍${texte}` : texte}</div>;
}
