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

type Loupe = { src: string; mot: string; largeur?: number; y?: number };
type Pastille = { mot: string; texte: string };
type Fin = { phrase: string; badge: string; adresse: string; note?: string };
type SceneE = {
  id: string;
  titre: [string, string];
  accent: string;
  voix: string;
  ecran?: string;
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
const ECRAN_L = 498; // largeur de l'écran du téléphone
const ECRAN_H = Math.round((ECRAN_L * 844) / 390);
const BORD_TEL = 14;
const TEL_HAUT = 452;
const SOUS_TITRE_Y = 1588;

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
      <div style={{ position: 'absolute', top: 66, left: 64, right: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: SANS, fontSize: 40, fontWeight: 700, color: C.encre, letterSpacing: '-0.01em' }}>westbourse.com</span>
        <Tuile taille={78} />
      </div>
      <div style={{ position: 'absolute', top: 172, left: 64, right: 64, height: 2, background: C.bord }} />
    </>
  );
}

// ── Titre de scène : deux lignes, un mot-clé en couleur d'accent ────────────
function Titre({ s }: { s: SceneE }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: 'absolute', top: 206, left: 50, right: 50, textAlign: 'center' }}>
      {s.titre.map((ligne, i) => {
        const p = spring({ frame: f - 2 - i * 4, fps, config: { damping: 16, stiffness: 140 } });
        const morceaux = ligne.includes(s.accent) ? ligne.split(s.accent) : [ligne];
        return (
          <div key={i} style={{ fontFamily: SANS, fontSize: 94, fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.03em', color: C.encre, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
            {morceaux.length === 2 ? (<>{morceaux[0]}<span style={{ color: C.accent }}>{s.accent}</span>{morceaux[1]}</>) : ligne}
          </div>
        );
      })}
    </div>
  );
}

// ── Téléphone : cadre + vraie capture qui défile ────────────────────────────
function Telephone({ s }: { s: SceneE }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f, fps, config: { damping: 18, stiffness: 90 } });
  // Lente poussée sur l'écran : du mouvement sans rien redessiner.
  const zoom = interpolate(f, [0, 8 * fps], [1, 1.035], clamp);
  const largeur = ECRAN_L + 2 * BORD_TEL;
  return (
    <div style={{
      position: 'absolute', top: TEL_HAUT, left: (1080 - largeur) / 2, width: largeur, height: ECRAN_H + 2 * BORD_TEL,
      borderRadius: 74, background: '#16130F', padding: BORD_TEL,
      boxShadow: '0 40px 90px rgba(32,28,23,.22), 0 6px 18px rgba(32,28,23,.12)',
      opacity: Math.min(1, p * 1.3), transform: `translateY(${(1 - p) * 120}px)`,
    }}>
      <div style={{ position: 'relative', width: ECRAN_L, height: ECRAN_H, borderRadius: 60, overflow: 'hidden', background: C.fond }}>
        <Img src={staticFile(`etudiants/ecrans/${s.ecran}.png`)} style={{ position: 'absolute', top: 0, left: 0, width: ECRAN_L, height: ECRAN_H, transform: `scale(${zoom})`, transformOrigin: '50% 30%' }} />
      </div>
      {s.mention && <Mention texte={s.mention} />}
    </div>
  );
}

/** « Simulation : aucun argent réel » — posée sur le bas du téléphone, toujours visible. */
function Mention({ texte }: { texte: string }) {
  const f = useCurrentFrame();
  const p = p01(f, 14, 26);
  return (
    <div style={{ position: 'absolute', left: -40, right: -40, bottom: 34, display: 'flex', justifyContent: 'center', opacity: p }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 26px', borderRadius: 999, background: '#FFF7E8', border: `2px solid ${C.avert}`, fontFamily: SANS, fontSize: 31, fontWeight: 700, color: C.avert, boxShadow: '0 10px 30px rgba(32,28,23,.16)' }}>
        <span style={{ width: 16, height: 16, borderRadius: 8, background: C.avert }} />
        {texte}
      </div>
    </div>
  );
}

// ── Loupe : un morceau de la capture, sorti en grand devant le téléphone ────
function LoupeVue({ l, debut, fin = Infinity }: { l: Loupe; debut: number; fin?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < debut || f >= fin) return null;
  const p = spring({ frame: f - debut, fps, config: { damping: 15, stiffness: 150 } });
  const largeur = l.largeur ?? 860;
  return (
    <div style={{
      position: 'absolute', left: (1080 - largeur) / 2, width: largeur, top: l.y ?? 760,
      borderRadius: 30, overflow: 'hidden', background: C.surface, border: `2px solid ${C.bord}`,
      boxShadow: '0 34px 80px rgba(32,28,23,.28), 0 4px 14px rgba(32,28,23,.12)',
      opacity: Math.min(1, p * 1.4), transform: `scale(${0.82 + 0.18 * p}) translateY(${(1 - p) * 60}px)`,
    }}>
      <Img src={staticFile(`etudiants/ecrans/${l.src}.png`)} style={{ display: 'block', width: '100%' }} />
    </div>
  );
}

function PastilleVue({ texte, debut, i }: { texte: string; debut: number; i: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < debut) return null;
  const p = spring({ frame: f - debut, fps, config: { damping: 14, stiffness: 160 } });
  const gauche = i % 2 === 0;
  return (
    <div style={{ position: 'absolute', top: 640 + i * 118, ...(gauche ? { left: 54 } : { right: 54 }), opacity: p, transform: `translateX(${(1 - p) * (gauche ? -50 : 50)}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 30px', borderRadius: 999, background: C.surface, border: `2px solid ${C.bord}`, boxShadow: '0 14px 36px rgba(32,28,23,.18)', fontFamily: SANS, fontSize: 36, fontWeight: 700, color: C.encre }}>
        <span style={{ width: 22, height: 22, borderRadius: 11, border: `6px solid ${C.accent}`, background: C.surface }} />
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
    <div style={{ position: 'absolute', top: SOUS_TITRE_Y, left: 70, right: 70, display: 'flex', justifyContent: 'center' }}>
      <div style={{ maxWidth: 900, padding: '14px 26px', borderRadius: 22, background: C.surface, boxShadow: '0 12px 34px rgba(32,28,23,.14)', textAlign: 'center', fontFamily: SANS, fontSize: 54, fontWeight: 800, lineHeight: 1.3, color: C.encre, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
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
                  {s.ecran && <Telephone s={s} />}
                  {(s.pastilles ?? []).map((pa, i) => <PastilleVue key={i} i={i} texte={pa.texte} debut={instantMot(m, pa.mot)} />)}
                  {s.loupe && <LoupeVue l={s.loupe} debut={instantMot(m, s.loupe.mot)} fin={s.loupe2 ? instantMot(m, s.loupe2.mot) : Infinity} />}
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
