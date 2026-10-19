import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from 'remotion';
import { MONO, SANS, SERIF } from './polices';
import { C, FPS, Logo, t } from './ecosysteme';

/**
 * Une leçon Academy entière en motion design, 16:9, voix off.
 *
 * Source unique : academy/<lecon>.json porte les textes affichés ET la voix,
 * section par section. academy-voix.mjs en tire une piste par scène et écrit
 * le plan, durées mesurées comprises, dans public/academy/<lecon>/plan.json —
 * que lit calculateMetadata. La durée d'une scène est celle de sa voix, plus
 * une respiration ; un élément apparaît quand la voix prononce son mot.
 *
 * Honnêteté : chaque gabarit n'affiche que des chiffres présents dans le JSON.
 * Les graphiques sont tracés sur une seule échelle, l'axe des années de la
 * capitalisation est proportionnel au temps, et la frise de séance l'est aux
 * minutes. La seule animation sans données (offre/demande) est étiquetée
 * « illustration ».
 *
 * `section` (facultatif) ne rend qu'une section : la même source produit la
 * leçon entière ou une vidéo par section.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SceneA = { id: string; gabarit: string; voix: string; [k: string]: any };
type Section = { n: number; type: string; titre: string; scenes: SceneA[] };
export type PlanLecon = {
  id: string;
  cours: string;
  lecon: string;
  titreLecon: string;
  sections: Section[];
  durees: Record<string, number>;
};
type Props = { lecon: string; section: number | null; plan: PlanLecon | null };

const RESPIRATION = 0.7;
const QUEUE_FIN = 45;

const dureeScene = (plan: PlanLecon, s: SceneA) =>
  Math.ceil((plan.durees[s.id] + RESPIRATION + (s.gabarit === 'chapitre' ? 0.6 : 0)) * FPS) + (s.gabarit === 'fin' ? QUEUE_FIN : 0);

const scenesRendues = (plan: PlanLecon, section: number | null) =>
  plan.sections.filter((x) => section == null || x.n === section).flatMap((x) => x.scenes.map((s) => ({ s, sec: x })));

export const calculerLecon: CalculateMetadataFunction<Props> = async ({ props }) => {
  const plan = (await (await fetch(staticFile(`academy/${props.lecon}/plan.json`))).json()) as PlanLecon;
  const total = scenesRendues(plan, props.section).reduce((a, { s }) => a + dureeScene(plan, s), 0);
  return { durationInFrames: total, props: { ...props, plan } };
};

/** Teinte et libellé par type de section, comme les badges de la page de leçon. */
const TYPES: Record<string, { label: string; teinte: string }> = {
  intro: { label: 'Introduction', teinte: C.cyan },
  definition: { label: 'Définition', teinte: C.cyan },
  importance: { label: 'Pourquoi c’est important', teinte: '#F0B23A' },
  cas: { label: 'Cas réel BRVM', teinte: '#3fe18b' },
  piege: { label: 'Pièges fréquents', teinte: '#ff6b6b' },
  lexique: { label: 'Lexique', teinte: '#B69BF0' },
  retenir: { label: 'À retenir', teinte: '#B69BF0' },
};
const VERT = '#3fe18b';
const ROUGE = '#ff6b6b';

const entier = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const alea = (i: number) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
const asset = (chemin: string) => staticFile(`academy/_assets/${chemin}`);

/** Instant (en images) où la voix prononce la n-ième occurrence de `mot`. */
function quand(s: SceneA, dv: number, mot: string, n = 0, avance = 4): number {
  const v = s.voix.toLowerCase();
  let i = -1;
  for (let k = 0; k <= n; k++) { i = v.indexOf(mot.toLowerCase(), i + 1); if (i < 0) return 6; }
  return Math.max(6, Math.round((i / v.length) * dv * FPS) - avance);
}

/** Instant (en images) d'un élément placé à la fraction `part` (0..1) de la voix. */
const aPart = (part: number | undefined, dv: number, avance = 4) => Math.max(6, Math.round((part ?? 0) * dv * FPS) - avance);

// ── Ambiance : aurore, grille en perspective, particules, balayage ─────────
function Ambiance({ teinte }: { teinte: string }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.fond, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 1100, height: 1100, borderRadius: '50%', left: 200 + Math.sin(f / 80) * 160, top: -620 + Math.cos(f / 95) * 60, background: `radial-gradient(circle, ${teinte}38 0%, transparent 62%)` }} />
      <div style={{ position: 'absolute', width: 900, height: 900, borderRadius: '50%', left: 1150 + Math.cos(f / 70) * 140, top: -380 + Math.sin(f / 60) * 70, background: 'radial-gradient(circle, #16B6A426 0%, transparent 62%)' }} />
      <div style={{ position: 'absolute', left: -400, right: -400, bottom: -140, height: 560, transform: 'perspective(700px) rotateX(64deg)', transformOrigin: 'bottom',
        backgroundImage: `linear-gradient(${teinte}22 2px, transparent 2px), linear-gradient(90deg, ${teinte}1c 2px, transparent 2px)`,
        backgroundSize: '90px 90px', backgroundPosition: `0 ${(f * 1.6) % 90}px`,
        WebkitMaskImage: 'linear-gradient(to top, black 10%, transparent 85%)', maskImage: 'linear-gradient(to top, black 10%, transparent 85%)', opacity: 0.55 }} />
      {Array.from({ length: 40 }, (_, i) => {
        const v = 0.25 + alea(i + 7) * 0.7;
        const y = (((alea(i + 99) * 1180 - f * v) % 1180) + 1180) % 1180 - 50;
        return <div key={i} style={{ position: 'absolute', left: alea(i) * 1920, top: y, width: 2 + alea(i + 3) * 3, height: 2 + alea(i + 3) * 3, borderRadius: '50%', background: i % 3 ? C.blanc : teinte, opacity: 0.12 + alea(i + 5) * 0.4 }} />;
      })}
    </AbsoluteFill>
  );
}

function Balayage({ teinte }: { teinte: string }) {
  const f = useCurrentFrame();
  if (f > 24) return null;
  const x = t(f, 0, 22, -900, 2300);
  return <div style={{ position: 'absolute', top: -200, bottom: -200, left: x, width: 420, transform: 'skewX(-18deg)', background: `linear-gradient(90deg, transparent, ${teinte}55, ${C.blanc}33, ${teinte}55, transparent)`, filter: 'blur(6px)', mixBlendMode: 'screen' }} />;
}

/** Entrée de scène : léger zoom arrière, flou dissipé ; sortie en fondu. */
function Cadre({ duree, children }: { duree: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const o = Math.min(t(f, 0, 12), t(f, duree - 10, duree, 1, 0));
  const z = 1.05 - 0.05 * t(f, 0, 24) + 0.012 * (f / Math.max(1, duree));
  return (
    <AbsoluteFill style={{ opacity: o, color: C.blanc, fontFamily: SANS, transform: `scale(${z})`, filter: `blur(${(1 - t(f, 0, 14)) * 10}px)` }}>
      {children}
    </AbsoluteFill>
  );
}

function Habillage({ plan, sec, rang, nb, teinte, duree }: { plan: PlanLecon; sec: Section; rang: number; nb: number; teinte: string; duree: number }) {
  const f = useCurrentFrame();
  const sections = plan.sections.filter((x) => x.n > 0);
  const enCours = (rang + t(f, 0, duree)) / nb;
  return (
    <>
      <div style={{ position: 'absolute', top: 52, left: 90, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Logo taille={46} />
        <span style={{ fontFamily: MONO, fontSize: 21, letterSpacing: '.3em', fontWeight: 600 }}>WESTBOURSE</span>
        <span style={{ fontFamily: MONO, fontSize: 21, letterSpacing: '.3em', color: teinte }}>ACADEMY</span>
      </div>
      <div style={{ position: 'absolute', top: 60, right: 90, fontFamily: MONO, fontSize: 20, letterSpacing: '.12em', color: C.sourd }}>
        {plan.lecon.toUpperCase()}{sec.n > 0 ? ` · SECTION ${sec.n}/${sections.length}` : ''}
      </div>
      <div style={{ position: 'absolute', bottom: 50, left: 90, right: 90, display: 'flex', gap: 10 }}>
        {sections.map((x) => {
          const plein = x.n < sec.n ? 1 : x.n === sec.n ? enCours : 0;
          const c = (TYPES[x.type] ?? TYPES.definition).teinte;
          return (
            <div key={x.n} style={{ flex: 1, height: 5, borderRadius: 3, background: C.bord, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${plein * 100}%`, background: c, boxShadow: `0 0 12px ${c}` }} />
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Briques ─────────────────────────────────────────────────────────────────
function Entre({ debut, children, dy = 36, style }: { debut: number; children: React.ReactNode; dy?: number; style?: React.CSSProperties }) {
  const f = useCurrentFrame();
  const p = t(f, debut, debut + 16);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * dy}px)`, filter: `blur(${(1 - p) * 8}px)`, ...style }}>{children}</div>;
}

/** Texte révélé mot par mot, chaque mot montant de derrière un masque. */
function Mots({ texte, debut, pas = 3, barre, style }: { texte: string; debut: number; pas?: number; barre?: { mot: string; a: number }; style?: React.CSSProperties }) {
  const f = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.26em', ...style }}>
      {texte.split(' ').map((m, i) => {
        const p = t(f, debut + i * pas, debut + i * pas + 14);
        const barrer = barre && m.replace(/[^\p{L}]/gu, '').toLowerCase() === barre.mot;
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '0.08em' }}>
            <span style={{ display: 'inline-block', position: 'relative', transform: `translateY(${(1 - p) * 105}%)`, color: barrer ? C.gris : undefined }}>
              {m}
              {barrer && <span style={{ position: 'absolute', left: -6, right: -6, top: '56%', height: 9, borderRadius: 5, background: ROUGE, boxShadow: `0 0 18px ${ROUGE}`, transformOrigin: 'left', transform: `scaleX(${t(f, barre!.a, barre!.a + 14)})` }} />}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function Badge({ teinte, children, style }: { teinte: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '10px 22px', borderRadius: 999, border: `1px solid ${teinte}99`, background: `${teinte}1c`, color: teinte, fontFamily: MONO, fontSize: 22, letterSpacing: '.22em', ...style }}>
      {children}
    </div>
  );
}

const panneau = (teinte: string, actif = true): React.CSSProperties => ({
  borderRadius: 26,
  background: `linear-gradient(165deg, ${teinte}${actif ? '26' : '12'}, ${C.surface} 60%)`,
  border: `1px solid ${teinte}${actif ? '88' : '33'}`,
  boxShadow: actif ? `0 0 50px ${teinte}22, inset 0 1px 0 rgba(255,255,255,.06)` : 'none',
});

function LogoTuile({ chemin, taille = 72 }: { chemin: string; taille?: number }) {
  return (
    <div style={{ width: taille, height: taille, borderRadius: taille * 0.22, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: taille * 0.1, boxShadow: '0 8px 24px rgba(0,0,0,.45)', flexShrink: 0 }}>
      <Img src={asset(chemin)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  );
}

const Titre = ({ children, debut = 2 }: { children: React.ReactNode; debut?: number }) => (
  <Entre debut={debut} style={{ position: 'absolute', top: 150, left: 90, right: 90 }}>
    <div style={{ fontFamily: SERIF, fontSize: 60, fontWeight: 600, lineHeight: 1.1 }}>{children}</div>
  </Entre>
);

type G = { s: SceneA; dv: number; teinte: string; plan: PlanLecon; sec: Section };

// ── Gabarits ────────────────────────────────────────────────────────────────
function Ouverture({ s, plan, teinte }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items: string[] = s.sommaire ?? [];
  return (
    <>
      <div style={{ position: 'absolute', left: 90, top: 200, width: 860 }}>
        <div style={{ filter: `drop-shadow(0 0 ${30 * t(f, 10, 40)}px ${teinte})` }}><Logo taille={130} prog={t(f, 0, 36)} /></div>
        <Entre debut={16}><Badge teinte={teinte} style={{ marginTop: 40 }}>{plan.cours.toUpperCase()}</Badge></Entre>
        <Entre debut={22}><div style={{ fontFamily: MONO, fontSize: 30, color: teinte, marginTop: 34, letterSpacing: '.1em' }}>{plan.lecon.toUpperCase()}</div></Entre>
        <Mots texte={plan.titreLecon} debut={26} style={{ fontFamily: SERIF, fontSize: 84, fontWeight: 600, lineHeight: 1.04, marginTop: 14 }} />
      </div>
      <div style={{ position: 'absolute', left: 1040, right: 90, top: 210, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map((x, i) => {
          const k = spring({ frame: f - 40 - i * 6, fps, config: { damping: 16, stiffness: 140 } });
          const c = (TYPES[plan.sections[i + 1]?.type] ?? TYPES.definition).teinte;
          return (
            <div key={x} style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '15px 24px', borderRadius: 16, background: `linear-gradient(90deg, ${c}1f, ${C.surface} 70%)`, border: `1px solid ${c}55`, opacity: k, transform: `translateX(${(1 - k) * 80}px)` }}>
              <span style={{ fontFamily: MONO, fontSize: 24, color: c, width: 40 }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ fontSize: 30, fontWeight: 500 }}>{x}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Chapitre({ s, dv, sec, teinte }: G) {
  const f = useCurrentFrame();
  const type = TYPES[sec.type] ?? TYPES.definition;
  const num = String(sec.n).padStart(2, '0');
  const barre = s.barre ? { mot: s.barre as string, a: quand(s, dv, s.barre, 0, 0) + 6 } : undefined;
  return (
    <>
      <div style={{ position: 'absolute', right: 40, top: 80, fontFamily: SERIF, fontWeight: 700, fontSize: 640, lineHeight: 1, color: 'transparent', WebkitTextStroke: `3px ${teinte}55`, transform: `scale(${1.25 - 0.25 * t(f, 0, 40)}) translateX(${(1 - t(f, 0, 40)) * 120}px)`, opacity: 0.9 * t(f, 0, 20) }}>
        {num}
      </div>
      <div style={{ position: 'absolute', left: 90, top: 300, width: 1300 }}>
        <Entre debut={4}><Badge teinte={teinte}>{type.label.toUpperCase()} · SECTION {sec.n}</Badge></Entre>
        <Mots texte={sec.titre} debut={10} pas={3} barre={barre} style={{ fontFamily: SERIF, fontSize: sec.titre.length > 50 ? 82 : 100, fontWeight: 600, lineHeight: 1.06, marginTop: 40 }} />
        <div style={{ marginTop: 40, height: 6, width: 300, borderRadius: 3, background: teinte, boxShadow: `0 0 20px ${teinte}`, transformOrigin: 'left', transform: `scaleX(${t(f, 18, 40)})` }} />
      </div>
    </>
  );
}

function Definition({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tRegl = quand(s, dv, 'strictement');
  return (
    <>
      <div style={{ position: 'absolute', left: 90, top: 230, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {(s.sigle as [string, string][]).map(([l, mot], i) => {
          const p = spring({ frame: f - 4 - i * 7, fps, config: { damping: 16, stiffness: 130 } });
          return (
            <div key={l} style={{ display: 'flex', alignItems: 'baseline', gap: 26, opacity: p, transform: `translateX(${(1 - p) * -60}px)` }}>
              <span style={{ fontFamily: SERIF, fontSize: 122, fontWeight: 700, color: teinte, width: 128, lineHeight: 1, textShadow: `0 0 40px ${teinte}88` }}>{l}</span>
              <span style={{ fontSize: 44, color: C.gris }}>{mot}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 900, right: 90, top: 270 }}>
        <Mots texte={s.phrase} debut={quand(s, dv, 'système')} style={{ fontFamily: SERIF, fontSize: 60, fontWeight: 600, lineHeight: 1.12 }} />
        <div style={{ height: 6, marginTop: 14, width: 470, borderRadius: 3, background: teinte, boxShadow: `0 0 16px ${teinte}`, transformOrigin: 'left', transform: `scaleX(${t(f, tRegl, tRegl + 16)})` }} />
        <Entre debut={quand(s, dv, "n'importe qui")}>
          <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: '.2em', color: C.sourd, marginTop: 60 }}>OUVERT À TOUS</div>
        </Entre>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 20 }}>
          {(s.publics as string[]).map((p) => {
            const k = spring({ frame: f - quand(s, dv, p), fps, config: { damping: 12, stiffness: 170 } });
            return <div key={p} style={{ padding: '14px 26px', borderRadius: 999, ...panneau(teinte), fontSize: 32, opacity: k, transform: `scale(${0.6 + k * 0.4})` }}>{p}</div>;
          })}
        </div>
        <Entre debut={quand(s, dv, 'investir')}>
          <div style={{ fontSize: 36, color: C.gris, marginTop: 50, lineHeight: 1.35 }}>→ {s.chute}</div>
        </Entre>
      </div>
    </>
  );
}

function Pays({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pays: string[] = s.pays;
  const CX = 960, CY = 610, RX = 640, RY = 250, W = 300, H = 84;
  const tHuit = quand(s, dv, 'huit pays');
  const tSup = quand(s, dv, 'supervisé');
  const pos = pays.map((_, i) => { const a = -Math.PI / 2 + (i / pays.length) * Math.PI * 2; return { x: CX + Math.cos(a) * RX, y: CY + Math.sin(a) * RY }; });
  const hub = spring({ frame: f - tSup, fps, config: { damping: 13, stiffness: 120 } });
  return (
    <>
      <Entre debut={4} style={{ position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ fontFamily: SERIF, fontSize: 64, fontWeight: 600 }}>{s.titre}</div>
      </Entre>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {pos.map((p, i) => {
          const d0 = tSup + 4 + i * 2;
          const q = t(f, d0 + 14, d0 + 40);
          return (
            <g key={i}>
              <line x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={teinte} strokeOpacity={0.5} strokeWidth={2.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t(f, d0, d0 + 14)} />
              {q > 0 && q < 1 && <circle cx={CX + (p.x - CX) * q} cy={CY + (p.y - CY) * q} r={6} fill={teinte} style={{ filter: `drop-shadow(0 0 8px ${teinte})` }} />}
            </g>
          );
        })}
        <circle cx={CX} cy={CY} r={120 + hub * 160 + (f % 45) * 3} fill="none" stroke={teinte} strokeOpacity={hub * (1 - (f % 45) / 45) * 0.5} strokeWidth={2} />
      </svg>
      {pays.map((nom, i) => {
        const k = spring({ frame: f - tHuit - i * 4, fps, config: { damping: 14, stiffness: 150 } });
        return <div key={nom} style={{ position: 'absolute', left: pos[i].x - W / 2, top: pos[i].y - H / 2, width: W, height: H, ...panneau(teinte, false), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 500, opacity: k, transform: `scale(${0.5 + k * 0.5})` }}>{nom}</div>;
      })}
      <div style={{ position: 'absolute', left: CX - 230, top: CY - 80, width: 460, height: 160, ...panneau(teinte), border: `2px solid ${teinte}`, boxShadow: `0 0 70px ${teinte}55`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: hub, transform: `scale(${0.7 + hub * 0.3})` }}>
        <div style={{ fontFamily: MONO, fontSize: 52, fontWeight: 700, color: teinte }}>{s.superviseur}</div>
        <div style={{ fontSize: 21, color: C.gris, marginTop: 8, textAlign: 'center', padding: '0 20px' }}>{s.superviseurNom}</div>
      </div>
    </>
  );
}

/** Courbe tracée progressivement ; axe des x proportionnel aux années. */
function Croissance({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const pts: { annee: string; valeur: number }[] = s.points;
  const X0 = 1000, X1 = 1790, Y0 = 860, H = 560;
  const a0 = Number(pts[0].annee), a1 = Number(pts[pts.length - 1].annee);
  const max = pts[pts.length - 1].valeur;
  const xy = pts.map((p) => ({ x: X0 + ((Number(p.annee) - a0) / (a1 - a0)) * (X1 - X0), y: Y0 - (p.valeur / max) * H, ...p }));
  const tDeb = quand(s, dv, '1998'), tFin = quand(s, dv, '2026');
  const prog = t(f, tDeb, tFin + 8);
  const xc = X0 + prog * (X1 - X0);
  let j = 0; while (j < xy.length - 2 && xy[j + 1].x < xc) j++;
  const r = Math.min(1, Math.max(0, (xc - xy[j].x) / (xy[j + 1].x - xy[j].x)));
  const valeur = xy[j].valeur + (xy[j + 1].valeur - xy[j].valeur) * r;
  const yc = xy[j].y + (xy[j + 1].y - xy[j].y) * r;
  const d = xy.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const i2020 = xy.findIndex((p) => p.annee === '2020');
  const tAcc = quand(s, dv, 'accélérée');
  // Deux années trop proches sur l'axe (2024, 2026) : la seconde passe dessous.
  const serre = (x: number) => xy.some((q) => q.x < x && x - q.x < 80);
  const quandPoint = (x: number) => tDeb + ((x - X0) / (X1 - X0)) * (tFin + 8 - tDeb);
  return (
    <>
      <div style={{ position: 'absolute', left: 90, top: 190, width: 820 }}>
        <Entre debut={2}><div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: '.22em', color: teinte }}>{String(s.label).toUpperCase()}</div></Entre>
        <Entre debut={4}>
          <div style={{ fontFamily: MONO, fontSize: 140, fontWeight: 700, marginTop: 20, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 40px ${teinte}55` }}>{entier(valeur)}</div>
          <div style={{ fontSize: 36, color: C.gris, marginTop: 14 }}>{s.unite} · {prog >= 1 ? pts[pts.length - 1].annee : xy[r > 0.5 ? j + 1 : j].annee}</div>
        </Entre>
        <Entre debut={quand(s, dv, 'multipliée')}>
          <div style={{ display: 'flex', gap: 18, marginTop: 60 }}>
            <div style={{ padding: '16px 28px', borderRadius: 16, background: `${teinte}22`, border: `1px solid ${teinte}`, fontFamily: MONO, fontSize: 42, fontWeight: 700, color: teinte, boxShadow: `0 0 30px ${teinte}44` }}>{s.multiple}</div>
            <div style={{ padding: '16px 28px', borderRadius: 16, background: C.surface, border: `1px solid ${C.bord}`, fontFamily: MONO, fontSize: 42, fontWeight: 700 }}>{s.variation}</div>
          </div>
        </Entre>
        <Entre debut={tAcc}>
          <div style={{ marginTop: 46, fontFamily: MONO, fontSize: 22, letterSpacing: '.2em', color: C.sourd }}>ACCÉLÉRATION RÉCENTE</div>
          <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 42, fontWeight: 700, color: VERT }}>{s.acceleration}</div>
        </Entre>
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="aire" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={teinte} stopOpacity={0.35} /><stop offset="1" stopColor={teinte} stopOpacity={0} /></linearGradient>
          <clipPath id="dessine"><rect x={0} y={0} width={xc} height={1080} /></clipPath>
        </defs>
        <line x1={X0} y1={Y0} x2={X1 + 20} y2={Y0} stroke={C.bord} strokeWidth={2} />
        <g clipPath="url(#dessine)">
          <path d={`${d} L${X1} ${Y0} L${X0} ${Y0} Z`} fill="url(#aire)" />
          <path d={d} fill="none" stroke={teinte} strokeWidth={6} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 10px ${teinte})` }} />
          {i2020 >= 0 && <path d={xy.slice(i2020).map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} fill="none" stroke={VERT} strokeWidth={7} opacity={t(f, tAcc, tAcc + 12)} style={{ filter: `drop-shadow(0 0 12px ${VERT})` }} />}
        </g>
        {xy.map((p) => (
          <g key={p.annee} opacity={t(f, quandPoint(p.x) - 2, quandPoint(p.x) + 8)}>
            <circle cx={p.x} cy={p.y} r={9} fill={C.fond} stroke={teinte} strokeWidth={4} />
            <text x={p.x} y={p.y - 24} textAnchor="middle" fill={C.blanc} fontFamily={MONO} fontSize={24} fontWeight={700}>{entier(p.valeur)}</text>
            <text x={p.x} y={Y0 + (serre(p.x) ? 72 : 40)} textAnchor="middle" fill={C.gris} fontFamily={MONO} fontSize={24}>{p.annee}</text>
          </g>
        ))}
        {prog > 0 && prog < 1 && <circle cx={xc} cy={yc} r={12} fill={C.blanc} style={{ filter: `drop-shadow(0 0 16px ${teinte})` }} />}
      </svg>
      <Entre debut={tFin}><div style={{ position: 'absolute', left: 1000, right: 90, top: 968, fontSize: 19, color: C.sourd }}>{s.source}</div></Entre>
    </>
  );
}

function Stats({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stats: { label: string; valeur: string; unite: string; detail: string; mot?: string; part?: number }[] = s.stats;
  return (
    <>
      <Titre>{s.titre ?? 'En chiffres'}</Titre>
      <div style={{ position: 'absolute', left: 90, right: 90, top: 340, display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`, gap: 28, perspective: 1400 }}>
        {stats.map((st) => {
          const d = st.part != null ? aPart(st.part, dv, 8) : quand(s, dv, st.mot, 0, 8);
          const k = spring({ frame: f - d, fps, config: { damping: 15, stiffness: 120 } });
          // Compteur animé seulement pour un entier pur ; sinon la valeur publiée, telle quelle.
          const entierPur = /^\d{1,3}(\s\d{3})*$|^\d+$/.test(st.valeur.trim());
          const cible = Number(st.valeur.replace(/\D/g, ''));
          return (
            <div key={st.label} style={{ padding: '40px 34px', ...panneau(teinte), minHeight: 460, display: 'flex', flexDirection: 'column', opacity: k, transform: `rotateX(${(1 - k) * 60}deg) translateY(${(1 - k) * 60}px)`, transformOrigin: 'bottom' }}>
              <div style={{ fontFamily: MONO, fontSize: 21, letterSpacing: '.2em', color: teinte }}>{st.label.toUpperCase()}</div>
              <div style={{ fontFamily: MONO, fontSize: st.valeur.length > 12 ? 54 : st.valeur.length > 7 ? 70 : st.valeur.length > 3 ? 94 : 140, fontWeight: 700, marginTop: 34, lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 0 30px ${teinte}55` }}>{entierPur ? entier(cible * t(f, d, d + 24)) : st.valeur}</div>
              {st.unite && <div style={{ fontSize: 32, color: C.gris, marginTop: 10 }}>{st.unite}</div>}
              <div style={{ fontSize: 27, color: C.gris, marginTop: 'auto', lineHeight: 1.35 }}>{st.detail}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** L'entreprise en briques ; l'une se détache et devient « 1 action ». */
function Fraction({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const COL = 12, LIG = 7, T = 44, E = 8, X0 = 150, Y0 = 330;
  const tPart = quand(s, dv, 'détenez');
  const tDroits = quand(s, dv, 'trois droits');
  const cible = 3 * COL + 8;
  const sort = t(f, tPart, tPart + 26);
  return (
    <>
      <Titre>{s.titre}</Titre>
      {Array.from({ length: COL * LIG }, (_, i) => {
        const c = i % COL, l = Math.floor(i / COL);
        const d = 6 + alea(i) * 24;
        const p = t(f, d, d + 16);
        const ext = i === cible;
        const x = X0 + c * (T + E) + (ext ? sort * 760 : 0);
        const y = Y0 + l * (T + E) + (1 - p) * (alea(i + 50) - 0.5) * 500 - (ext ? sort * 40 : 0);
        const tl = ext ? T + sort * 60 : T;
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: tl, height: tl, borderRadius: 8, background: ext ? teinte : `${teinte}${l % 2 ? '44' : '33'}`, border: `1px solid ${teinte}88`, opacity: p, boxShadow: ext ? `0 0 ${40 * sort}px ${teinte}` : 'none' }} />;
      })}
      <Entre debut={30}><div style={{ position: 'absolute', left: X0, top: Y0 + LIG * (T + E) + 24, fontFamily: MONO, fontSize: 24, letterSpacing: '.2em', color: C.gris }}>UNE ENTREPRISE RÉELLE</div></Entre>
      <div style={{ position: 'absolute', left: X0 + 8 * (T + E) + 900, top: Y0 + 3 * (T + E) - 40, opacity: sort }}>
        <div style={{ fontFamily: SERIF, fontSize: 64, fontWeight: 600 }}>1 action</div>
        <div style={{ fontSize: 30, color: C.gris, marginTop: 6 }}>= une part de propriété</div>
      </div>
      <Entre debut={tDroits}>
        <div style={{ position: 'absolute', left: X0, top: 880 }}><Badge teinte={teinte}>3 DROITS GARANTIS PAR LA LOI</Badge></div>
      </Entre>
    </>
  );
}

function Droits({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const droits: { titre: string; detail: string; mot: string; accroche?: string; exemple?: { logo: string; nom: string; valeur: string; legende: string; source: string } }[] = s.droits;
  const debuts = droits.map((d) => quand(s, dv, d.mot));
  const actif = debuts.filter((d) => f >= d).length - 1;
  const tEx = quand(s, dv, 'sonatel');
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, top: 160, bottom: 120, display: 'grid', gridTemplateColumns: '1.25fr 1fr 1fr', gap: 28, perspective: 1600 }}>
      {droits.map((d, i) => {
        const k = spring({ frame: f - debuts[i], fps, config: { damping: 15, stiffness: 110 } });
        const ex = d.exemple;
        return (
          <div key={d.titre} style={{ ...panneau(teinte, i === actif), padding: '40px 36px', display: 'flex', flexDirection: 'column', opacity: k * (i === actif ? 1 : 0.6), transform: `rotateY(${(1 - k) * -75}deg) scale(${i === actif ? 1 : 0.97})`, transformOrigin: 'left' }}>
            <div style={{ fontFamily: MONO, fontSize: 56, fontWeight: 700, color: teinte, lineHeight: 1 }}>{String(i + 1).padStart(2, '0')}</div>
            <div style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 600, marginTop: 24, lineHeight: 1.1 }}>{d.titre}</div>
            <div style={{ fontSize: 32, color: C.gris, marginTop: 20, lineHeight: 1.35 }}>{d.detail}</div>
            {d.accroche && <div style={{ marginTop: 'auto', fontFamily: MONO, fontSize: 38, whiteSpace: 'nowrap', fontWeight: 700, color: teinte }}>{d.accroche}</div>}
            {ex && (
              <div style={{ marginTop: 'auto', padding: '22px 24px', borderRadius: 18, background: 'rgba(0,0,0,.35)', border: `1px solid ${teinte}55`, opacity: t(f, tEx, tEx + 12), transform: `translateY(${(1 - t(f, tEx, tEx + 12)) * 30}px)` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <LogoTuile chemin={ex.logo} taille={110} />
                  <div>
                    <div style={{ fontSize: 24, color: C.gris }}>{ex.nom}</div>
                    <div style={{ fontFamily: MONO, fontSize: 54, fontWeight: 700, textShadow: `0 0 24px ${teinte}66` }}>{ex.valeur}</div>
                  </div>
                </div>
                <div style={{ fontSize: 21, color: C.gris, marginTop: 12 }}>{ex.legende}</div>
                <div style={{ fontSize: 17, color: C.sourd, marginTop: 4 }}>Source : {ex.source}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Illustration offre/demande — aucune valeur de marché. */
function Offre({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const tHausse = quand(s, dv, 'demande dépasse');
  const tBaisse = quand(s, dv, "l'offre l'emporte");
  const tAmf = quand(s, dv, 'amf');
  const achats = 3 + 4 * t(f, tHausse, tHausse + 20) - 3 * t(f, tBaisse, tBaisse + 20);
  const ventes = 3 + 4 * t(f, tBaisse, tBaisse + 20) - 1 * t(f, tHausse, tHausse + 20);
  const pile = (n: number, couleur: string, x: number, titre: string, sens: number) => (
    <div style={{ position: 'absolute', left: x, top: 290, width: 420 }}>
      <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: '.2em', color: couleur }}>{titre}</div>
      <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 12, height: 470, marginTop: 20, alignItems: sens < 0 ? 'flex-start' : 'flex-end' }}>
        {Array.from({ length: 7 }, (_, i) => {
          const v = Math.max(0, Math.min(1, n - i));
          return <div key={i} style={{ height: 54, width: `${60 + alea(i + (sens < 0 ? 1 : 9)) * 40}%`, borderRadius: 10, background: `linear-gradient(90deg, ${couleur}cc, ${couleur}33)`, opacity: v, transform: `translateX(${(1 - v) * sens * 60}px)`, boxShadow: `0 0 18px ${couleur}44` }} />;
        })}
      </div>
    </div>
  );
  // Courbe illustrative : montée pendant la phase « demande », baisse ensuite.
  const N = 60;
  const pts = Array.from({ length: N }, (_, i) => {
    const u = i / (N - 1);
    const tendance = u < 0.55 ? u / 0.55 : 1 - ((u - 0.55) / 0.45) * 0.8;
    return { x: 760 + u * 400, y: 760 - tendance * 300 + Math.sin(i * 1.7) * 14 };
  });
  const prog = Math.min(t(f, tHausse, tBaisse) * 0.55 + t(f, tBaisse, tAmf) * 0.45, 1);
  const visibles = pts.slice(0, Math.max(2, Math.round(prog * N)));
  const fin = visibles[visibles.length - 1];
  const monte = f < tBaisse;
  return (
    <>
      <Titre>Le prix naît de la rencontre entre acheteurs et vendeurs</Titre>
      {pile(achats, VERT, 90, 'DEMANDE · ACHETEURS', -1)}
      {pile(ventes, ROUGE, 1410, 'OFFRE · VENDEURS', 1)}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <path d={visibles.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} fill="none" stroke={monte ? VERT : ROUGE} strokeWidth={6} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 12px ${monte ? VERT : ROUGE})` }} />
        {f > tHausse && <circle cx={fin.x} cy={fin.y} r={11} fill={C.blanc} style={{ filter: `drop-shadow(0 0 14px ${C.blanc})` }} />}
      </svg>
      <div style={{ position: 'absolute', left: 660, width: 600, top: 330, textAlign: 'center', fontFamily: SERIF, fontSize: 46, fontWeight: 600, color: monte ? VERT : ROUGE, opacity: t(f, tHausse, tHausse + 10) }}>
        {monte ? '↑ Le cours monte' : '↓ Le cours baisse'}
      </div>
      <div style={{ position: 'absolute', left: 660, width: 600, top: 800, textAlign: 'center', fontSize: 18, color: C.sourd }}>Illustration · sans valeurs de marché</div>
      <Entre debut={tAmf} style={{ position: 'absolute', left: 0, right: 0, top: 870, display: 'flex', justifyContent: 'center' }}>
        <Badge teinte={teinte}>AMF-UMOA · ÉQUITÉ DE CHAQUE SÉANCE</Badge>
      </Entre>
    </>
  );
}

/** Frise de séance proportionnelle aux minutes, de 9h00 à 15h00. */
function Seance({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const phases: { debut: string; fin: string | null; titre: string; detail: string; mot: string; cle?: boolean }[] = s.phases;
  const minutes = (h: string) => { const [a, b] = h.split('h').map(Number); return a * 60 + b; };
  const M0 = 9 * 60, M1 = 15 * 60, X0 = 150, X1 = 1770, Y = 540;
  const x = (h: string) => X0 + ((minutes(h) - M0) / (M1 - M0)) * (X1 - X0);
  const milieu = (ph: (typeof phases)[number]) => (ph.fin ? (x(ph.debut) + x(ph.fin)) / 2 : x(ph.debut));
  const debuts = phases.map((p) => quand(s, dv, p.mot));
  const actif = Math.max(0, debuts.filter((d) => f >= d).length - 1);
  const p = phases[actif];
  const prec = actif > 0 ? milieu(phases[actif - 1]) : X0;
  const curseur = prec + (milieu(p) - prec) * t(f, debuts[actif], debuts[actif] + 16);
  const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
  const graduations = ['9h00', '10h00', '11h00', '12h00', '13h00', '14h00', '15h00'];
  const couleur = (ph: (typeof phases)[number], i: number) => (ph.cle ? teinte : i === 0 ? C.cyan : C.blanc);
  return (
    <>
      <Titre>{s.titre}</Titre>
      <div style={{ position: 'absolute', left: 90, top: 245, display: 'flex', gap: 12 }}>
        {jours.map((j, i) => <Entre key={j} debut={6 + i * 4}><div style={{ padding: '8px 18px', borderRadius: 10, ...panneau(teinte), fontFamily: MONO, fontSize: 24 }}>{j}</div></Entre>)}
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <line x1={X0} y1={Y} x2={X1} y2={Y} stroke={C.bord} strokeWidth={6} strokeLinecap="round" />
        {graduations.map((g) => (
          <g key={g} opacity={t(f, 4, 20)}>
            <line x1={x(g)} y1={Y + 22} x2={x(g)} y2={Y + 34} stroke={C.sourd} strokeWidth={2} />
            <text x={x(g)} y={Y + 64} textAnchor="middle" fill={C.sourd} fontFamily={MONO} fontSize={22}>{g}</text>
          </g>
        ))}
        {phases.map((ph, i) => {
          const vis = t(f, debuts[i], debuts[i] + 14);
          const c = couleur(ph, i);
          return ph.fin ? (
            <g key={i}>
              <line x1={x(ph.debut)} y1={Y} x2={x(ph.debut) + (x(ph.fin) - x(ph.debut)) * vis} y2={Y} stroke={c} strokeWidth={ph.cle ? 18 : 12} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 ${ph.cle ? 16 : 8}px ${c})` }} />
              <text x={milieu(ph)} y={Y - 40} textAnchor="middle" fill={c} fontFamily={MONO} fontSize={22} opacity={vis}>{ph.debut} → {ph.fin}</text>
            </g>
          ) : (
            <g key={i} opacity={vis}>
              <circle cx={x(ph.debut)} cy={Y} r={16} fill={C.fond} stroke={c} strokeWidth={5} />
              <text x={x(ph.debut)} y={Y - (i === 1 ? 80 : 40)} textAnchor="middle" fill={c} fontFamily={MONO} fontSize={22}>{ph.debut}</text>
            </g>
          );
        })}
        <g transform={`translate(${curseur} 0)`} opacity={t(f, debuts[0], debuts[0] + 8)}>
          <line x1={0} y1={Y - 100} x2={0} y2={Y + 100} stroke={C.blanc} strokeWidth={3} />
          <circle cx={0} cy={Y} r={9} fill={C.blanc} style={{ filter: `drop-shadow(0 0 12px ${C.blanc})` }} />
        </g>
      </svg>
      <div style={{ position: 'absolute', left: 150, right: 150, top: 690, padding: '30px 40px', ...panneau(couleur(p, actif)), display: 'flex', alignItems: 'center', gap: 36, opacity: t(f, debuts[actif], debuts[actif] + 12) }}>
        <div style={{ fontFamily: MONO, fontSize: 60, fontWeight: 700, color: couleur(p, actif), width: 90 }}>{p.cle ? '★' : actif + 1}</div>
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 600 }}>{p.titre}</div>
          <div style={{ fontSize: 28, color: C.gris, marginTop: 8 }}>{p.detail}</div>
        </div>
      </div>
    </>
  );
}

/** Indices : valeurs du 17.07.2026 et vraie courbe du Composite (base). */
function Indices({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ind: { nom: string; valeur: string; detail: string; mot: string }[] = s.indices;
  const c = s.courbe as { nom: string; periode: string; source: string; valeurs: number[] };
  const v = c.valeurs;
  const min = Math.min(...v), max = Math.max(...v);
  const X0 = 1010, X1 = 1790, Y0 = 820, H = 400;
  const pts = v.map((y, i) => ({ x: X0 + (i / (v.length - 1)) * (X1 - X0), y: Y0 - ((y - min) / (max - min)) * H }));
  const t0 = quand(s, dv, 'composite');
  const prog = t(f, t0, t0 + 70);
  const vis = pts.slice(0, Math.max(2, Math.round(prog * pts.length)));
  const d = vis.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const fin = vis[vis.length - 1];
  const virgule = (x: number) => x.toFixed(2).replace('.', ',');
  return (
    <>
      <Titre>Deux thermomètres du marché</Titre>
      <div style={{ position: 'absolute', left: 90, top: 260, width: 830, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {ind.map((x) => {
          const dd = quand(s, dv, x.mot);
          const k = spring({ frame: f - dd, fps, config: { damping: 15, stiffness: 120 } });
          const num = Number(x.valeur.replace(',', '.'));
          return (
            <div key={x.nom} style={{ ...panneau(teinte), padding: '28px 34px', opacity: k, transform: `translateX(${(1 - k) * -80}px)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <LogoTuile chemin="brand/brvm-logo.png" taille={52} />
                <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: '.12em', color: teinte }}>{x.nom.toUpperCase()}</div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 88, fontWeight: 700, marginTop: 14, lineHeight: 1, textShadow: `0 0 30px ${teinte}55` }}>
                {virgule(num * t(f, dd, dd + 26))}<span style={{ fontSize: 34, color: C.gris }}> pts</span>
              </div>
              <div style={{ fontSize: 24, color: C.gris, marginTop: 12 }}>{x.detail}</div>
            </div>
          );
        })}
        <Entre debut={t0 + 20}><div style={{ fontFamily: MONO, fontSize: 22, color: C.sourd, letterSpacing: '.1em' }}>{String(s.date).toUpperCase()}</div></Entre>
      </div>
      <div style={{ position: 'absolute', left: X0, top: 300, opacity: t(f, t0, t0 + 12), fontFamily: MONO, fontSize: 22, letterSpacing: '.14em', color: teinte }}>
        {c.nom.toUpperCase()} · {c.periode}
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: t(f, t0, t0 + 12) }}>
        <defs><linearGradient id="aireIdx" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={teinte} stopOpacity={0.3} /><stop offset="1" stopColor={teinte} stopOpacity={0} /></linearGradient></defs>
        <line x1={X0} y1={Y0 + 20} x2={X1} y2={Y0 + 20} stroke={C.bord} strokeWidth={2} />
        <path d={`${d} L${fin.x} ${Y0 + 20} L${X0} ${Y0 + 20} Z`} fill="url(#aireIdx)" />
        <path d={d} fill="none" stroke={teinte} strokeWidth={5} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 10px ${teinte})` }} />
        <circle cx={fin.x} cy={fin.y} r={10} fill={C.blanc} style={{ filter: `drop-shadow(0 0 14px ${teinte})` }} />
        <text x={X0} y={pts[0].y - 22} fill={C.gris} fontFamily={MONO} fontSize={22}>{virgule(v[0])}</text>
        {prog >= 1 && <text x={X1} y={fin.y - 26} textAnchor="end" fill={C.blanc} fontFamily={MONO} fontSize={26} fontWeight={700}>{virgule(v[v.length - 1])}</text>}
        <text x={X0} y={Y0 + 56} fill={C.sourd} fontFamily={MONO} fontSize={20}>26.05.2026</text>
        <text x={X1} y={Y0 + 56} textAnchor="end" fill={C.sourd} fontFamily={MONO} fontSize={20}>17.07.2026</text>
      </svg>
      <div style={{ position: 'absolute', left: X0, top: Y0 + 74, fontSize: 18, color: C.sourd, opacity: t(f, t0, t0 + 12) }}>{c.source}</div>
    </>
  );
}

function Flux({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const etapes: { titre: string; detail: string; mot: string; logo?: string }[] = s.etapes;
  const X = [330, 960, 1590], Y = 520;
  const debuts = etapes.map((e) => quand(s, dv, e.mot));
  const tSgi = debuts[1];
  const sgis = ['sgi/cgf-bourse.svg', 'sgi/hudson-cie.svg', 'sgi/nsia-finance.svg', 'sgi/boa-capital-securities.svg', 'sgi/sogebourse.svg'];
  return (
    <>
      <Titre>Votre ordre passe toujours par une SGI</Titre>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {/* Le chemin direct, refusé */}
        <path d={`M${X[0]} ${Y - 120} Q 960 ${Y - 330} ${X[2]} ${Y - 120}`} fill="none" stroke={ROUGE} strokeWidth={4} strokeDasharray="14 12" opacity={t(f, 6, 18) * (1 - t(f, tSgi, tSgi + 10) * 0.6)} />
        <g opacity={t(f, 18, 26)}>
          <line x1={930} y1={Y - 255} x2={990} y2={Y - 195} stroke={ROUGE} strokeWidth={8} strokeLinecap="round" />
          <line x1={990} y1={Y - 255} x2={930} y2={Y - 195} stroke={ROUGE} strokeWidth={8} strokeLinecap="round" />
        </g>
        {[0, 1].map((i) => {
          const d0 = debuts[i + 1];
          const q = (((f - d0) % 40) + 40) % 40 / 40;
          return (
            <g key={i}>
              <line x1={X[i] + 170} y1={Y} x2={X[i + 1] - 170} y2={Y} stroke={teinte} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t(f, d0, d0 + 14)} />
              {f > d0 + 14 && <circle cx={X[i] + 170 + (X[i + 1] - X[i] - 340) * q} cy={Y} r={9} fill={C.blanc} style={{ filter: `drop-shadow(0 0 12px ${teinte})` }} />}
            </g>
          );
        })}
      </svg>
      {etapes.map((e, i) => {
        const k = spring({ frame: f - (i === 0 ? 4 : debuts[i]), fps, config: { damping: 14, stiffness: 130 } });
        return (
          <div key={e.titre} style={{ position: 'absolute', left: X[i] - 170, top: Y - 110, width: 340, height: 220, ...panneau(teinte, i === 1), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20, opacity: k, transform: `scale(${0.6 + k * 0.4})` }}>
            {e.logo ? <LogoTuile chemin={e.logo} taille={96} /> : <div style={{ fontFamily: SERIF, fontSize: 64, fontWeight: 700, color: teinte }}>{e.titre}</div>}
            <div style={{ fontSize: 22, color: C.gris, marginTop: 14, lineHeight: 1.3 }}>{e.detail}</div>
          </div>
        );
      })}
      <Entre debut={tSgi + 6} style={{ position: 'absolute', left: 0, right: 0, top: 740, textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: '.2em', color: C.sourd }}>QUELQUES SGI AGRÉÉES</div>
      </Entre>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 790, display: 'flex', justifyContent: 'center', gap: 22 }}>
        {sgis.map((g, i) => {
          const k = spring({ frame: f - tSgi - 10 - i * 4, fps, config: { damping: 14, stiffness: 150 } });
          return <div key={g} style={{ opacity: k, transform: `translateY(${(1 - k) * 40}px)` }}><LogoTuile chemin={g} taille={96} /></div>;
        })}
      </div>
    </>
  );
}

function Tableau({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lignes: { logo: string; cellules: string[] }[] = s.lignes;
  const cols: string[] = s.colonnes;
  const courtage = lignes.map((l) => Number(l.cellules[2].replace(',', '.').replace(/[^\d.]/g, '')));
  const cmax = Math.max(...courtage);
  const tFrais = quand(s, dv, 'commission');
  const largeurs = '380px 250px 330px 1fr';
  return (
    <>
      <Titre>{s.titre}</Titre>
      <div style={{ position: 'absolute', left: 90, right: 90, top: 245 }}>
        <div style={{ display: 'grid', gridTemplateColumns: largeurs, padding: '0 28px 12px', fontFamily: MONO, fontSize: 20, letterSpacing: '.18em', color: teinte, opacity: t(f, 4, 14) }}>
          {cols.map((c) => <div key={c}>{c.toUpperCase()}</div>)}
        </div>
        {lignes.map((l, i) => {
          const k = spring({ frame: f - 8 - i * 7, fps, config: { damping: 16, stiffness: 140 } });
          return (
            <div key={l.cellules[0]} style={{ display: 'grid', gridTemplateColumns: largeurs, alignItems: 'center', padding: '12px 28px', marginTop: 10, ...panneau(teinte, false), borderRadius: 16, opacity: k, transform: `translateX(${(1 - k) * 160}px)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}><LogoTuile chemin={l.logo} taille={54} /><span style={{ fontSize: 28, fontWeight: 600 }}>{l.cellules[0]}</span></div>
              <div style={{ fontFamily: MONO, fontSize: 26 }}>{l.cellules[1]}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontFamily: MONO, fontSize: 26, width: 86 }}>{l.cellules[2]}</span>
                <div style={{ height: 12, width: 190 * (courtage[i] / cmax) * t(f, 30 + i * 4, 50 + i * 4), borderRadius: 6, background: teinte, boxShadow: `0 0 10px ${teinte}` }} />
              </div>
              <div style={{ fontSize: 22, color: C.gris, lineHeight: 1.3 }}>{l.cellules[3]}</div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 16, marginTop: 28, alignItems: 'center' }}>
          <Entre debut={tFrais - 10}><span style={{ fontFamily: MONO, fontSize: 20, letterSpacing: '.16em', color: C.sourd }}>EN PLUS DU COURTAGE&nbsp;:</span></Entre>
          {(s.frais as string[]).map((x, i) => {
            const k = spring({ frame: f - tFrais - i * 16, fps, config: { damping: 12, stiffness: 170 } });
            return <div key={x} style={{ padding: '10px 20px', borderRadius: 999, ...panneau(teinte), fontFamily: MONO, fontSize: 24, opacity: k, transform: `scale(${0.6 + 0.4 * k})` }}>{x}</div>;
          })}
        </div>
        <Entre debut={quand(s, dv, 'indicatives')}><div style={{ marginTop: 20, fontSize: 21, color: '#F0B23A' }}>⚠ {s.note}</div></Entre>
      </div>
    </>
  );
}

function Profil({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = spring({ frame: f - 4, fps, config: { damping: 15, stiffness: 120 } });
  const A = { x: 1130, y: 330 }, B = { x: 1650, y: 820 }, Q = { x: 1720, y: 290 };
  const tArc = quand(s, dv, 'lyon');
  const arc = t(f, tArc, tArc + 40);
  const pt = (u: number) => ({ x: (1 - u) ** 2 * A.x + 2 * (1 - u) * u * Q.x + u * u * B.x, y: (1 - u) ** 2 * A.y + 2 * (1 - u) * u * Q.y + u * u * B.y });
  const p = pt(arc);
  const chemin = `M${A.x} ${A.y} Q ${Q.x} ${Q.y} ${B.x} ${B.y}`;
  const puce = (debut: number, texte: string, sous: string) => (
    <Entre debut={debut}><div style={{ ...panneau(teinte), padding: '18px 26px', marginTop: 18 }}><div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: '.16em', color: teinte }}>{sous}</div><div style={{ fontFamily: MONO, fontSize: 38, fontWeight: 700, marginTop: 6 }}>{texte}</div></div></Entre>
  );
  return (
    <>
      <div style={{ position: 'absolute', left: 90, top: 190, width: 780, opacity: k, transform: `translateY(${(1 - k) * 40}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ width: 130, height: 130, borderRadius: '50%', background: `linear-gradient(135deg, ${teinte}, #16B6A4)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: 70, fontWeight: 700, color: C.fond, boxShadow: `0 0 50px ${teinte}66` }}>D</div>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 58, fontWeight: 600 }}>{s.nom}</div>
            <div style={{ fontSize: 28, color: C.gris, marginTop: 6 }}>{s.metier}</div>
          </div>
        </div>
        <Badge teinte={C.sourd} style={{ marginTop: 26, fontSize: 18 }}>{String(s.mention).toUpperCase()}</Badge>
        {puce(quand(s, dv, 'mars'), s.date, 'OUVERTURE DU COMPTE')}
        {puce(quand(s, dv, 'dépôt'), s.depot, 'PREMIER DÉPÔT · DEPUIS L’APP DE SA SGI')}
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <path d={chemin} fill="none" stroke={teinte} strokeWidth={4} strokeDasharray="2 14" strokeLinecap="round" opacity={0.6 * t(f, tArc, tArc + 6)} />
        <path d={chemin} fill="none" stroke={teinte} strokeWidth={5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - arc} style={{ filter: `drop-shadow(0 0 10px ${teinte})` }} />
        {[{ ...A, nom: s.depart }, { ...B, nom: s.arrivee }].map((v, i) => (
          <g key={v.nom} opacity={t(f, tArc + i * 30, tArc + i * 30 + 10)}>
            <circle cx={v.x} cy={v.y} r={14} fill={teinte} />
            <circle cx={v.x} cy={v.y} r={14 + ((f % 40) / 40) * 30} fill="none" stroke={teinte} strokeOpacity={1 - (f % 40) / 40} strokeWidth={3} />
            <text x={v.x - 34} y={v.y + 12} textAnchor="end" fill={C.blanc} fontFamily={SANS} fontSize={40} fontWeight={600}>{v.nom}</text>
          </g>
        ))}
        {arc > 0 && arc < 1 && <circle cx={p.x} cy={p.y} r={12} fill={C.blanc} style={{ filter: `drop-shadow(0 0 16px ${teinte})` }} />}
      </svg>
    </>
  );
}

function Etapes({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const etapes: { titre: string; detail: string; mot?: string; part?: number; cle?: boolean; logos?: string[] }[] = s.etapes;
  const debuts = etapes.map((e) => (e.part != null ? aPart(e.part, dv) : quand(s, dv, e.mot ?? '')));
  // Au-delà de trois étapes, on resserre : tout doit tenir à l'écran.
  const serre = etapes.length > 3;
  const PAS = serre ? Math.floor(700 / etapes.length) : 215;
  const R = serre ? 76 : 100;
  // Bloc d'étapes centré verticalement (au-dessus de la conclusion s'il y en a une).
  const X = 170, Y0 = s.conclusion ? 180 : Math.round((1080 - (etapes.length - 1) * PAS - R) / 2);
  return (
    <>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <line x1={X} y1={Y0 + R / 2} x2={X} y2={Y0 + R / 2 + PAS * (etapes.length - 1)} stroke={teinte} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t(f, debuts[0], debuts[etapes.length - 1] + 10)} style={{ filter: `drop-shadow(0 0 8px ${teinte})` }} />
      </svg>
      {etapes.map((e, i) => {
        const k = spring({ frame: f - debuts[i], fps, config: { damping: 14, stiffness: 130 } });
        return (
          <div key={e.titre} style={{ position: 'absolute', left: X - 50, top: Y0 + i * PAS, right: 90, display: 'flex', gap: 40, alignItems: 'center', opacity: k, transform: `translateX(${(1 - k) * 80}px)` }}>
            <div style={{ width: R, height: R, borderRadius: '50%', background: C.fond, border: `4px solid ${teinte}`, boxShadow: `0 0 30px ${teinte}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: serre ? 34 : 44, fontWeight: 700, color: teinte, flexShrink: 0 }}>{e.cle ? '★' : i + 1}</div>
            <div style={{ ...panneau(teinte, !!e.cle), padding: serre ? '14px 26px' : '22px 30px', flex: 1, display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SERIF, fontSize: serre ? 34 : 44, fontWeight: 600 }}>{e.titre}</div>
                <div style={{ fontSize: serre ? 23 : 27, color: C.gris, marginTop: 6 }}>{e.detail}</div>
              </div>
              {e.logos?.map((l, j) => <div key={l} style={{ opacity: t(f, debuts[i] + 14 + j * 8, debuts[i] + 24 + j * 8) }}><LogoTuile chemin={l} taille={110} /></div>)}
            </div>
          </div>
        );
      })}
      {s.conclusion && (
        <Entre debut={quand(s, dv, 'diaspora')} style={{ position: 'absolute', left: 120, right: 90, top: 860 }}>
          <div style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 600, color: teinte }}>→ {s.conclusion}</div>
        </Entre>
      )}
    </>
  );
}

/** Trois cartes : l'erreur au recto, le bon réflexe au verso. */
function Pieges({ s, dv }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pieges: { erreur: string; detail: string; reflexe: string; mot: string }[] = s.pieges;
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, top: 160, bottom: 120, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30, perspective: 1800 }}>
      {pieges.map((p, i) => {
        const k = spring({ frame: f - quand(s, dv, p.mot), fps, config: { damping: 14, stiffness: 120 } });
        const tour = spring({ frame: f - quand(s, dv, 'bon réflexe', i), fps, config: { damping: 16, stiffness: 90 } });
        const face: React.CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', padding: '42px 36px', display: 'flex', flexDirection: 'column' };
        return (
          <div key={p.erreur} style={{ position: 'relative', opacity: k, transform: `translateY(${(1 - k) * 120}px) rotateY(${tour * 180}deg)`, transformStyle: 'preserve-3d' }}>
            <div style={{ ...face, ...panneau(ROUGE) }}>
              <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: '.2em', color: ROUGE }}>✕ ERREUR {i + 1}</div>
              <div style={{ fontFamily: SERIF, fontSize: 50, fontWeight: 600, marginTop: 28, lineHeight: 1.1 }}>{p.erreur}</div>
              <div style={{ fontSize: 28, color: C.gris, marginTop: 24, lineHeight: 1.4 }}>{p.detail}</div>
            </div>
            <div style={{ ...face, ...panneau(VERT), transform: 'rotateY(180deg)' }}>
              <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: '.2em', color: VERT }}>✓ LE BON RÉFLEXE</div>
              <div style={{ fontFamily: SERIF, fontSize: 42, fontWeight: 600, marginTop: 28, lineHeight: 1.2 }}>{p.reflexe}</div>
              <div style={{ marginTop: 'auto', fontSize: 24, color: C.sourd }}>au lieu de : {p.erreur.charAt(0).toLowerCase() + p.erreur.slice(1)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Idees({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const idees: { texte: string; mot: string }[] = s.idees;
  const debuts = idees.map((x) => quand(s, dv, x.mot));
  return (
    <>
      <Titre>5 idées à emporter</Titre>
      <div style={{ position: 'absolute', left: 90, right: 90, top: 260, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {idees.map((x, i) => {
          const d = debuts[i];
          const p = t(f, d, d + 14);
          const actif = f >= d && f < (debuts[i + 1] ?? 1e9);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '20px 30px', ...panneau(teinte, actif), opacity: 0.25 + 0.75 * p, transform: `translateX(${(1 - p) * 50}px)` }}>
              <svg width={56} height={56} viewBox="0 0 56 56" style={{ flexShrink: 0 }}>
                <circle cx={28} cy={28} r={25} fill="none" stroke={teinte} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
                <path d="M16 29 L25 38 L41 19" fill="none" stroke={teinte} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t(f, d + 8, d + 20)} />
              </svg>
              <div style={{ fontSize: 33, lineHeight: 1.3 }}>{x.texte}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

const PALETTE = ['#56D7FD', '#F0B23A', '#3fe18b', '#B69BF0', '#ff8f5c', '#ff6b9d', '#9fb3ba'];

function Secteurs({ s, dv }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const labels: string[] = s.labels, valeurs: number[] = s.valeurs;
  const total = valeurs.reduce((a, b) => a + b, 0);
  const CX = 560, CY = 600, R = 270, E = 70;
  const tFin = quand(s, dv, 'services financiers');
  const tInd = quand(s, dv, 'industriels');
  const tLogos = quand(s, dv, 'ecobank');
  const balaye = t(f, 6, 50);
  let cumul = 0;
  const arcs = valeurs.map((v, i) => {
    const a0 = (cumul / total) * Math.PI * 2 - Math.PI / 2;
    cumul += v;
    return { a0, a1: (cumul / total) * Math.PI * 2 - Math.PI / 2, i };
  });
  const enAvant = f >= tInd ? 1 : f >= tFin ? 0 : -1;
  const arc = (a0: number, a1: number, r: number) => {
    const g = a1 - a0 > Math.PI ? 1 : 0;
    return `M${CX + Math.cos(a0) * r} ${CY + Math.sin(a0) * r} A${r} ${r} 0 ${g} 1 ${CX + Math.cos(a1) * r} ${CY + Math.sin(a1) * r}`;
  };
  return (
    <>
      <Titre>{s.titre}</Titre>
      <Entre debut={6} style={{ position: 'absolute', top: 228, left: 90 }}><div style={{ fontSize: 26, color: C.gris }}>{s.sousTitre}</div></Entre>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {arcs.map(({ a0, a1, i }) => {
          const fin = Math.min(a1, -Math.PI / 2 + balaye * Math.PI * 2);
          if (fin <= a0 + 0.03) return null;
          const mil = (a0 + a1) / 2;
          const sort = i === enAvant ? spring({ frame: f - (i === 0 ? tFin : tInd), fps, config: { damping: 14, stiffness: 140 } }) * 26 : 0;
          return (
            <path key={i} d={arc(a0 + 0.012, fin - 0.012, R)} fill="none" stroke={PALETTE[i]} strokeWidth={i === enAvant ? E + 16 : E}
              transform={`translate(${Math.cos(mil) * sort} ${Math.sin(mil) * sort})`} opacity={enAvant < 0 || i === enAvant ? 1 : 0.4}
              style={{ filter: i === enAvant ? `drop-shadow(0 0 20px ${PALETTE[i]})` : 'none' }} />
          );
        })}
        <text x={CX} y={CY + 6} textAnchor="middle" fill={C.blanc} fontFamily={MONO} fontSize={96} fontWeight={700}>{enAvant >= 0 ? `${valeurs[enAvant]} %` : '49'}</text>
        <text x={CX} y={CY + 56} textAnchor="middle" fill={C.gris} fontFamily={SANS} fontSize={28}>{enAvant >= 0 ? labels[enAvant] : 'sociétés cotées'}</text>
      </svg>
      <div style={{ position: 'absolute', left: 1000, right: 90, top: 320, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {labels.map((l, i) => {
          const k = t(f, 10 + i * 5, 24 + i * 5);
          return (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '10px 20px', borderRadius: 14, background: i === enAvant ? `${PALETTE[i]}22` : 'transparent', border: `1px solid ${i === enAvant ? PALETTE[i] : 'transparent'}`, opacity: k * (enAvant < 0 || i === enAvant ? 1 : 0.5), transform: `translateX(${(1 - k) * 50}px)` }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: PALETTE[i] }} />
              <div style={{ fontSize: 30, flex: 1 }}>{l}</div>
              {i === 0 && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {(s.logos as string[]).map((g, j) => {
                    const q = spring({ frame: f - tLogos - j * 6, fps, config: { damping: 12, stiffness: 160 } });
                    return <div key={g} style={{ opacity: q, transform: `scale(${q})` }}><LogoTuile chemin={g} taille={66} /></div>;
                  })}
                </div>
              )}
              <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 700, width: 90, textAlign: 'right' }}>{valeurs[i]} %</div>
            </div>
          );
        })}
      </div>
      <Entre debut={30} style={{ position: 'absolute', left: 1000, top: 930 }}><div style={{ fontSize: 19, color: C.sourd }}>{s.source}</div></Entre>
    </>
  );
}

function Fin({ s, teinte, plan }: G) {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 220px' }}>
      <Entre debut={2}><div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: '.3em', color: teinte }}>{String(s.surtitre ?? 'En une phrase').toUpperCase()}</div></Entre>
      <Mots texte={s.retenir} debut={8} pas={2} style={{ fontFamily: SERIF, fontSize: 70, fontWeight: 600, lineHeight: 1.15, marginTop: 30, justifyContent: 'center' }} />
      <div style={{ marginTop: 80, display: 'flex', alignItems: 'center', gap: 22, opacity: t(f, 50, 70), filter: `drop-shadow(0 0 ${24 * t(f, 60, 90)}px ${teinte})` }}>
        <Logo taille={80} prog={t(f, 50, 84)} />
        <span style={{ fontFamily: MONO, fontSize: 34, letterSpacing: '.32em' }}>WESTBOURSE</span>
      </div>
      <Entre debut={70}><div style={{ fontSize: 22, color: C.sourd, marginTop: 34 }}>Contenu pédagogique · pas un conseil en investissement</div></Entre>
      <Entre debut={76}><div style={{ fontSize: 19, color: C.sourd, marginTop: 10 }}>{(plan as PlanLecon & { mention?: string }).mention ?? 'Chiffres de la leçon, recoupés avec la base WestBourse le 14.10.2026'}</div></Entre>
    </div>
  );
}

// ── Gabarits génériques (leçons générées par academy-depuis-cours.mjs) ──────

type Bloc = { genre: 'para' | 'puce' | 'ok' | 'ko' | 'num'; n?: number; texte: string; part: number; suite?: boolean };

/** Texte intégral d'une section, bloc par bloc, au rythme de la voix ; le bloc lu est mis en avant. */
function Texte({ s, dv, teinte, sec }: G) {
  const f = useCurrentFrame();
  const blocs: Bloc[] = s.blocs;
  const debuts = blocs.map((b) => aPart(b.part, dv, 6));
  const actif = Math.max(0, debuts.filter((d) => f >= d).length - 1);
  const total = blocs.reduce((a, b) => a + b.texte.length, 0);
  const taille = total > 420 ? 30 : total > 300 ? 34 : total > 180 ? 39 : 46;
  const marque = (b: Bloc) => {
    if (b.genre === 'ok') return <span style={{ color: VERT, fontWeight: 700 }}>✓</span>;
    if (b.genre === 'ko') return <span style={{ color: ROUGE, fontWeight: 700 }}>✕</span>;
    if (b.genre === 'num') return <span style={{ fontFamily: MONO, color: teinte, fontWeight: 700 }}>{String(b.n).padStart(2, '0')}</span>;
    if (b.genre === 'puce') return <span style={{ width: 12, height: 12, borderRadius: 3, background: teinte, display: 'inline-block', marginTop: taille * 0.45 }} />;
    return null;
  };
  return (
    <>
      {/* Numéro de section en filigrane, comme sur l'écran de chapitre. */}
      <div style={{ position: 'absolute', right: 30, bottom: 90, fontFamily: SERIF, fontWeight: 700, fontSize: 420, lineHeight: 1, color: 'transparent', WebkitTextStroke: `2px ${teinte}26`, opacity: t(f, 0, 20) }}>
        {String(sec.n).padStart(2, '0')}
      </div>
      <Entre debut={2} style={{ position: 'absolute', top: 150, left: 90, right: 90 }}>
        <div style={{ fontFamily: MONO, fontSize: 21, letterSpacing: '.18em', color: teinte }}>{sec.titre.toUpperCase()}</div>
      </Entre>
      <div style={{ position: 'absolute', left: 90, right: 200, top: 200, bottom: 110, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
        {blocs.map((b, i) => {
          const p = t(f, debuts[i], debuts[i] + 14);
          const lu = i === actif;
          const m = marque(b);
          return (
            <div key={i} style={{ display: 'flex', gap: 22, alignItems: 'flex-start', opacity: p * (lu ? 1 : 0.62), transform: `translateY(${(1 - p) * 24}px)`, filter: `blur(${(1 - p) * 6}px)`,
              ...(b.genre === 'ok' || b.genre === 'ko' ? { ...panneau(b.genre === 'ok' ? VERT : ROUGE, lu), padding: '18px 24px', borderRadius: 18 } : {}) }}>
              {m && <div style={{ width: 44, flexShrink: 0, fontSize: taille, lineHeight: 1.35, display: 'flex', justifyContent: 'center' }}>{m}</div>}
              <div style={{ fontSize: taille, lineHeight: 1.42, color: lu ? C.blanc : C.gris, borderLeft: b.genre === 'para' && lu ? `4px solid ${teinte}` : '4px solid transparent', paddingLeft: b.genre === 'para' ? 22 : 0 }}>
                {b.texte}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Tableau publié de la section, ligne par ligne au rythme de la voix. */
function Grille({ s, dv, teinte, sec }: G) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colonnes: string[] = s.colonnes;
  const lignes: string[][] = s.lignes;
  const parts: number[] = s.parts;
  const debuts = lignes.map((_, i) => aPart(parts[i], dv, 6));
  const actif = Math.max(0, debuts.filter((d) => f >= d).length - 1);
  const gabarit = colonnes.length <= 2 ? '1fr 2fr' : colonnes.length === 3 ? '0.8fr 0.8fr 2.2fr' : '0.9fr 0.8fr 0.8fr 2fr';
  const longueur = lignes.flat().reduce((a, c) => a + c.length, 0);
  const taille = longueur > 700 ? 21 : longueur > 450 ? 24 : 27;
  return (
    <>
      <Entre debut={2} style={{ position: 'absolute', top: 150, left: 90, right: 90 }}>
        <div style={{ fontFamily: MONO, fontSize: 21, letterSpacing: '.18em', color: teinte }}>{sec.titre.toUpperCase()}</div>
      </Entre>
      <div style={{ position: 'absolute', left: 90, right: 90, top: 210 }}>
        <div style={{ display: 'grid', gridTemplateColumns: gabarit, gap: 20, padding: '0 26px 12px', fontFamily: MONO, fontSize: 19, letterSpacing: '.16em', color: teinte, opacity: t(f, 4, 14) }}>
          {colonnes.map((c) => <div key={c}>{c.toUpperCase()}</div>)}
        </div>
        {lignes.map((l, i) => {
          const k = spring({ frame: f - debuts[i], fps, config: { damping: 16, stiffness: 140 } });
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: gabarit, gap: 20, alignItems: 'start', padding: '16px 26px', marginTop: 10, ...panneau(teinte, i === actif), borderRadius: 16, opacity: k, transform: `translateX(${(1 - k) * 140}px)` }}>
              {l.map((c, j) => (
                <div key={j} style={{ fontSize: j === 0 ? taille + 2 : taille, fontWeight: j === 0 ? 600 : 400, color: j === 0 ? C.blanc : C.gris, lineHeight: 1.35 }}>{c}</div>
              ))}
            </div>
          );
        })}
        {s.note && (
          <Entre debut={aPart(parts[lignes.length], dv, 6)}>
            <div style={{ marginTop: 18, fontSize: 20, color: C.sourd, lineHeight: 1.4 }}>{s.note}</div>
          </Entre>
        )}
      </div>
    </>
  );
}

/** Graphique de la leçon (barres, courbe ou anneau), sur une seule échelle ; « illustration » quand les valeurs sont des exemples. */
function Graphique({ s, dv, teinte }: G) {
  const f = useCurrentFrame();
  const labels: string[] = s.labels;
  const valeurs: number[] = s.valeurs;
  const unite: string = s.unite ?? '';
  const fmt = (v: number) => `${Number.isInteger(v) ? entier(v) : v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}${unite ? ` ${unite}` : ''}`;
  const prog = t(f, 14, Math.max(40, Math.round(dv * FPS * 0.35)));
  const X0 = 140, X1 = 1780, Y0 = 760, H = 420;
  const max = Math.max(...valeurs.map((v) => Math.abs(v)), 1e-9);
  const min = Math.min(0, ...valeurs);
  const y = (v: number) => Y0 - ((v - min) / (max - min)) * H;
  const pas = (X1 - X0) / labels.length;
  return (
    <>
      <Entre debut={2} style={{ position: 'absolute', top: 150, left: 90, right: 90, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 600 }}>{s.titre}</div>
        <Badge teinte={s.reel ? VERT : '#F0B23A'} style={{ fontSize: 17 }}>{s.reel ? 'DONNÉES RÉELLES' : 'ILLUSTRATION · VALEURS D’EXEMPLE'}</Badge>
      </Entre>
      {s.type === 'pie' ? (
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          {(() => {
            const total = valeurs.reduce((a, v) => a + Math.max(0, v), 0) || 1;
            let cum = 0;
            return valeurs.map((v, i) => {
              const a0 = (cum / total) * Math.PI * 2 - Math.PI / 2;
              cum += Math.max(0, v);
              const a1 = Math.min((cum / total) * Math.PI * 2 - Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
              if (a1 <= a0 + 0.02) return null;
              const R = 230, cx = 520, cy = 580;
              const g = a1 - a0 > Math.PI ? 1 : 0;
              return <path key={i} d={`M${cx + Math.cos(a0 + 0.01) * R} ${cy + Math.sin(a0 + 0.01) * R} A${R} ${R} 0 ${g} 1 ${cx + Math.cos(a1 - 0.01) * R} ${cy + Math.sin(a1 - 0.01) * R}`} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={66} />;
            });
          })()}
        </svg>
      ) : (
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          <line x1={X0} y1={y(0)} x2={X1} y2={y(0)} stroke={C.bord} strokeWidth={2} />
          {s.type === 'line' ? (
            <>
              <path d={valeurs.map((v, i) => `${i ? 'L' : 'M'}${X0 + pas * (i + 0.5)} ${y(v)}`).join(' ')} fill="none" stroke={teinte} strokeWidth={6} strokeLinejoin="round"
                pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog} style={{ filter: `drop-shadow(0 0 10px ${teinte})` }} />
              {valeurs.map((v, i) => (
                <g key={i} opacity={t(prog, i / valeurs.length, i / valeurs.length + 0.05)}>
                  <circle cx={X0 + pas * (i + 0.5)} cy={y(v)} r={9} fill={C.fond} stroke={teinte} strokeWidth={4} />
                  <text x={X0 + pas * (i + 0.5)} y={y(v) - 22} textAnchor="middle" fill={C.blanc} fontFamily={MONO} fontSize={22} fontWeight={700}>{fmt(v)}</text>
                </g>
              ))}
            </>
          ) : (
            valeurs.map((v, i) => {
              const h = Math.abs(y(v) - y(0)) * t(prog, i / valeurs.length * 0.6, i / valeurs.length * 0.6 + 0.4);
              const w = Math.min(150, pas * 0.6);
              const x = X0 + pas * (i + 0.5) - w / 2;
              return (
                <g key={i}>
                  <rect x={x} y={v >= 0 ? y(0) - h : y(0)} width={w} height={h} rx={8} fill={v >= 0 ? teinte : ROUGE} opacity={0.9} />
                  {h > 2 && <text x={x + w / 2} y={(v >= 0 ? y(0) - h : y(0) + h) + (v >= 0 ? -14 : 30)} textAnchor="middle" fill={C.blanc} fontFamily={MONO} fontSize={22} fontWeight={700}>{fmt(v)}</text>}
                </g>
              );
            })
          )}
          {labels.map((l, i) => (
            <text key={l + i} x={X0 + pas * (i + 0.5)} y={Y0 + 44} textAnchor="middle" fill={C.gris} fontFamily={SANS} fontSize={labels.length > 6 ? 18 : 22}>{l}</text>
          ))}
        </svg>
      )}
      {s.type === 'pie' && (
        <div style={{ position: 'absolute', left: 900, right: 90, top: 330, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {labels.map((l, i) => (
            <div key={l + i} style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: t(f, 10 + i * 4, 22 + i * 4) }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: PALETTE[i % PALETTE.length] }} />
              <div style={{ fontSize: 28, flex: 1 }}>{l}</div>
              <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700 }}>{fmt(valeurs[i])}</div>
            </div>
          ))}
        </div>
      )}
      {s.note && (
        <Entre debut={Math.round(dv * FPS * 0.3)} style={{ position: 'absolute', left: 90, right: 90, top: 860 }}>
          <div style={{ fontSize: 22, color: C.gris, lineHeight: 1.45 }}>{s.note}</div>
        </Entre>
      )}
    </>
  );
}

const GABARITS: Record<string, (g: G) => React.ReactElement> = {
  texte: Texte, grille: Grille, graphique: Graphique,
  ouverture: Ouverture, chapitre: Chapitre, definition: Definition, pays: Pays, croissance: Croissance, stats: Stats,
  fraction: Fraction, droits: Droits, offre: Offre, seance: Seance, indices: Indices, flux: Flux, tableau: Tableau,
  profil: Profil, etapes: Etapes, pieges: Pieges, idees: Idees, secteurs: Secteurs, fin: Fin,
};

export default function AcademyLecon({ plan, section }: Props) {
  if (!plan) return <AbsoluteFill style={{ background: C.fond }} />;
  let debut = 0;
  return (
    <AbsoluteFill style={{ background: C.fond }}>
      {scenesRendues(plan, section).map(({ s, sec }) => {
        const teinte = (TYPES[sec.type] ?? TYPES.definition).teinte;
        const duree = dureeScene(plan, s);
        const from = debut;
        debut += duree;
        const Gabarit = GABARITS[s.gabarit];
        if (!Gabarit) throw new Error(`Gabarit inconnu : ${s.gabarit} (scène ${s.id})`);
        return (
          <Sequence key={s.id} from={from} durationInFrames={duree} name={s.id}>
            <Audio src={staticFile(`academy/${plan.id}/${s.id}.mp3`)} />
            <Ambiance teinte={teinte} />
            <Cadre duree={duree}>
              <Habillage plan={plan} sec={sec} rang={sec.scenes.indexOf(s)} nb={sec.scenes.length} teinte={teinte} duree={duree} />
              <Gabarit s={s} dv={plan.durees[s.id]} teinte={teinte} plan={plan} sec={sec} />
            </Cadre>
            <Balayage teinte={teinte} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
