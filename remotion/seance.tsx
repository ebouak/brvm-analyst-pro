import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from 'remotion';
import { MONO, SANS, SERIF } from './polices';

/**
 * Vidéo de séance, version animée — 1080×1920, 30 i/s.
 *
 * UNE SEULE LECTURE. Aucune donnée n'est lue ici : tout vient de
 * public/seance/seance.json, écrit par video/genere.mjs en même temps que la
 * voix (voix.mp3) et à partir des mêmes variables. Un chiffre change partout
 * à la fois, ou nulle part (voir video/README.md).
 *
 * AUCUN CHIFFRE NE DÉFILE. Un compteur qui part de zéro affiche, le temps de
 * monter, des valeurs que la séance n'a jamais eues. Les nombres apparaissent
 * directement à leur valeur finale ; seules les barres et les arcs — des
 * proportions — se remplissent.
 *
 * Mêmes sept scènes, même découpage (PARTS × durée réelle de la voix) que le
 * montage d'origine : les images suivent le propos au lieu de le devancer.
 * Pas de sous-titres (décision de 2026-09-03, à rouvrir selon l'audience).
 */

// ── Données (forme de seance.json) ──────────────────────────────────────────
interface Mouvement { code: string; variation_pct: number }
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
  plus_forte_hausse: Mouvement;
  plus_forte_baisse: Mouvement;
  historique_indice: { date: string; valeur: number }[];
  duree_s: number;
  publiable: boolean;
  video: { parts: number[]; part_baissiere_pct: number; frise: string[]; noms: Record<string, string> };
  logos: Record<string, string>;
}

export const FPS = 30;
const QUEUE = 45; // la carte finale reste 1,5 s après la dernière phrase

export const calculerSeance: CalculateMetadataFunction<{ fiche: Fiche | null }> = async () => {
  const r = await fetch(staticFile('seance/seance.json'));
  const fiche = (await r.json()) as Fiche;
  return { durationInFrames: Math.ceil(fiche.duree_s * FPS) + QUEUE, props: { fiche } };
};

// ── Charte (jetons du site, thème sombre) ──────────────────────────────────
const C = {
  fond: '#030303', surface: '#0a1417', bord: 'rgba(255,255,255,.1)',
  blanc: '#FCFCFC', gris: '#A9BFC5', sourd: '#7A8A90',
  cyan: '#56D7FD', vert: '#3fe18b', rouge: '#ff6b6b', neutre: '#5b6f75', teal: '#16B6A4',
};

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const t = (f: number, a: number, b: number, de = 0, a2 = 1) =>
  interpolate(f, [a, b], [de, a2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });
const fr = (x: number, d = 2) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sg = (x: number, d = 2) => `${x >= 0 ? '+' : '−'}${fr(Math.abs(x), d)}`;
const ton = (x: number) => (x > 0 ? C.vert : x < 0 ? C.rouge : C.gris);

// ── Éléments ────────────────────────────────────────────────────────────────
function Logo({ taille, prog = 1 }: { taille: number; prog?: number }) {
  const p1 = Math.min(1, prog * 1.6), p2 = Math.max(0, Math.min(1, (prog - 0.5) * 3)), p3 = Math.max(0, Math.min(1, (prog - 0.75) * 4));
  return (
    <svg width={taille} height={taille * 0.78} viewBox="6 4 122 90" style={{ overflow: 'visible' }}>
      <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke={C.blanc} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p1} />
      <path d="M76 82 L100 33" fill="none" stroke={C.teal} strokeWidth={12} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p2} />
      <polygon points="110,12 117,40 86,28" fill={C.teal} opacity={p3} />
    </svg>
  );
}

/** Logo d'une société, sur fond blanc (image de marque, jamais teintée), ou son code. */
function Vignette({ fiche, code, taille }: { fiche: Fiche; code: string; taille: number }) {
  const src = fiche.logos[code];
  if (src) {
    return <Img src={staticFile(src)} style={{ width: taille, height: taille, objectFit: 'contain', background: '#fff', padding: taille * 0.09, borderRadius: taille * 0.12, flex: '0 0 auto' }} />;
  }
  return (
    <div style={{ width: taille, height: taille, borderRadius: taille * 0.12, background: C.surface, border: `1px solid ${C.bord}`, color: C.gris, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: taille * 0.24, flex: '0 0 auto' }}>
      {code}
    </div>
  );
}

function Fond() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 110% 60% at 50% 30%, #0b2230 0%, ${C.fond} 62%)` }}>
      <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(to right, rgba(255,255,255,.035) 0 1px, transparent 1px 120px)', backgroundPosition: `${-f * 0.4}px 0` }} />
    </AbsoluteFill>
  );
}

function Marque() {
  return (
    <div style={{ position: 'absolute', top: 96, left: 80, display: 'flex', alignItems: 'center', gap: 20 }}>
      <Logo taille={70} />
      <span style={{ fontFamily: MONO, fontSize: 30, letterSpacing: '.34em', fontWeight: 600, color: C.blanc }}>WESTBOURSE</span>
    </div>
  );
}

function Pied({ texte }: { texte: string }) {
  return (
    <div style={{ position: 'absolute', bottom: 120, left: 80, right: 80, fontFamily: MONO, fontSize: 24, letterSpacing: '.12em', color: C.sourd, borderTop: `1px solid ${C.bord}`, paddingTop: 26 }}>
      {texte}
    </div>
  );
}

function Etiquette({ texte }: { texte: string }) {
  return <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: '.26em', textTransform: 'uppercase', color: C.cyan, marginBottom: 34 }}>{texte}</div>;
}

/** Apparition : montée + netteté, jamais depuis l'invisible absolu au-delà de 18 images. */
function Entre({ debut, children, dy = 40, style }: { debut: number; children: React.ReactNode; dy?: number; style?: React.CSSProperties }) {
  const f = useCurrentFrame();
  const p = t(f, debut, debut + 18);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * dy}px)`, filter: `blur(${(1 - p) * 8}px)`, ...style }}>{children}</div>;
}

/** Enveloppe de scène : fondu d'entrée et de sortie de 8 images. */
function Scene({ duree, children }: { duree: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const o = Math.min(t(f, 0, 8), t(f, duree - 8, duree, 1, 0));
  return <AbsoluteFill style={{ opacity: o, padding: '110px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', color: C.blanc, fontFamily: SANS }}>{children}</AbsoluteFill>;
}

// ── Scènes ──────────────────────────────────────────────────────────────────
function S0Titre({ fiche, duree }: { fiche: Fiche; duree: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Scene duree={duree}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Logo taille={200} prog={t(f, 0, 30)} />
        <Entre debut={14}><div style={{ fontFamily: MONO, fontSize: 54, letterSpacing: '.36em', marginTop: 40 }}>WESTBOURSE</div></Entre>
        <Entre debut={22}><div style={{ fontFamily: SERIF, fontSize: 62, fontWeight: 600, marginTop: 38 }}>Séance BRVM</div></Entre>
        <Entre debut={28}><div style={{ fontSize: 44, color: C.gris, marginTop: 14 }}>du {fiche.date_fr}</div></Entre>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 920, marginTop: 70 }}>
          {fiche.video.frise.map((code, i) => {
            const s = spring({ frame: f - 34 - i * 4, fps, config: { damping: 14, stiffness: 140 } });
            return <div key={code} style={{ transform: `scale(${0.6 + s * 0.4})`, opacity: s }}><Vignette fiche={fiche} code={code} taille={96} /></div>;
          })}
        </div>
        <Entre debut={60}><div style={{ fontFamily: MONO, fontSize: 22, color: C.sourd, marginTop: 26, letterSpacing: '.12em' }}>les huit plus gros échanges de la séance</div></Entre>
      </div>
    </Scene>
  );
}

function S1Composite({ fiche, duree }: { fiche: Fiche; duree: number }) {
  const f = useCurrentFrame();
  const c = fiche.composite;
  const h = fiche.historique_indice;
  // Courbe des 20 dernières séances RÉELLES (pas d'intraday : l'indice n'en a pas).
  const courbe = h.length >= 5 ? (() => {
    const W = 920, H = 260, min = Math.min(...h.map((p) => p.valeur)), max = Math.max(...h.map((p) => p.valeur));
    const pts = h.map((p, i) => [(i / (h.length - 1)) * W, H - ((p.valeur - min) / (max - min || 1)) * H * 0.85 - H * 0.075]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const prog = t(f, 20, 70);
    const dernier = pts[pts.length - 1];
    const col = c && c.variation_pct >= 0 ? C.vert : C.rouge;
    return (
      <svg width={W} height={H} style={{ overflow: 'visible', marginTop: 60 }}>
        <path d={`${d} L${W} ${H} L0 ${H} Z`} fill={col} opacity={0.08 * prog} />
        <path d={d} fill="none" stroke={col} strokeWidth={4} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog} style={{ filter: `drop-shadow(0 0 10px ${col})` }} />
        <circle cx={dernier[0]} cy={dernier[1]} r={9 * t(f, 66, 76)} fill={C.blanc} stroke={col} strokeWidth={4} />
      </svg>
    );
  })() : null;
  return (
    <>
      <Marque />
      <Scene duree={duree}>
        <Entre debut={0}><Etiquette texte="BRVM Composite" /></Entre>
        <Entre debut={4} dy={60}>
          <div style={{ fontFamily: MONO, fontSize: 200, lineHeight: 0.9, letterSpacing: '-.04em', color: c ? ton(c.variation_pct) : C.gris }}>
            {c ? sg(c.variation_pct) : '—'}<span style={{ fontSize: '.4em' }}> %</span>
          </div>
        </Entre>
        <Entre debut={12}><div style={{ fontFamily: MONO, fontSize: 104, marginTop: 36, color: '#D6E2E5' }}>{c ? fr(c.valeur) : '—'}</div></Entre>
        <Entre debut={16}><div style={{ fontSize: 40, color: C.gris, marginTop: 20 }}>points à la clôture</div></Entre>
        {courbe}
        {courbe && <Entre debut={40}><div style={{ fontFamily: MONO, fontSize: 22, color: C.sourd, marginTop: 14, letterSpacing: '.1em' }}>{h.length} dernières séances</div></Entre>}
      </Scene>
      <Pied texte="Source · séance officielle BRVM" />
    </>
  );
}

function S2Largeur({ fiche, duree }: { fiche: Fiche; duree: number }) {
  const f = useCurrentFrame();
  const n = fiche.valeurs || 1;
  const segs = [
    { v: fiche.baisses, c: C.rouge, txt: C.fond },
    { v: fiche.stables, c: C.neutre, txt: C.blanc },
    { v: fiche.hausses, c: C.vert, txt: C.fond },
  ];
  const prog = t(f, 10, 44);
  return (
    <>
      <Marque />
      <Scene duree={duree}>
        <Entre debut={0}><Etiquette texte="Largeur du marché" /></Entre>
        <div style={{ display: 'flex', height: 110, width: '100%', margin: '40px 0 30px', borderRadius: 14, overflow: 'hidden', background: C.surface }}>
          {segs.map((s, i) => (
            <div key={i} style={{ width: `${(s.v / n) * 100 * prog}%`, background: s.c, color: s.txt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 42, fontWeight: 700, overflow: 'hidden' }}>
              <span style={{ opacity: t(f, 40, 52) }}>{s.v}</span>
            </div>
          ))}
        </div>
        <Entre debut={46}>
          <div style={{ fontSize: 44, lineHeight: 1.5 }}>
            <b style={{ color: C.vert }}>{fiche.hausses} hausses</b> · <b style={{ color: C.rouge }}>{fiche.baisses} baisses</b> · {fiche.stables} stables
          </div>
        </Entre>
        <Entre debut={52}><div style={{ fontSize: 38, color: C.gris }}>sur {fiche.valeurs} valeurs cotées</div></Entre>
      </Scene>
      <Pied texte={`${fiche.valeurs} valeurs · séance officielle`} />
    </>
  );
}

function S3Capitaux({ fiche, duree }: { fiche: Fiche; duree: number }) {
  const f = useCurrentFrame();
  const pb = fiche.video.part_baissiere_pct;
  const prog = t(f, 30, 60);
  return (
    <>
      <Marque />
      <Scene duree={duree}>
        <Entre debut={0}><Etiquette texte={`Capitaux échangés${fiche.capitaux_estimes ? ' (estimés)' : ''}`} /></Entre>
        <Entre debut={4} dy={60}>
          <div style={{ fontFamily: MONO, fontSize: 200, lineHeight: 0.9, letterSpacing: '-.04em' }}>
            {fiche.capitaux_estimes ? '≈ ' : ''}{fr(fiche.capitaux_fcfa / 1e9)}<span style={{ fontSize: '.32em' }}> Md</span>
          </div>
        </Entre>
        <Entre debut={12}><div style={{ fontSize: 40, color: C.gris, marginTop: 24 }}>francs CFA ont changé de mains</div></Entre>
        <div style={{ display: 'flex', height: 70, width: '100%', marginTop: 70, borderRadius: 12, overflow: 'hidden', background: C.surface }}>
          <div style={{ width: `${pb * prog}%`, background: C.rouge }} />
          <div style={{ width: `${(100 - pb) * prog}%`, background: C.vert }} />
        </div>
        <Entre debut={58}>
          <div style={{ fontSize: 38, color: C.gris, marginTop: 30, lineHeight: 1.4 }}>
            <b style={{ color: C.rouge }}>{fr(pb, 1)} %</b> des capitaux se sont traités sur des titres en repli.
          </div>
        </Entre>
      </Scene>
      <Pied texte={fiche.capitaux_estimes ? 'Estimé : cours × titres — valeur officielle non publiée' : 'Part baissière de la valeur échangée'} />
    </>
  );
}

function S4Lourde({ fiche, duree }: { fiche: Fiche; duree: number }) {
  const f = useCurrentFrame();
  const l = fiche.ligne_lourde;
  const R = 150, circ = 2 * Math.PI * R;
  const prog = t(f, 18, 60);
  return (
    <>
      <Marque />
      <Scene duree={duree}>
        <Entre debut={0}><Etiquette texte="La ligne qui fait la séance" /></Entre>
        <Entre debut={4}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
            <Vignette fiche={fiche} code={l.code} taille={140} />
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 62, fontWeight: 600, lineHeight: 1.05 }}>{fiche.video.noms[l.code] ?? l.code}</div>
              <div style={{ fontFamily: MONO, fontSize: 30, color: C.gris, marginTop: 10 }}>{l.code}</div>
            </div>
          </div>
        </Entre>
        <div style={{ display: 'flex', alignItems: 'center', gap: 50, marginTop: 70 }}>
          <svg width={2 * R + 40} height={2 * R + 40} style={{ transform: 'rotate(-90deg)', flex: '0 0 auto' }}>
            <circle cx={R + 20} cy={R + 20} r={R} fill="none" stroke={C.surface} strokeWidth={34} />
            <circle cx={R + 20} cy={R + 20} r={R} fill="none" stroke={C.cyan} strokeWidth={34} strokeLinecap="round" strokeDasharray={`${(l.part_pct / 100) * circ * prog} ${circ}`} style={{ filter: `drop-shadow(0 0 12px ${C.cyan})` }} />
          </svg>
          <div>
            <Entre debut={40}><div style={{ fontFamily: MONO, fontSize: 120, color: C.cyan, lineHeight: 0.9 }}>{fr(l.part_pct, 1)}<span style={{ fontSize: '.4em' }}> %</span></div></Entre>
            <Entre debut={46}><div style={{ fontSize: 34, color: C.gris, marginTop: 16 }}>du montant total échangé, à elle seule</div></Entre>
          </div>
        </div>
        <Entre debut={56}>
          <div style={{ fontSize: 44, marginTop: 50 }}>
            et {l.variation_pct >= 0 ? 'gagne' : 'cède'} <b style={{ color: ton(l.variation_pct), fontFamily: MONO }}>{sg(l.variation_pct)} %</b>
          </div>
        </Entre>
      </Scene>
      <Pied texte={l.code} />
    </>
  );
}

function Ligne({ fiche, m, debut }: { fiche: Fiche; m: Mouvement; debut: number }) {
  const f = useCurrentFrame();
  const p = t(f, debut, debut + 20);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 26, padding: '34px 0', borderBottom: `1px solid ${C.bord}`, opacity: p, transform: `translateX(${(1 - p) * -80}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26, minWidth: 0 }}>
        <Vignette fiche={fiche} code={m.code} taille={100} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 52 }}>{m.code}</div>
          <div style={{ fontSize: 26, color: C.gris, marginTop: 6, maxWidth: 480 }}>{fiche.video.noms[m.code] ?? ''}</div>
        </div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 64, fontWeight: 600, color: ton(m.variation_pct), whiteSpace: 'nowrap' }}>{sg(m.variation_pct)} %</div>
    </div>
  );
}

function S5Extremes({ fiche, duree }: { fiche: Fiche; duree: number }) {
  return (
    <>
      <Marque />
      <Scene duree={duree}>
        <Entre debut={0}><Etiquette texte="Extrêmes de la séance" /></Entre>
        <Ligne fiche={fiche} m={fiche.plus_forte_hausse} debut={6} />
        <Ligne fiche={fiche} m={fiche.plus_forte_baisse} debut={Math.round(duree * 0.45)} />
        <Entre debut={Math.round(duree * 0.5)}><div style={{ fontSize: 32, color: C.gris, marginTop: 44 }}>Plus forte hausse et plus forte baisse parmi les {fiche.valeurs} valeurs cotées.</div></Entre>
      </Scene>
      <Pied texte={`Séance du ${fiche.date_fr}`} />
    </>
  );
}

function S6Fin({ fiche, duree }: { fiche: Fiche; duree: number }) {
  const f = useCurrentFrame();
  return (
    <Scene duree={duree + 8}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Logo taille={170} prog={t(f, 0, 28)} />
        <Entre debut={10}><div style={{ fontFamily: MONO, fontSize: 52, letterSpacing: '.36em', marginTop: 40 }}>WESTBOURSE</div></Entre>
        <Entre debut={18}><div style={{ fontSize: 42, color: C.gris, marginTop: 36 }}>L’analyse complète de la séance</div></Entre>
        <Entre debut={24}><div style={{ fontFamily: MONO, fontSize: 50, color: C.cyan, marginTop: 22 }}>westbourse.com</div></Entre>
        <Entre debut={34}>
          <div style={{ fontSize: 25, color: C.sourd, marginTop: 70, maxWidth: 800, lineHeight: 1.5 }}>
            Tous les chiffres proviennent de la séance officielle de la BRVM.<br />
            {fiche.capitaux_estimes ? 'Les capitaux sont estimés par cours × titres, la valeur officielle n’étant pas publiée.' : 'Aucune valeur n’est estimée.'}
          </div>
        </Entre>
      </div>
    </Scene>
  );
}

const SCENES = [S0Titre, S1Composite, S2Largeur, S3Capitaux, S4Lourde, S5Extremes, S6Fin];

export default function Seance({ fiche }: { fiche: Fiche | null }) {
  const { durationInFrames } = useVideoConfig();
  if (!fiche) return <AbsoluteFill style={{ background: C.fond }} />;
  const total = fiche.duree_s * FPS;
  const somme = fiche.video.parts.reduce((a, b) => a + b, 0);
  let debut = 0;
  const plans = SCENES.map((Comp, i) => {
    const d0 = Math.round(debut);
    debut += (fiche.video.parts[i] / somme) * total;
    const fin = i === SCENES.length - 1 ? durationInFrames : Math.round(debut);
    return { Comp, d0, duree: fin - d0 };
  });
  return (
    <AbsoluteFill style={{ background: C.fond }}>
      <Fond />
      <Audio src={staticFile('seance/voix.mp3')} />
      {plans.map(({ Comp, d0, duree }, i) => (
        <Sequence key={i} from={d0} durationInFrames={duree}>
          <Comp fiche={fiche} duree={duree} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
