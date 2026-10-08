import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
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
  duree_s: number;
  publiable: boolean;
  video: {
    modele: 'nuit' | 'papier' | 'mosaique';
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
  const glisse = th.modele === 'papier' ? `0 ${f * 0.25}px` : `${-f * 0.4}px 0`;
  return (
    <AbsoluteFill style={{ background: th.halo }}>
      <AbsoluteFill style={{ backgroundImage: th.trame, backgroundPosition: glisse }} />
    </AbsoluteFill>
  );
}

/* ── Logo WESTBOURSE, tracé ───────────────────────────────────────────── */
export function Logo({ th, taille, prog = 1 }: { th: Theme; taille: number; prog?: number }) {
  const p1 = Math.min(1, prog * 1.6), p2 = Math.max(0, Math.min(1, (prog - 0.5) * 3)), p3 = Math.max(0, Math.min(1, (prog - 0.75) * 4));
  const trait = th.logoClair ? '#FCFCFC' : th.encre;
  const teal = th.modele === 'papier' ? '#0E8C80' : '#16B6A4';
  return (
    <svg width={taille} height={taille * 0.78} viewBox="6 4 122 90" style={{ overflow: 'visible' }}>
      <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke={trait} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p1} />
      <path d="M76 82 L100 33" fill="none" stroke={teal} strokeWidth={12} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p2} />
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
          <div key={i} style={{ flex: duree, height: th.modele === 'mosaique' ? 10 : 6, background: th.bord, borderRadius: th.modele === 'mosaique' ? 0 : 3, overflow: 'hidden' }}>
            <div style={{ width: `${p * 100}%`, height: '100%', background: th.accent }} />
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
        : { opacity: p, transform: `translateY(${(1 - p) * 40}px)`, filter: `blur(${(1 - p) * 8}px)` };
  return <div style={{ ...effet, ...style }}>{children}</div>;
}

/** Enveloppe de scène : fondu d'entrée/sortie et très lente poussée de caméra,
 *  pour qu'aucune image ne reste figée pendant qu'on parle. */
export function Scene({ th, duree, children, centre = false }: { th: Theme; duree: number; children: React.ReactNode; centre?: boolean }) {
  const f = useCurrentFrame();
  const o = Math.min(t(f, 0, 8), t(f, duree - 8, duree, 1, 0));
  const zoom = 1 + (f / Math.max(1, duree)) * 0.025;
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
