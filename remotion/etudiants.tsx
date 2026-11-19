import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from 'remotion';
import { SANS } from './polices';
import { EASE } from './ecosysteme';
import GRATUIT from './etudiants-gratuit.json';
import ACADEMY from './etudiants-academy.json';

/**
 * Deux vidéos de présentation pour les étudiants (2026-11-18), verticales
 * 1080×1920, voix off et sous-titres mot à mot.
 *
 *  - `etudiants-gratuit` : la partie gratuite et le portefeuille virtuel ;
 *  - `etudiants-academy` : la WESTBOURSE Academy.
 *
 * Une seule source par vidéo : etudiants-<id>.json porte les titres ET la voix.
 * La durée d'une scène est celle de sa piste de voix (durees.json) ; les
 * sous-titres suivent les instants des mots PRONONCÉS (<scène>.mots.json, écrits
 * par etudiants-voix.mjs depuis les WordBoundary d'edge-tts).
 *
 * Écrans : captures RÉELLES du site (fenêtre mobile 390×844 @3x, thème clair),
 * produites par etudiants-captures.cjs. Une
 * « loupe » est un recadrage de la même capture, jamais un écran redessiné.
 *
 * Grammaire reprise d'un exemple de format tutoriel (fond clair, en-tête fixe,
 * titre à mot-clé, téléphone central, loupes, pastilles, sous-titres surlignés),
 * habillée aux couleurs du thème clair de westbourse.com.
 */

/** `largeur` ne dépasse jamais la largeur de la source (aucun agrandissement au-delà de sa résolution). */
type Loupe = { src: string; mot: string; largeur: number; y?: number; /** mot qui la retire */ jusqua?: string };
type Pastille = { mot: string; texte: string };
type Fin = { phrase: string; badge: string; adresse: string; note?: string };
type SceneE = {
  id: string;
  titre: [string, string];
  accent: string;
  voix: string;
  ecran?: string;
  /** Zone utile de la capture, en px CSS (largeur `w` depuis `x`), défilée du haut `de` au haut `a`. */
  cadre?: { x: number; w: number; de: number; a: number };
  loupe?: Loupe;
  /** Seconde loupe : remplace la première à son mot. */
  loupe2?: Loupe;
  pastilles?: Pastille[];
  mention?: string;
  fin?: Fin;
};
type Plan = { id: string; scenes: SceneE[] };
type Mot = { text: string; startMs: number; endMs: number };
type Props = { video: 'gratuit' | 'academy'; durees: Record<string, number> | null; mots: Record<string, Mot[]> | null };

const PLANS: Record<Props['video'], Plan> = {
  gratuit: GRATUIT as unknown as Plan,
  academy: ACADEMY as unknown as Plan,
};

const FPS = 30;
const RESPIRATION = 0.55; // silence après chaque phrase, en secondes
const FIN_TENUE = 1.6; // la carte finale reste lisible après la voix

/** Thème clair de westbourse.com (frontend/app/globals.css, :root[data-theme="light"]). */
const C = {
  fond: '#FAF8F4', surface: '#FFFFFF', creux: '#F3F0E8', bord: '#ECE6DA', bordFort: '#D9D0BD',
  encre: '#201C17', sourd: '#574E40', pale: '#6E6556',
  accent: '#09758F', accentFonce: '#076880', teal: '#16B6A4', tuile: '#0C1D2E', avert: '#8A5A10',
};

// Gabarit vertical (zones sûres : rien d'essentiel sous 1800 px).
/* Gabarit v3 (2026-11-19) : l'écran occupe la largeur utile. Zones sûres des
   formats verticaux : rien d'essentiel sous 1690 px (12 % du bas : sous-titres au-dessus) ; les
   sous-titres laissent libre la colonne de droite (boutons de l'application). */
const ECRAN_X = 40;
const ECRAN_L = 1080 - 2 * ECRAN_X; // 1000 px
const ECRAN_HAUT = 318;
const ECRAN_BAS = 1800; // le bas de l'écran passe sous les sous-titres ; rien d'essentiel n'y est cadré
const ECRAN_H = ECRAN_BAS - ECRAN_HAUT;
const DPR = 3; // captures à deviceScaleFactor 3
const SOURCE_L = 1170; // largeur des captures, en pixels source
const SOUS_TITRE_HAUT = 1508;

const longueur = (d: number, derniere: boolean) => Math.ceil((d + RESPIRATION + (derniere ? FIN_TENUE : 0)) * FPS);

export const calculerEtudiants: CalculateMetadataFunction<Props> = async ({ props }) => {
  const plan = PLANS[props.video];
  const base = `etudiants/${plan.id}/`;
  const durees = (await (await fetch(staticFile(`${base}durees.json`))).json()) as Record<string, number>;
  const mots: Record<string, Mot[]> = {};
  for (const s of plan.scenes) mots[s.id] = (await (await fetch(staticFile(`${base}${s.id}.mots.json`))).json()) as Mot[];
  const total = plan.scenes.reduce((a, s, i) => a + longueur(durees[s.id], i === plan.scenes.length - 1), 0);
  return { durationInFrames: total, props: { ...props, durees, mots } };
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const p01 = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: EASE });

/** Instant (images) où la voix PRONONCE le mot — lu dans les mots horodatés. */
function instantMot(mots: Mot[], mot: string): number {
  const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  const cle = n(mot);
  const m = mots.find((x) => n(x.text).startsWith(cle));
  return m ? Math.round((m.startMs / 1000) * FPS) : 0;
}

// ── Marque ──────────────────────────────────────────────────────────────────
/** Le logo officiel (frontend/public/icon.svg) : tuile marine, W blanc, flèche turquoise. */
function Tuile({ taille, prog = 1 }: { taille: number; prog?: number }) {
  const p1 = Math.min(1, prog * 1.6);
  const p2 = Math.max(0, Math.min(1, (prog - 0.5) * 3));
  const p3 = Math.max(0, Math.min(1, (prog - 0.75) * 4));
  return (
    <svg width={taille} height={taille} viewBox="0 0 512 512">
      <rect width="512" height="512" rx="96" fill={C.tuile} />
      <g transform="translate(76 146) scale(2.77)">
        <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke="#ffffff" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p1} />
        <path d="M76 82 L100 33" fill="none" stroke={C.teal} strokeWidth={12} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p2} />
        <polygon points="110,12 117,40 86,28" fill={C.teal} opacity={p3} />
      </g>
    </svg>
  );
}

function EnTete() {
  return (
    <>
      <div style={{ position: 'absolute', top: 40, left: ECRAN_X, right: ECRAN_X, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: SANS, fontSize: 34, fontWeight: 700, color: C.encre, letterSpacing: '-0.01em' }}>westbourse.com</span>
        <Tuile taille={62} />
      </div>
      <div style={{ position: 'absolute', top: 120, left: ECRAN_X, right: ECRAN_X, height: 2, background: C.bord }} />
    </>
  );
}

// ── Titre de scène : deux lignes compactes, un mot-clé en couleur d'accent ──
function Titre({ s }: { s: SceneE }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: 'absolute', top: 136, left: ECRAN_X, right: ECRAN_X, textAlign: 'center' }}>
      {s.titre.map((ligne, i) => {
        const p = spring({ frame: f - 2 - i * 4, fps, config: { damping: 16, stiffness: 140 } });
        const morceaux = ligne.includes(s.accent) ? ligne.split(s.accent) : [ligne];
        return (
          <div key={i} style={{ fontFamily: SANS, fontSize: 76, fontWeight: 800, lineHeight: 1.0, letterSpacing: '-0.03em', color: C.encre, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
            {morceaux.length === 2 ? (<>{morceaux[0]}<span style={{ color: C.accent }}>{s.accent}</span>{morceaux[1]}</>) : ligne}
          </div>
        );
      })}
    </div>
  );
}

// ── Écran : la zone utile d'une vraie capture, en grand, qui défile lentement ──
function Ecran({ s, assombri }: { s: SceneE; assombri: number }) {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const p = spring({ frame: f, fps, config: { damping: 18, stiffness: 90 } });
  const c = s.cadre ?? { x: 14, w: 362, de: 0, a: 0 };
  // Échelle : px de la vidéo par px SOURCE. Jamais au-delà de 1 (pas d'agrandissement flou).
  const echelle = Math.min(1, ECRAN_L / (c.w * DPR));
  const y = interpolate(f, [10, Math.max(11, durationInFrames - 24)], [c.de, c.a], { ...clamp, easing: EASE }) * DPR * echelle;
  return (
    <div style={{
      position: 'absolute', top: ECRAN_HAUT, left: ECRAN_X, width: ECRAN_L, height: ECRAN_H,
      borderRadius: 40, overflow: 'hidden', background: C.fond, border: `2px solid ${C.bordFort}`,
      boxShadow: '0 30px 70px rgba(32,28,23,.20), 0 4px 14px rgba(32,28,23,.10)',
      opacity: Math.min(1, p * 1.3), transform: `translateY(${(1 - p) * 80}px)`,
    }}>
      <Img src={staticFile(`etudiants/ecrans/${s.ecran}.png`)} style={{
        position: 'absolute', top: 0, left: -c.x * DPR * echelle, width: SOURCE_L * echelle,
        transform: `translateY(${-y}px)`,
      }} />
      <AbsoluteFill style={{ background: 'rgba(20,17,13,.55)', opacity: assombri }} />
      {s.mention && <Mention texte={s.mention} />}
    </div>
  );
}

/** « Simulation : aucun argent réel » — en haut de l'écran, toujours visible. */
function Mention({ texte }: { texte: string }) {
  const f = useCurrentFrame();
  const p = p01(f, 14, 26);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 22, display: 'flex', justifyContent: 'center', opacity: p }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 28px', borderRadius: 999, background: '#FFF7E8', border: `3px solid ${C.avert}`, fontFamily: SANS, fontSize: 34, fontWeight: 800, color: C.avert, boxShadow: '0 10px 30px rgba(32,28,23,.22)' }}>
        <span style={{ width: 16, height: 16, borderRadius: 8, background: C.avert }} />
        {texte}
      </div>
    </div>
  );
}

// ── Loupe : un morceau de capture, sorti devant l'écran assombri ─────────────
function LoupeVue({ l, debut, fin = Infinity }: { l: Loupe; debut: number; fin?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < debut || f >= fin) return null;
  const p = spring({ frame: f - debut, fps, config: { damping: 15, stiffness: 150 } });
  const largeur = Math.min(l.largeur, 1000);
  return (
    <div style={{
      position: 'absolute', left: (1080 - largeur) / 2, width: largeur, top: l.y ?? 520,
      borderRadius: 28, overflow: 'hidden', background: C.surface, border: `4px solid ${C.accent}`,
      boxShadow: '0 40px 90px rgba(0,0,0,.45), 0 0 0 10px rgba(255,255,255,.85)',
      opacity: Math.min(1, p * 1.4), transform: `scale(${0.86 + 0.14 * p}) translateY(${(1 - p) * 50}px)`,
    }}>
      <Img src={staticFile(`etudiants/ecrans/${l.src}.png`)} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}

/** Assombrissement de l'écran pendant qu'une loupe est posée : [début, fin] en images. */
function assombrissement(f: number, plages: [number, number][]): number {
  return Math.max(0, ...plages.map(([a, b]) => Math.min(p01(f, a, a + 8), 1 - p01(f, b - 6, b))));
}

function PastilleVue({ texte, debut, i }: { texte: string; debut: number; i: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < debut) return null;
  const p = spring({ frame: f - debut, fps, config: { damping: 14, stiffness: 160 } });
  return (
    <div style={{ position: 'absolute', top: ECRAN_HAUT + 110 + i * 104, left: ECRAN_X + 24, opacity: p, transform: `translateX(${(1 - p) * -50}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 30px', borderRadius: 999, background: C.surface, border: `3px solid ${C.accent}`, boxShadow: '0 14px 36px rgba(32,28,23,.28)', fontFamily: SANS, fontSize: 38, fontWeight: 800, color: C.encre }}>
        <span style={{ width: 20, height: 20, borderRadius: 10, background: C.accent }} />
        {texte}
      </div>
    </div>
  );
}

// ── Sous-titres mot à mot ───────────────────────────────────────────────────
/** Pages de 2 lignes au plus : coupure après une ponctuation forte ou vers 26
 *  signes ; un mot resté seul rejoint la page d'avant si elle le permet. */
function paginer(mots: Mot[]): Mot[][] {
  const pages: Mot[][] = [];
  let page: Mot[] = [];
  const longueurPage = (p: Mot[]) => p.reduce((a, m) => a + m.text.length + 1, 0);
  for (const m of mots) {
    if (page.length && longueurPage(page) + m.text.length > 26) { pages.push(page); page = []; }
    page.push(m);
    if (/[.?!:]$/.test(m.text)) { pages.push(page); page = []; }
  }
  if (page.length) pages.push(page);
  for (let i = pages.length - 1; i > 0; i--) {
    if (pages[i].length === 1 && longueurPage(pages[i - 1]) + pages[i][0].text.length <= 38) {
      pages[i - 1] = [...pages[i - 1], ...pages[i]];
      pages.splice(i, 1);
    }
  }
  return pages;
}

function SousTitres({ mots }: { mots: Mot[] }) {
  const f = useCurrentFrame();
  const ms = (f / FPS) * 1000;
  const pages = paginer(mots);
  const page = pages.find((p, i) => ms >= (i === 0 ? 0 : p[0].startMs) && (i === pages.length - 1 || ms < pages[i + 1][0].startMs));
  if (!page || ms > page[page.length - 1].endMs + 700) return null;
  const debutPage = Math.round((page[0].startMs / 1000) * FPS);
  const p = p01(f, debutPage - 3, debutPage + 3);
  return (
    <div style={{ position: 'absolute', top: SOUS_TITRE_HAUT, left: ECRAN_X + 16, right: 150, display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 860, padding: '14px 26px', borderRadius: 22, background: C.surface, border: `2px solid ${C.bordFort}`, boxShadow: '0 14px 40px rgba(20,17,13,.35)', textAlign: 'center', fontFamily: SANS, fontSize: 54, fontWeight: 800, lineHeight: 1.3, color: C.encre, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
        {page.map((m, i) => {
          const actif = ms >= m.startMs && (i === page.length - 1 ? ms <= m.endMs + 250 : ms < page[i + 1].startMs);
          return (
            <React.Fragment key={i}>
              <span style={{ padding: '0 6px', margin: '0 -2px', borderRadius: 10, background: actif ? C.accent : 'transparent', color: actif ? '#FFFFFF' : C.encre }}>{m.text}</span>{' '}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Carte finale ────────────────────────────────────────────────────────────
function CarteFin({ s }: { s: SceneE }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fin = s.fin!;
  const entre = (d: number) => {
    const p = spring({ frame: f - d, fps, config: { damping: 16, stiffness: 130 } });
    return { opacity: p, transform: `translateY(${(1 - p) * 34}px)` };
  };
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '200px 80px 380px', gap: 40, textAlign: 'center' }}>
      <div style={{ transform: `scale(${interpolate(f, [0, 24], [0.7, 1], { ...clamp, easing: EASE })})` }}><Tuile taille={250} prog={p01(f, 0, 34)} /></div>
      <div style={{ ...entre(8), fontFamily: SANS, fontSize: 64, fontWeight: 800, letterSpacing: '0.18em', color: C.encre }}>WESTBOURSE</div>
      <div style={{ ...entre(14), fontFamily: SANS, fontSize: 52, fontWeight: 700, lineHeight: 1.2, color: C.encre, maxWidth: 860 }}>{fin.phrase}</div>
      <div style={{ ...entre(20), padding: '16px 44px', borderRadius: 999, background: C.accent, color: '#FFFFFF', fontFamily: SANS, fontSize: 46, fontWeight: 800 }}>{fin.badge}</div>
      <div style={{ ...entre(26), fontFamily: SANS, fontSize: 50, fontWeight: 800, color: C.accent }}>{fin.adresse}</div>
      <div style={{ ...entre(32), fontFamily: SANS, fontSize: 30, lineHeight: 1.4, color: C.sourd, maxWidth: 880 }}>
        Investir comporte des risques.{fin.note ? <><br />{fin.note}</> : null}
      </div>
    </AbsoluteFill>
  );
}

/** Fondu enchaîné court entre deux scènes. */
function Cadre({ longueur, children }: { longueur: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const o = Math.min(p01(f, 0, 8), 1 - p01(f, longueur - 7, longueur));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

/** Fin de la première loupe : au mot de la seconde, ou à son mot `jusqua`. */
function finLoupe(s: SceneE, m: Mot[], defaut: number): number {
  if (s.loupe2) return instantMot(m, s.loupe2.mot);
  if (s.loupe?.jusqua) return instantMot(m, s.loupe.jusqua);
  return defaut;
}

/** Écran d'une scène, assombri pendant ses loupes. */
function EcranScene({ s, m }: { s: SceneE; m: Mot[] }) {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const plages: [number, number][] = [];
  if (s.loupe) plages.push([instantMot(m, s.loupe.mot), finLoupe(s, m, durationInFrames)]);
  if (s.loupe2) plages.push([instantMot(m, s.loupe2.mot), durationInFrames]);
  return <Ecran s={s} assombri={assombrissement(f, plages)} />;
}

// ── Montage ─────────────────────────────────────────────────────────────────
export default function Etudiants({ video, durees, mots }: Props) {
  const plan = PLANS[video];
  if (!durees || !mots) return <AbsoluteFill style={{ background: C.fond }} />;
  let debut = 0;
  return (
    <AbsoluteFill style={{ background: C.fond, fontFamily: SANS }}>
      {plan.scenes.map((s, idx) => {
        const derniere = idx === plan.scenes.length - 1;
        const lg = longueur(durees[s.id], derniere);
        const from = debut;
        debut += lg;
        const m = mots[s.id];
        return (
          <Sequence key={s.id} from={from} durationInFrames={lg} name={s.id}>
            <Audio src={staticFile(`etudiants/${plan.id}/${s.id}.mp3`)} />
            {[s.loupe, s.loupe2].filter((l): l is Loupe => !!l).map((l) => (
              <Sequence key={l.src} from={instantMot(m, l.mot)} layout="none">
                <Audio src={staticFile('sfx/souffle.wav')} volume={0.18} />
              </Sequence>
            ))}
            <Cadre longueur={lg}>
              {s.fin ? (
                <CarteFin s={s} />
              ) : (
                <>
                  <Titre s={s} />
                  {s.ecran && <EcranScene s={s} m={m} />}
                  {(s.pastilles ?? []).map((pa, i) => <PastilleVue key={i} i={i} texte={pa.texte} debut={instantMot(m, pa.mot)} />)}
                  {s.loupe && <LoupeVue l={s.loupe} debut={instantMot(m, s.loupe.mot)} fin={finLoupe(s, m, Infinity)} />}
                  {s.loupe2 && <LoupeVue l={s.loupe2} debut={instantMot(m, s.loupe2.mot)} />}
                </>
              )}
              <SousTitres mots={m} />
            </Cadre>
          </Sequence>
        );
      })}
      <EnTete />
    </AbsoluteFill>
  );
}
