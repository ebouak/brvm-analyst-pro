import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import PLAN from './showreel-plan.json';

/**
 * Showreel WestBourse — 1920×1080, 30 i/s, avec voix off.
 *
 * LES INTERFACES SONT DE VRAIES CAPTURES de westbourse.com (pages publiques),
 * prises par video/captures-showreel.mjs. Leurs chiffres sont ceux de la
 * séance du jour de capture, et la vidéo l'écrit à l'écran (PLAN.capturesDu) :
 * une vidéo ne se met pas à jour, elle doit dire de quand elle date. Le tableau
 * de bord et le portefeuille, derrière la connexion, n'y figurent pas.
 * Seuls les chiffres flottants de l'ouverture sont décoratifs : ils ne portent
 * ni nom de valeur ni date, et ne prétendent décrire aucune séance.
 *
 * AUCUNE PROMESSE DE RENDEMENT, AUCUN CONSEIL PERSONNALISÉ.
 *
 * LA CARTE N'EST PAS UNE SILHOUETTE. Les huit capitales de l'UEMOA sont placées
 * à leurs coordonnées réelles (projection équirectangulaire) et reliées à
 * Abidjan, siège de la BRVM.
 *
 * UN SEUL PLAN : showreel-plan.json porte les durées des scènes et la voix off.
 * showreel-voix.mjs synthétise la voix et vérifie que chaque phrase tient dans
 * sa fenêtre ; showreel-audio.mjs cale musique et effets sur les mêmes coupes.
 * 120 BPM, une mesure = 60 images : chaque durée de scène en est un multiple.
 */

export const SCENES = PLAN.scenes;
export const TOTAL = SCENES.reduce((a, s) => a + s.duree, 0); // 2100 = 70 s

const DEBUT: Record<string, number> = {};
SCENES.reduce((a, s) => { DEBUT[s.id] = a; return a + s.duree; }, 0);

// ── Charte ──────────────────────────────────────────────────────────────────
const C = {
  nuit: '#030A14',
  abysse: '#061A2E',
  marine: '#0B2A4A',
  elec: '#2F8CFF',
  cyan: '#4FC3FF',
  vert: '#2BD48A',
  rouge: '#FF6B6B',
  or: '#D9B26A',
  blanc: '#F4F8FC',
  gris: '#93A7BF',
  sourd: '#5E7590',
  teal: '#16B6A4',
};
const SERIF = '"Bespoke Serif", Georgia, serif';
const SANS = '"Supreme", "Helvetica Neue", Arial, sans-serif';
const MONO = '"JetBrains Mono", Consolas, monospace';

// ── Polices : mêmes familles que le site, attendues avant la première image ─
if (typeof document !== 'undefined' && !document.getElementById('wb-polices')) {
  const attente = delayRender('Chargement des polices');
  const lien = document.createElement('link');
  lien.id = 'wb-polices';
  lien.rel = 'stylesheet';
  lien.href = 'https://api.fontshare.com/v2/css?f[]=supreme@400,500,700,800&f[]=bespoke-serif@400,500,700&display=block';
  const mono = document.createElement('link');
  mono.rel = 'stylesheet';
  mono.href = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=block';
  let restant = 2;
  const fini = () => {
    restant -= 1;
    if (restant > 0) return;
    Promise.all([
      document.fonts.load('600 60px "Bespoke Serif"'),
      document.fonts.load('500 20px "Supreme"'),
      document.fonts.load('700 20px "Supreme"'),
      document.fonts.load('500 20px "JetBrains Mono"'),
    ]).finally(() => continueRender(attente));
  };
  lien.onload = fini; lien.onerror = fini;
  mono.onload = fini; mono.onerror = fini;
  document.head.append(lien, mono);
}

// ── Outils ──────────────────────────────────────────────────────────────────
const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const t = (f: number, a: number, b: number, de = 0, a2 = 1, e = EASE) =>
  interpolate(f, [a, b], [de, a2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e });

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function serie(seed: number, n: number, derive = 0.002, vol = 0.018, depart = 100) {
  const r = rng(seed);
  const out = [depart];
  for (let i = 1; i < n; i++) out.push(out[i - 1] * (1 + derive + (r() - 0.5) * vol * 2));
  return out;
}
const fr = (v: number, d = 2) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const signe = (v: number, d = 2) => `${v >= 0 ? '+' : '−'}${fr(Math.abs(v), d)} %`;
/** Pulsation au temps (15 images) : 1 sur le temps, décroît ensuite. */
const pulse = (f: number) => Math.exp(-(f % 15) / 4);

// ── Fond ────────────────────────────────────────────────────────────────────
function Fond({ lueur = 0.5, teinte = C.elec, battement = false }: { lueur?: number; teinte?: string; battement?: boolean }) {
  const f = useCurrentFrame();
  const b = battement ? pulse(f) * 0.12 : 0;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 90% 70% at 60% 35%, ${C.marine} 0%, ${C.abysse} 42%, ${C.nuit} 100%)` }}>
      <AbsoluteFill
        style={{
          backgroundImage: 'linear-gradient(rgba(79,195,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(79,195,255,.05) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          backgroundPosition: `${-f * 0.6}px ${-f * 0.3}px`,
          maskImage: 'radial-gradient(ellipse 75% 70% at 50% 45%, black 20%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 45%, black 20%, transparent 85%)',
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 70% 30%, ${teinte}, transparent 45%)`, opacity: lueur * 0.22 + b }} />
    </AbsoluteFill>
  );
}

/** Lignes de marché qui défilent en arrière-plan. */
function LignesMarche({ debut = 0, opacite = 0.5 }: { debut?: number; opacite?: number }) {
  const f = useCurrentFrame();
  const lignes = [
    { s: serie(3, 90, 0.004, 0.03), y: 620, h: 260, c: C.cyan, w: 2.5 },
    { s: serie(11, 90, 0.002, 0.025), y: 720, h: 200, c: C.elec, w: 1.5 },
    { s: serie(21, 90, 0.0035, 0.02), y: 540, h: 220, c: C.vert, w: 1.2 },
  ];
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: opacite }}>
      <defs>
        <linearGradient id="lm-fondu" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".25" stopColor="#fff" stopOpacity="1" />
          <stop offset=".8" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="lm-masque"><rect width="1920" height="1080" fill="url(#lm-fondu)" /></mask>
      </defs>
      <g mask="url(#lm-masque)">
        {lignes.map((l, k) => {
          const min = Math.min(...l.s), max = Math.max(...l.s);
          const pas = 2600 / (l.s.length - 1);
          const d = l.s.map((v, i) => `${i ? 'L' : 'M'}${(i * pas).toFixed(1)} ${(l.y - ((v - min) / (max - min)) * l.h).toFixed(1)}`).join(' ');
          const prog = t(f, debut + k * 8, debut + 70 + k * 8);
          return (
            <path
              key={k}
              d={d}
              transform={`translate(${-((f * (1.4 + k * 0.4)) % 600)} 0)`}
              fill="none"
              stroke={l.c}
              strokeWidth={l.w}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - prog}
              style={{ filter: `drop-shadow(0 0 10px ${l.c})` }}
            />
          );
        })}
      </g>
    </svg>
  );
}

/** Chiffres de marché fictifs qui dérivent en profondeur. */
function ChiffresFlottants({ opacite = 1 }: { opacite?: number }) {
  const f = useCurrentFrame();
  const r = rng(99);
  const items = Array.from({ length: 22 }, (_, i) => {
    const v = r();
    const txt = i % 3 === 0 ? signe((r() - 0.4) * 6) : i % 3 === 1 ? fr(200 + r() * 9000) : `VOL ${fr(1000 + r() * 90000, 0)}`;
    return { txt, x: r() * 1920, y: r() * 1080, z: 0.4 + v * 0.8, vit: 0.3 + r() * 0.8, pos: txt.startsWith('+'), neg: txt.startsWith('−') };
  });
  return (
    <AbsoluteFill style={{ opacity: opacite }}>
      {items.map((it, i) => {
        const y = ((it.y - f * it.vit * it.z + 1200) % 1200) - 60;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: it.x, top: y, fontFamily: MONO, fontSize: 14 + it.z * 16,
              color: it.pos ? C.vert : it.neg ? C.rouge : C.gris,
              opacity: 0.12 + it.z * 0.22, filter: `blur(${(1.2 - it.z) * 2.2}px)`, whiteSpace: 'nowrap',
            }}
          >
            {it.txt}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

// ── Réseau UEMOA ────────────────────────────────────────────────────────────
const VILLES = [
  { n: 'Abidjan', lon: -4.03, lat: 5.36, hub: true },
  { n: 'Dakar', lon: -17.44, lat: 14.69 },
  { n: 'Bissau', lon: -15.6, lat: 11.86 },
  { n: 'Bamako', lon: -8.0, lat: 12.64 },
  { n: 'Ouagadougou', lon: -1.52, lat: 12.37 },
  { n: 'Niamey', lon: 2.11, lat: 13.51 },
  { n: 'Lomé', lon: 1.23, lat: 6.13 },
  { n: 'Cotonou', lon: 2.42, lat: 6.37 },
];

function Reseau({ x, y, w, h, debut = 0, intensite = 1, etiquettes = true }: { x: number; y: number; w: number; h: number; debut?: number; intensite?: number; etiquettes?: boolean }) {
  const f = useCurrentFrame();
  const px = (lon: number) => x + ((lon + 19) / 23) * w;
  const py = (lat: number) => y + ((16.5 - lat) / 12.5) * h;
  const hub = VILLES[0];
  const hx = px(hub.lon), hy = py(hub.lat);
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: intensite }}>
      {[1, 2, 3].map((k) => {
        const p = ((f + k * 20) % 60) / 60;
        return <circle key={k} cx={hx} cy={hy} r={20 + p * 140} fill="none" stroke={C.cyan} strokeOpacity={(1 - p) * 0.35 * t(f, debut, debut + 20)} />;
      })}
      {VILLES.slice(1).map((v, i) => {
        const vx = px(v.lon), vy = py(v.lat);
        const cx = (hx + vx) / 2, cy = Math.min(hy, vy) - 90;
        const d = `M${hx} ${hy} Q${cx} ${cy} ${vx} ${vy}`;
        const prog = t(f, debut + 8 + i * 5, debut + 40 + i * 5);
        const s = ((f * 0.018 + i * 0.17) % 1);
        const bx = (1 - s) ** 2 * hx + 2 * (1 - s) * s * cx + s * s * vx;
        const by = (1 - s) ** 2 * hy + 2 * (1 - s) * s * cy + s * s * vy;
        const apparu = t(f, debut + 30 + i * 5, debut + 45 + i * 5);
        return (
          <g key={v.n}>
            <path d={d} fill="none" stroke="url(#rs-g)" strokeWidth={1.6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog} />
            {prog >= 1 && <circle cx={bx} cy={by} r={3.5} fill={C.blanc} style={{ filter: `drop-shadow(0 0 6px ${C.cyan})` }} />}
            <circle cx={vx} cy={vy} r={6 * apparu} fill={C.cyan} style={{ filter: `drop-shadow(0 0 10px ${C.cyan})` }} />
            {etiquettes && (
              <text x={vx + 12} y={vy + 5} fontFamily={SANS} fontSize={17} fill={C.gris} opacity={apparu} letterSpacing=".06em">{v.n}</text>
            )}
          </g>
        );
      })}
      <defs>
        <linearGradient id="rs-g" x1="0" x2="1"><stop offset="0" stopColor={C.cyan} /><stop offset="1" stopColor={C.elec} stopOpacity=".5" /></linearGradient>
      </defs>
      <circle cx={hx} cy={hy} r={11 * t(f, debut, debut + 18)} fill={C.or} style={{ filter: `drop-shadow(0 0 16px ${C.or})` }} />
      {etiquettes && (
        <text x={hx + 18} y={hy + 30} fontFamily={SANS} fontSize={19} fontWeight={700} fill={C.or} opacity={t(f, debut + 10, debut + 25)} letterSpacing=".06em">Abidjan · BRVM</text>
      )}
    </svg>
  );
}

// ── Texte cinétique ─────────────────────────────────────────────────────────
function Mots({
  texte, debut, fin, taille = 76, serif = true, couleur = C.blanc, accent = [], largeur = 1500, align = 'center', poids,
}: {
  texte: string; debut: number; fin?: number; taille?: number; serif?: boolean; couleur?: string;
  accent?: string[]; largeur?: number; align?: 'center' | 'left'; poids?: number;
}) {
  const f = useCurrentFrame();
  const sortie = fin != null ? t(f, fin - 12, fin, 1, 0) : 1;
  const mots = texte.split(' ');
  return (
    <div
      style={{
        width: largeur, textAlign: align, fontFamily: serif ? SERIF : SANS, fontSize: taille, lineHeight: 1.08,
        letterSpacing: '-0.02em', color: couleur, fontWeight: poids ?? (serif ? 600 : 700), opacity: sortie,
        filter: `blur(${(1 - sortie) * 8}px)`, transform: `translateY(${(1 - sortie) * -16}px)`,
      }}
    >
      {mots.map((m, i) => {
        const a = debut + i * 3;
        const p = t(f, a, a + 18);
        const estAccent = accent.includes(m.replace(/[.,»«]/g, ''));
        return (
          <span
            key={i}
            style={{
              display: 'inline-block', marginRight: '0.24em', opacity: p,
              transform: `translateY(${(1 - p) * 30}px)`, filter: `blur(${(1 - p) * 10}px)`,
              ...(estAccent ? { backgroundImage: `linear-gradient(90deg, ${C.cyan}, ${C.vert})`, WebkitBackgroundClip: 'text', color: 'transparent' } : {}),
            }}
          >
            {m}
          </span>
        );
      })}
    </div>
  );
}

function Logo({ taille = 150, prog = 1 }: { taille?: number; prog?: number }) {
  const p1 = Math.min(1, prog * 1.6), p2 = Math.max(0, Math.min(1, (prog - 0.5) * 3)), p3 = Math.max(0, Math.min(1, (prog - 0.75) * 4));
  return (
    <svg width={taille} height={taille * 0.78} viewBox="6 4 122 90" style={{ overflow: 'visible' }}>
      <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke={C.blanc} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p1} />
      <path d="M76 82 L100 33" fill="none" stroke={C.teal} strokeWidth={12} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p2} />
      <polygon points="110,12 117,40 86,28" fill={C.teal} opacity={p3} transform={`translate(${(1 - p3) * -10} ${(1 - p3) * 10})`} />
    </svg>
  );
}

/** Enveloppe de scène : fondu et léger zoom d'entrée/sortie. */
function Scene({ duree, children, entree = 12, sortie = 12 }: { duree: number; children: React.ReactNode; entree?: number; sortie?: number }) {
  const f = useCurrentFrame();
  const o = Math.min(t(f, 0, entree), t(f, duree - sortie, duree, 1, 0));
  const s = interpolate(f, [0, duree], [1.02, 1], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity: o, transform: `scale(${s})`, filter: `blur(${(1 - o) * 6}px)` }}>{children}</AbsoluteFill>;
}

/** Éclat lumineux qui balaie l'écran aux coupes. */
function Balayage({ a }: { a: number }) {
  const f = useCurrentFrame();
  const p = t(f, a - 8, a + 8, 0, 1, Easing.inOut(Easing.cubic));
  if (f < a - 8 || f > a + 8) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, width: 520, left: -600 + p * 3100, background: `linear-gradient(90deg, transparent, rgba(79,195,255,.22), rgba(255,255,255,.35), rgba(79,195,255,.22), transparent)`, transform: 'skewX(-18deg)', filter: 'blur(14px)' }} />
    </AbsoluteFill>
  );
}

// 1. OUVERTURE
function Ouverture() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: f - 150, fps, config: { damping: 16, stiffness: 90 } });
  const carteRecul = t(f, 140, 175, 1, 0.35);
  return (
    <Scene duree={240} entree={20}>
      <Fond lueur={0.7} />
      <LignesMarche debut={0} opacite={0.55} />
      <ChiffresFlottants opacite={t(f, 0, 30) * carteRecul} />
      <Reseau x={900} y={200} w={880} h={520} debut={15} intensite={t(f, 5, 40) * carteRecul} />
      {/* Voile derrière le titre : les chiffres flottants ne passent pas dessous. */}
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(3,10,20,.85) 0%, rgba(3,10,20,.6) 38%, transparent 58%)', opacity: t(f, 20, 40) * t(f, 130, 150, 1, 0) }} />
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 140 }}>
        <Mots texte="La finance africaine mérite des outils à sa hauteur." debut={32} fin={140} taille={84} largeur={900} align="left" accent={['hauteur']} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 30 }}>
        <div style={{ opacity: logo, transform: `scale(${0.7 + logo * 0.3})` }}>
          {f >= 150 && <Logo taille={150} prog={t(f, 150, 190)} />}
        </div>
        {f >= 160 && <Mots texte="Bienvenue sur WestBourse." debut={165} taille={96} accent={['WestBourse']} />}
      </AbsoluteFill>
    </Scene>
  );
}

// 2. LE PROBLÈME
function Probleme() {
  const f = useCurrentFrame();
  const r = rng(42);
  const fragments = Array.from({ length: 16 }, (_, i) => ({
    x: 80 + r() * 1660, y: 60 + r() * 900, rot: (r() - 0.5) * 24, w: 180 + r() * 180, type: i % 4, z: 0.5 + r() * 0.6,
  }));
  const ordre = t(f, 170, 232, 0, 1, Easing.inOut(Easing.cubic));
  const agitation = 1 - ordre;
  const titresOp = t(f, 0, 20);
  return (
    <Scene duree={240}>
      <Fond lueur={0.35} teinte={C.rouge} />
      {fragments.map((fr0, i) => {
        const col = i % 4, lig = Math.floor(i / 4);
        const cibleX = 330 + col * 330, cibleY = 250 + lig * 150;
        const jx = Math.sin((f + i * 13) / 17) * 22 * agitation, jy = Math.cos((f + i * 7) / 13) * 16 * agitation;
        const x = fr0.x + (cibleX - fr0.x) * ordre + jx, y = fr0.y + (cibleY - fr0.y) * ordre + jy;
        const w = fr0.w + (300 - fr0.w) * ordre;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: x, top: y, width: w, height: 118, borderRadius: 12, padding: 14,
              background: ordre > 0.5 ? 'rgba(16,40,70,.7)' : 'rgba(40,52,68,.55)', border: `1px solid rgba(147,167,191,${0.15 + ordre * 0.15})`,
              transform: `rotate(${fr0.rot * agitation}deg) scale(${fr0.z + (1 - fr0.z) * ordre})`,
              filter: `blur(${(1.1 - fr0.z) * 3 * agitation}px)`, opacity: t(f, i * 2, i * 2 + 14) * (0.75 + ordre * 0.25),
            }}
          >
            {fr0.type === 0 && <div style={{ fontFamily: MONO, fontSize: 13, color: C.rouge, fontWeight: 700 }}>PDF · 184 p.</div>}
            {fr0.type === 1 && <div style={{ fontFamily: SANS, fontSize: 13, color: C.gris }}>Communiqué…</div>}
            {fr0.type === 2 && <div style={{ fontFamily: MONO, fontSize: 13, color: C.or }}>Tableau 7.3 (suite)</div>}
            {fr0.type === 3 && <div style={{ fontFamily: MONO, fontSize: 13, color: C.gris }}>?? % · ?? FCFA</div>}
            {[0, 1, 2, 3].map((k) => (
              <div key={k} style={{ height: 8, marginTop: 10, borderRadius: 4, width: `${40 + ((i * 17 + k * 23) % 55)}%`, background: ordre > 0.6 ? 'rgba(79,195,255,.35)' : 'rgba(147,167,191,.25)' }} />
            ))}
          </div>
        );
      })}
      <AbsoluteFill style={{ background: `rgba(3,10,20,${(0.32 - ordre * 0.17) * titresOp})` }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Mots texte="Comprendre la BRVM ne devrait pas être compliqué." debut={12} fin={112} taille={80} largeur={1400} accent={['compliqué']} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Mots texte="Les bonnes décisions commencent par les bonnes informations." debut={120} fin={236} taille={76} largeur={1500} accent={['bonnes', 'informations']} />
      </AbsoluteFill>
    </Scene>
  );
}

// ── Écran réel : fenêtre de navigateur + mouvement de caméra ────────────────
/** Zone d'une capture, en pixels CSS de la page capturée (1440 × 900). */
type Zone = readonly [number, number, number, number];
const PLEIN: Zone = [0, 0, 1440, 900];

interface Plan {
  src: string;
  url: string;
  /** Images (dans la scène) où ce plan commence et finit — fondu de 12 images. */
  de: number;
  a: number;
  /** Mouvements de caméra : [image, zone] ; on passe d'une zone à l'autre en douceur. */
  cles: readonly (readonly [number, Zone])[];
}

function zoneA(f: number, cles: Plan['cles']): Zone {
  if (f <= cles[0][0]) return cles[0][1];
  for (let i = 1; i < cles.length; i++) {
    const [f1, z1] = cles[i];
    const [f0, z0] = cles[i - 1];
    if (f <= f1) {
      const p = t(f, f0, f1, 0, 1, Easing.inOut(Easing.cubic));
      return z0.map((v, k) => v + (z1[k] - v) * p) as unknown as Zone;
    }
  }
  return cles[cles.length - 1][1];
}

function Ecran({ plans, largeur, style }: { plans: Plan[]; largeur: number; style?: React.CSSProperties }) {
  const f = useCurrentFrame();
  const H = largeur * 0.625;
  const k = largeur / 1440;
  const actif = plans.find((p) => f >= p.de && f < p.a) ?? plans[plans.length - 1];
  return (
    <div
      style={{
        position: 'absolute', width: largeur, borderRadius: 16, overflow: 'hidden', background: '#0b1622',
        border: '1px solid rgba(147,167,191,.28)',
        boxShadow: `0 50px 120px rgba(0,0,0,.6), 0 0 80px rgba(47,140,255,.14)`, ...style,
      }}
    >
      <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', background: '#0e1b29', borderBottom: '1px solid rgba(147,167,191,.15)' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c, opacity: 0.85 }} />)}
        <div style={{ marginLeft: 18, flex: 1, maxWidth: 520, height: 24, borderRadius: 7, background: 'rgba(147,167,191,.12)', display: 'flex', alignItems: 'center', padding: '0 12px', fontFamily: SANS, fontSize: 14, color: C.gris }}>
          <span style={{ color: C.vert, marginRight: 8 }}>🔒</span>{actif.url}
        </div>
      </div>
      <div style={{ position: 'relative', width: largeur, height: H, overflow: 'hidden' }}>
        {plans.map((p) => {
          // Le premier plan n'a pas de fondu d'entrée, ni le dernier de fondu de
          // sortie : c'est le panneau entier qui apparaît et disparaît.
          const premier = p === plans[0], dernier = p === plans[plans.length - 1];
          const o = Math.min(premier ? 1 : t(f, p.de, p.de + 12), dernier ? 1 : t(f, p.a - 12, p.a, 1, 0));
          if (o <= 0) return null;
          const [x, y, w, h] = zoneA(f, p.cles);
          const s = Math.max(1, Math.min(1440 / w, 900 / h));
          const demiW = 720 / s, demiH = 450 / s;
          const cx = Math.min(1440 - demiW, Math.max(demiW, x + w / 2));
          const cy = Math.min(900 - demiH, Math.max(demiH, y + h / 2));
          return (
            <img
              key={p.src}
              src={staticFile(`ecrans/${p.src}.png`)}
              style={{
                position: 'absolute', left: 0, top: 0, width: largeur, height: H, opacity: o,
                transformOrigin: '0 0',
                transform: `translate(${largeur / 2}px, ${H / 2}px) scale(${s}) translate(${-cx * k}px, ${-cy * k}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

const Source = ({ style }: { style?: React.CSSProperties }) => (
  <div style={{ position: 'absolute', fontFamily: SANS, fontSize: 16, color: C.sourd, letterSpacing: '.03em', ...style }}>
    Captures réelles de westbourse.com · {PLAN.capturesDu}
  </div>
);

// 3. LA SOLUTION — « La BRVM aujourd'hui », tel qu'en ligne
function Solution({ duree }: { duree: number }) {
  const f = useCurrentFrame();
  const bascule = t(f, 0, 60);
  const ouvre = t(f, 95, 130, 0, 1, Easing.inOut(Easing.cubic));
  const echelle = 0.62 + bascule * 0.08 + ouvre * 0.3;
  const y = 150 - bascule * 10 - ouvre * 140;
  const scrim = t(f, 252, 262);
  const mots = ['Données.', 'Analyse.', 'Décisions.'];
  const plan: Plan = {
    src: 'aujourdhui', url: 'westbourse.com', de: 0, a: duree,
    cles: [[0, PLEIN], [110, PLEIN], [128, [140, 160, 720, 360]], [150, [140, 160, 720, 360]], [165, [790, 100, 520, 380]], [188, [790, 100, 520, 380]], [208, [140, 440, 1020, 460]], [250, [140, 440, 1020, 460]]],
  };
  return (
    <Scene duree={duree} entree={8}>
      <Fond lueur={0.8} battement />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 58, opacity: t(f, 90, 110, 1, 0) }}>
        <Mots texte="Une plateforme pensée pour suivre, comprendre et analyser la BRVM." debut={6} taille={54} largeur={1600} accent={['suivre', 'comprendre', 'analyser']} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 1440, height: 940, transform: `perspective(2400px) translateY(${y}px) rotateX(${(1 - bascule) * 20}deg) scale(${echelle})`, filter: `blur(${scrim * 3}px)` }}>
          <Ecran plans={[plan]} largeur={1440} style={{ left: 0, top: 0 }} />
        </div>
      </AbsoluteFill>
      <Source style={{ right: 60, bottom: 26, opacity: t(f, 130, 150) * (1 - scrim) }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(3,10,20,.85), rgba(3,10,20,.6))', opacity: scrim }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 44 }}>
        {mots.map((m, i) => {
          const d = 254 + i * 12;
          const p = t(f, d, d + 12, 0, 1, Easing.out(Easing.back(2)));
          return (
            <span key={m} style={{ fontFamily: SERIF, fontSize: 116, fontWeight: 600, letterSpacing: '-0.03em', color: i === 2 ? 'transparent' : C.blanc, backgroundImage: i === 2 ? `linear-gradient(90deg, ${C.cyan}, ${C.vert})` : undefined, WebkitBackgroundClip: i === 2 ? 'text' : undefined, opacity: p, transform: `scale(${0.6 + p * 0.4})`, display: 'inline-block' }}>{m}</span>
          );
        })}
      </AbsoluteFill>
    </Scene>
  );
}

// 4. LES FONCTIONNALITÉS — quatre écrans réels
const PANNEAUX: { titre: string; puces: string[]; plans: (d: number) => Plan[] }[] = [
  {
    titre: 'Suivez les marchés.',
    puces: ['Les sociétés cotées à la BRVM', 'Cours et variations de la séance'],
    plans: (d) => [{ src: 'societes', url: 'westbourse.com/societes', de: 0, a: d, cles: [[0, PLEIN], [30, PLEIN], [75, [150, 90, 1150, 620]], [165, [150, 300, 900, 560]]] }],
  },
  {
    titre: 'Analysez les entreprises.',
    puces: ['Une fiche détaillée par société', "Carnet d'ordres, fondamentaux, dividendes"],
    plans: (d) => [
      { src: 'fiche', url: 'westbourse.com/societes/SNTS', de: 0, a: 92, cles: [[0, PLEIN], [18, PLEIN], [42, [140, 60, 1160, 450]], [62, [140, 60, 1160, 450]], [80, [140, 470, 1160, 330]]] },
      { src: 'fiche-bas', url: 'westbourse.com/societes/SNTS', de: 80, a: d, cles: [[80, [140, 80, 1160, 240]], [118, [140, 80, 1160, 240]], [140, [140, 270, 1160, 360]]] },
    ],
  },
  {
    titre: 'Comprenez les tendances.',
    puces: ['Communiqués officiels de la BRVM', 'Actualités et informations de marché'],
    plans: (d) => [{ src: 'actualites', url: 'westbourse.com/actualites', de: 0, a: d, cles: [[0, PLEIN], [30, PLEIN], [70, [430, 130, 820, 500]], [165, [430, 300, 820, 500]]] }],
  },
  {
    titre: 'Investissez avec méthode.',
    puces: ['Academy : cours et formations', 'Comparateur des SGI agréées'],
    plans: (d) => [
      { src: 'formations', url: 'westbourse.com/formations', de: 0, a: 86, cles: [[0, PLEIN], [22, PLEIN], [60, [300, 150, 1060, 640]]] },
      { src: 'sgi', url: 'westbourse.com/comparateur-sgi', de: 74, a: d, cles: [[74, PLEIN], [100, [150, 70, 1150, 420]], [165, [150, 420, 1150, 480]]] },
    ],
  },
];

function Fonctions({ duree }: { duree: number }) {
  const f = useCurrentFrame();
  const P = duree / 4;
  return (
    <Scene duree={duree} entree={8}>
      <Fond lueur={0.6} battement />
      <LignesMarche opacite={0.14} />
      {PANNEAUX.map((p, i) => {
        const lf = f - i * P;
        if (lf < -2 || lf > P + 2) return null;
        const entree = t(lf, 0, 18), sortie = t(lf, P - 16, P, 0, 1, Easing.in(Easing.cubic));
        const o = entree * (1 - sortie);
        return (
          <AbsoluteFill key={i} style={{ opacity: o }}>
            <div style={{ position: 'absolute', left: 90, top: 260, width: 560, transform: `translateX(${(1 - entree) * 60 - sortie * 60}px)`, filter: `blur(${(1 - o) * 6}px)` }}>
              <div style={{ fontFamily: MONO, fontSize: 20, color: C.cyan, letterSpacing: '.2em' }}>{`0${i + 1} / 04`}</div>
              <div style={{ marginTop: 18 }}>
                <Mots texte={p.titre} debut={i * P + 4} taille={78} largeur={560} align="left" accent={[p.titre.split(' ').slice(-1)[0].replace('.', '')]} />
              </div>
              <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {p.puces.map((pu, k) => {
                  const q = t(lf, 22 + k * 8, 40 + k * 8);
                  return (
                    <div key={pu} style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: SANS, fontSize: 23, color: C.blanc, opacity: q, transform: `translateX(${(1 - q) * 24}px)` }}>
                      <span style={{ flex: '0 0 30px', height: 30, borderRadius: 8, background: 'rgba(79,195,255,.15)', border: `1px solid ${C.cyan}66`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: C.cyan, fontSize: 17 }}>✓</span>
                      {pu}
                    </div>
                  );
                })}
              </div>
            </div>
            <Sequence from={Math.round(i * P)} layout="none">
              <div style={{ position: 'absolute', left: 690, top: 170, transform: `perspective(2200px) rotateY(${(1 - entree) * -12 + sortie * 8}deg) translateX(${(1 - entree) * 70 - sortie * 70}px)` }}>
                <Ecran plans={p.plans(P)} largeur={1150} />
              </div>
            </Sequence>
          </AbsoluteFill>
        );
      })}
      <div style={{ position: 'absolute', left: 90, bottom: 80, display: 'flex', gap: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ width: 90, height: 4, borderRadius: 2, background: 'rgba(147,167,191,.18)', overflow: 'hidden' }}>
            <div style={{ height: 4, width: `${t(f, i * P, (i + 1) * P, 0, 100, Easing.linear)}%`, background: C.cyan }} />
          </div>
        ))}
      </div>
      <Source style={{ right: 80, bottom: 70 }} />
      {[1, 2, 3].map((k) => <Balayage key={k} a={k * P} />)}
    </Scene>
  );
}

// 5. L'AMBITION — l'application sur téléphone
function Ambition({ duree }: { duree: number }) {
  const f = useCurrentFrame();
  const r = rng(77);
  const barres = Array.from({ length: 38 }, (_, i) => 0.18 + (i / 37) * 0.62 + r() * 0.12);
  const lignes = [
    { t: "L'information financière, plus claire.", a: ['claire'], d: 8 },
    { t: "L'investissement, plus accessible.", a: ['accessible'], d: 100 },
    { t: 'La BRVM, à portée de décision.', a: ['décision'], d: 192 },
  ];
  const tel = t(f, 30, 80);
  // L'écran mobile réel (390 × 844 CSS) défile lentement dans le téléphone.
  const hauteurImg = 280 * (2532 / 1170);
  // On part SOUS l'en-tête : à 390 px, l'en-tête du site se chevauche (logo
  // sous « Connexion »), défaut du site à corriger, pas à mettre en vitrine.
  const SOUS_ENTETE = 72;
  const defile = SOUS_ENTETE + t(f, 90, duree - 20, 0, 1, Easing.inOut(Easing.cubic)) * (hauteurImg - 616 - SOUS_ENTETE);
  return (
    <Scene duree={duree} entree={8}>
      <Fond lueur={1} teinte={C.vert} battement />
      <Reseau x={1000} y={90} w={620} h={360} debut={0} intensite={0.45} etiquettes={false} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs><linearGradient id="am-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.vert} /><stop offset="1" stopColor={C.elec} stopOpacity=".15" /></linearGradient></defs>
        {barres.map((h, i) => {
          const p = t(f, 6 + i * 2.2, 40 + i * 2.2);
          const bh = h * 380 * p;
          return <rect key={i} x={20 + i * 50} y={1080 - bh} width={34} height={bh} rx={4} fill="url(#am-b)" opacity={0.5} />;
        })}
        <path
          d={barres.map((h, i) => `${i ? 'L' : 'M'}${37 + i * 50} ${1080 - h * 380 - 18}`).join(' ')}
          fill="none" stroke={C.vert} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t(f, 30, 130)}
          style={{ filter: `drop-shadow(0 0 12px ${C.vert})` }}
        />
      </svg>
      <div style={{ position: 'absolute', right: 140, top: 110, width: 304, height: 640, borderRadius: 48, padding: 12, background: '#05080d', border: '2px solid rgba(147,167,191,.4)', boxShadow: `0 40px 90px rgba(0,0,0,.65), 0 0 60px ${C.elec}33`, transform: `translateY(${(1 - tel) * 760}px) rotate(${(1 - tel) * 8}deg)` }}>
        <div style={{ width: 280, height: 616, borderRadius: 38, overflow: 'hidden', position: 'relative' }}>
          <img src={staticFile('ecrans/mobile.png')} style={{ position: 'absolute', left: 0, top: -defile, width: 280 }} />
        </div>
        <div style={{ position: 'absolute', top: 20, left: '50%', width: 90, height: 24, marginLeft: -45, borderRadius: 12, background: '#05080d' }} />
      </div>
      <div style={{ position: 'absolute', left: 130, top: 250, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {lignes.map((l) => (
          <Mots key={l.t} texte={l.t} debut={l.d} taille={66} largeur={1250} align="left" accent={l.a} />
        ))}
      </div>
    </Scene>
  );
}

// 6. CONCLUSION
function Fin({ duree }: { duree: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: f - 2, fps, config: { damping: 18, stiffness: 80 } });
  const marque = t(f, 12, 42);
  const cta = spring({ frame: f - 168, fps, config: { damping: 14, stiffness: 120 } });
  return (
    <Scene duree={duree} entree={6} sortie={24}>
      <Fond lueur={0.9} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 28 }, (_, i) => {
          const ang = (i / 28) * Math.PI * 2;
          const p = t(f, i, 50 + i);
          const r0 = 1300 - p * 1000, r1 = 1300 - p * 820;
          return <line key={i} x1={960 + Math.cos(ang) * r0} y1={420 + Math.sin(ang) * r0} x2={960 + Math.cos(ang) * r1} y2={420 + Math.sin(ang) * r1} stroke={i % 3 ? C.elec : C.cyan} strokeOpacity={0.35 * (1 - t(f, 60, 110))} strokeWidth={2} />;
        })}
        {[0, 1].map((k) => {
          const p = ((f + k * 45) % 90) / 90;
          return <circle key={k} cx={960} cy={380} r={120 + p * 260} fill="none" stroke={C.cyan} strokeOpacity={(1 - p) * 0.25 * t(f, 30, 60)} />;
        })}
      </svg>
      <LignesMarche debut={20} opacite={0.14} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 230, fontFamily: SANS, color: C.blanc }}>
        <div style={{ transform: `scale(${0.6 + logo * 0.4})`, opacity: logo }}><Logo taille={170} prog={t(f, 2, 40)} /></div>
        <div style={{ fontFamily: SERIF, fontSize: 124, fontWeight: 600, letterSpacing: `${-0.03 + (1 - marque) * 0.12}em`, marginTop: 20, opacity: marque, filter: `blur(${(1 - marque) * 10}px)` }}>WestBourse</div>
        <div style={{ marginTop: 14 }}>
          <Mots texte="Comprendre la BRVM. Investir avec confiance." debut={46} taille={44} serif={false} poids={500} couleur={C.gris} accent={['confiance']} largeur={1200} />
        </div>
        <div style={{ marginTop: 50, display: 'flex', alignItems: 'center', gap: 26, opacity: cta, transform: `translateY(${(1 - cta) * 30}px)` }}>
          <div style={{ padding: '20px 44px', borderRadius: 999, fontSize: 30, fontWeight: 700, color: C.nuit, background: `linear-gradient(90deg, ${C.cyan}, ${C.vert})`, boxShadow: `0 0 ${30 + pulse(f) * 30}px ${C.cyan}66` }}>Découvrez la plateforme.</div>
          <div style={{ fontFamily: MONO, fontSize: 32, color: C.blanc, letterSpacing: '.02em' }}>westbourse.com</div>
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, textAlign: 'center', fontFamily: SANS, fontSize: 16, lineHeight: 1.5, color: C.sourd, opacity: t(f, 190, 215) }}>
        Captures réelles de westbourse.com du {PLAN.capturesDu} ; les chiffres affichés sont ceux de la séance du {PLAN.seanceAffichee}. Les performances passées ne préjugent pas des performances futures.<br />
        WestBourse est un outil d&apos;information et d&apos;analyse ; il ne fournit pas de conseil en investissement personnalisé.
      </div>
    </Scene>
  );
}

// ── Composition ─────────────────────────────────────────────────────────────
const COMPOSANTS: Record<string, (p: { duree: number }) => React.ReactElement> = {
  ouverture: Ouverture, probleme: Probleme, solution: Solution, fonctions: Fonctions, ambition: Ambition, fin: Fin,
};

export default function Showreel() {
  return (
    <AbsoluteFill style={{ backgroundColor: C.nuit }}>
      <Audio src={staticFile('showreel-audio.wav')} />
      {SCENES.map((s) => {
        const Comp = COMPOSANTS[s.id];
        return (
          <Sequence key={s.id} from={DEBUT[s.id]} durationInFrames={s.duree} name={s.id}>
            <Comp duree={s.duree} />
          </Sequence>
        );
      })}
      {SCENES.slice(1).map((s) => <Balayage key={s.id} a={DEBUT[s.id]} />)}
    </AbsoluteFill>
  );
}
