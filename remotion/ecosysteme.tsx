import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from 'remotion';
import { MONO, SANS, SERIF } from './polices';
import CONTENU from './ecosysteme.json';

/**
 * « Qui fait quoi sur le marché financier régional de l'UMOA » — vidéo
 * pédagogique verticale 1080×1920, voix off.
 *
 * Source unique : ecosysteme.json porte les textes affichés ET la voix. La
 * durée de chaque scène est celle de sa piste de voix (durees.json, écrit par
 * ecosysteme-voix.mjs), plus une respiration. Un acteur apparaît au moment où
 * la voix prononce son nom : sa position dans le texte lu donne l'instant.
 *
 * Contenu pédagogique : aucun chiffre, aucune recommandation.
 */

type Acteur = { sigle: string; nom: string; surnom?: string; roles: string[] };
type SceneC = { id: string; voix: string; famille?: string; numero?: string; acteurs?: Acteur[] };
const SCENES = CONTENU.scenes as SceneC[];

export const FPS = 30;
const RESPIRATION = 0.9; // secondes de silence après chaque phrase

type Durees = Record<string, number>;
export const calculerEcosysteme: CalculateMetadataFunction<{ durees: Durees | null }> = async () => {
  const durees = (await (await fetch(staticFile('ecosysteme/durees.json'))).json()) as Durees;
  const total = SCENES.reduce((a, s) => a + Math.ceil((durees[s.id] + RESPIRATION) * FPS), 0);
  return { durationInFrames: total + 30, props: { durees } };
};

// ── Charte ──────────────────────────────────────────────────────────────────
const C = {
  fond: '#030303', surface: '#0a1417', bord: 'rgba(255,255,255,.12)',
  blanc: '#FCFCFC', gris: '#A9BFC5', sourd: '#7A8A90', teal: '#16B6A4', cyan: '#56D7FD',
};
/** Une couleur par famille d'acteurs, comme les niveaux de la carte d'origine. */
const TEINTE: Record<string, string> = {
  regulation: '#F0B23A', infrastructures: '#56D7FD', intermediaires: '#3fe18b', participants: '#B69BF0',
};

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const t = (f: number, a: number, b: number, de = 0, a2 = 1) =>
  interpolate(f, [a, b], [de, a2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE });

/** Instant (en images) où la voix prononce `mot`, par sa position dans le texte. */
function instant(voix: string, mot: string, duree: number): number {
  const i = voix.toLowerCase().indexOf(mot.toLowerCase());
  return i < 0 ? 0 : Math.round((i / voix.length) * duree * FPS);
}

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

function Fond({ teinte = C.cyan }: { teinte?: string }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.fond }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 120% 55% at 50% 18%, ${teinte}22 0%, transparent 60%)` }} />
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.07) 1.2px, transparent 1.2px)', backgroundSize: '44px 44px', backgroundPosition: `0 ${-f * 0.3}px` }} />
    </AbsoluteFill>
  );
}

function Marque() {
  return (
    <div style={{ position: 'absolute', top: 90, left: 70, display: 'flex', alignItems: 'center', gap: 18 }}>
      <Logo taille={60} />
      <span style={{ fontFamily: MONO, fontSize: 26, letterSpacing: '.32em', fontWeight: 600, color: C.blanc }}>WESTBOURSE</span>
    </div>
  );
}

function Entre({ debut, children, dy = 36, style }: { debut: number; children: React.ReactNode; dy?: number; style?: React.CSSProperties }) {
  const f = useCurrentFrame();
  const p = t(f, debut, debut + 16);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * dy}px)`, filter: `blur(${(1 - p) * 8}px)`, ...style }}>{children}</div>;
}

function Scene({ duree, children }: { duree: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const o = Math.min(t(f, 0, 10), t(f, duree - 10, duree, 1, 0));
  return <AbsoluteFill style={{ opacity: o, color: C.blanc, fontFamily: SANS }}>{children}</AbsoluteFill>;
}

// ── Bloc « acteur + rôles » ─────────────────────────────────────────────────
const CARTE_X = 70, CARTE_W = 400, FEUILLE_X = 540, FEUILLE_W = 470, FEUILLE_H = 104, ECART = 22;

function BlocActeur({ a, teinte, y, debut, fin }: { a: Acteur; teinte: string; y: number; debut: number; fin: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = a.roles.length;
  const hauteur = n * FEUILLE_H + (n - 1) * ECART;
  const carteH = a.surnom ? 250 : 210;
  const carteY = y + hauteur / 2 - carteH / 2;
  const ancreX = CARTE_X + CARTE_W, ancreY = carteY + carteH / 2;
  const s = spring({ frame: f - debut, fps, config: { damping: 16, stiffness: 120 } });
  const pas = Math.max(8, (fin - debut - 24) / n);
  return (
    <>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {a.roles.map((_, i) => {
          const d0 = debut + 14 + i * pas;
          const ly = y + i * (FEUILLE_H + ECART) + FEUILLE_H / 2;
          const mx = (ancreX + FEUILLE_X) / 2;
          return (
            <path key={i} d={`M${ancreX} ${ancreY} C${mx} ${ancreY} ${mx} ${ly} ${FEUILLE_X} ${ly}`} fill="none" stroke={teinte} strokeOpacity={0.6} strokeWidth={3}
              pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t(f, d0, d0 + 12)} />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', left: CARTE_X, top: carteY, width: CARTE_W, height: carteH, borderRadius: 22, background: `linear-gradient(160deg, ${teinte}26, ${C.surface})`, border: `2px solid ${teinte}88`, padding: '26px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: s, transform: `scale(${0.85 + s * 0.15})`, boxShadow: `0 0 50px ${teinte}22` }}>
        <div style={{ fontFamily: MONO, fontSize: a.sigle.length > 9 ? 44 : 58, fontWeight: 700, color: teinte, lineHeight: 1 }}>{a.sigle}</div>
        <div style={{ fontSize: 25, color: C.gris, marginTop: 14, lineHeight: 1.3 }}>{a.nom}</div>
        {a.surnom && <div style={{ alignSelf: 'flex-start', marginTop: 14, padding: '6px 14px', borderRadius: 999, background: `${teinte}22`, color: teinte, fontSize: 22, fontWeight: 600 }}>{a.surnom}</div>}
      </div>
      {a.roles.map((r, i) => {
        const d0 = debut + 20 + i * pas;
        const p = t(f, d0, d0 + 14);
        return (
          <div key={r} style={{ position: 'absolute', left: FEUILLE_X, top: y + i * (FEUILLE_H + ECART), width: FEUILLE_W, height: FEUILLE_H, borderRadius: 16, background: `linear-gradient(90deg, ${teinte}14, ${C.surface} 60%)`, border: `1px solid ${teinte}55`, display: 'flex', alignItems: 'center', padding: '0 24px', fontSize: 30, lineHeight: 1.15, opacity: p, transform: `translateX(${(1 - p) * 40}px)` }}>
            {r}
          </div>
        );
      })}
    </>
  );
}

function SceneFamille({ s, duree, dureeVoix }: { s: SceneC; duree: number; dureeVoix: number }) {
  const teinte = TEINTE[s.id] ?? C.cyan;
  const acteurs = s.acteurs ?? [];
  const debuts = acteurs.map((a) => Math.max(12, instant(s.voix, a.sigle.split(' ')[0], dureeVoix) - 6));
  const blocY = acteurs.length === 1 ? [780] : [610, 1210];
  return (
    <Scene duree={duree}>
      <Fond teinte={teinte} />
      <Marque />
      <div style={{ position: 'absolute', top: 240, left: 70, right: 70 }}>
        <Entre debut={0}><div style={{ fontFamily: MONO, fontSize: 30, letterSpacing: '.24em', color: teinte }}>{s.numero} / 04</div></Entre>
        <Entre debut={5}><div style={{ fontFamily: SERIF, fontSize: 84, fontWeight: 600, lineHeight: 1.02, marginTop: 14 }}>{s.famille}</div></Entre>
      </div>
      {acteurs.map((a, i) => (
        <BlocActeur key={a.sigle} a={a} teinte={teinte} y={blocY[i]} debut={debuts[i]} fin={i + 1 < acteurs.length ? debuts[i + 1] : Math.round(dureeVoix * FPS)} />
      ))}
    </Scene>
  );
}

function Intro({ s, duree }: { s: SceneC; duree: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const familles = SCENES.filter((x) => x.famille);
  const PAYS = ['Bénin', 'Burkina Faso', "Côte d'Ivoire", 'Guinée-Bissau', 'Mali', 'Niger', 'Sénégal', 'Togo'];
  return (
    <Scene duree={duree}>
      <Fond />
      <Marque />
      <div style={{ position: 'absolute', top: 360, left: 70, right: 70 }}>
        <Entre debut={4}><div style={{ fontFamily: SERIF, fontSize: 120, fontWeight: 600, lineHeight: 0.98 }}>Qui fait quoi&nbsp;?</div></Entre>
        <Entre debut={14}><div style={{ fontSize: 44, color: C.gris, marginTop: 26, lineHeight: 1.3 }}>sur le marché financier régional de l’UMOA</div></Entre>
        <div style={{ marginTop: 80, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {familles.map((x, i) => {
            const p = spring({ frame: f - 40 - i * 8, fps, config: { damping: 15, stiffness: 130 } });
            const c = TEINTE[x.id];
            return (
              <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '26px 30px', borderRadius: 20, background: `linear-gradient(90deg, ${c}18, ${C.surface} 55%)`, border: `1px solid ${c}55`, opacity: p, transform: `translateX(${(1 - p) * -60}px)` }}>
                <span style={{ fontFamily: MONO, fontSize: 30, color: c }}>{x.numero}</span>
                <span style={{ fontSize: 40, fontWeight: 600 }}>{x.famille}</span>
              </div>
            );
          })}
        </div>
        <Entre debut={120}>
          <div style={{ marginTop: 70, fontFamily: MONO, fontSize: 24, lineHeight: 1.7, color: C.sourd, letterSpacing: '.04em' }}>
            8 pays · {PAYS.join(' · ')}
          </div>
        </Entre>
      </div>
    </Scene>
  );
}

function Recap({ duree }: { duree: number }) {
  const f = useCurrentFrame();
  const familles = SCENES.filter((x) => x.famille);
  const X0 = 110, Y0 = 500, PAS = 330;
  return (
    <Scene duree={duree}>
      <Fond />
      <Marque />
      <Entre debut={0} style={{ position: 'absolute', top: 230, left: 70, right: 70 }}>
        <div style={{ padding: '26px 30px', borderRadius: 22, background: `linear-gradient(135deg, ${C.cyan}33, ${C.surface})`, border: `2px solid ${C.cyan}88`, fontFamily: SERIF, fontSize: 48, fontWeight: 600, textAlign: 'center' }}>
          Marché financier régional de l’UMOA
        </div>
      </Entre>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <line x1={X0} y1={Y0 - 40} x2={X0} y2={Y0 + PAS * 3 + 60} stroke={C.bord} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t(f, 6, 40)} />
        {familles.map((x, i) => (
          <line key={x.id} x1={X0} y1={Y0 + 60 + i * PAS} x2={X0 + 60} y2={Y0 + 60 + i * PAS} stroke={TEINTE[x.id]} strokeWidth={4} opacity={t(f, 14 + i * 8, 24 + i * 8)} />
        ))}
      </svg>
      {familles.map((x, i) => {
        const c = TEINTE[x.id];
        return (
          <Entre key={x.id} debut={14 + i * 8} style={{ position: 'absolute', left: X0 + 70, right: 70, top: Y0 + i * PAS }}>
            <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: '.2em', color: c }}>{x.numero} · {x.famille?.toUpperCase()}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
              {(x.acteurs ?? []).map((a) => (
                <div key={a.sigle} style={{ padding: '16px 24px', borderRadius: 16, background: `${c}1c`, border: `1px solid ${c}77`, fontFamily: MONO, fontSize: 36, fontWeight: 700, color: c }}>{a.sigle}</div>
              ))}
            </div>
          </Entre>
        );
      })}
    </Scene>
  );
}

function Fin({ duree }: { duree: number }) {
  const f = useCurrentFrame();
  return (
    <Scene duree={duree}>
      <Fond />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 80px' }}>
        <Logo taille={170} prog={t(f, 0, 28)} />
        <Entre debut={10}><div style={{ fontFamily: MONO, fontSize: 48, letterSpacing: '.34em', marginTop: 36 }}>WESTBOURSE</div></Entre>
        <Entre debut={18}><div style={{ fontFamily: SERIF, fontSize: 64, fontWeight: 600, marginTop: 60, lineHeight: 1.1 }}>Pour investir en direct&nbsp;: une SGI agréée</div></Entre>
        <Entre debut={30}><div style={{ fontSize: 38, color: C.gris, marginTop: 30 }}>Comparez-les sur</div></Entre>
        <Entre debut={36}><div style={{ fontFamily: MONO, fontSize: 40, color: C.cyan, marginTop: 12 }}>westbourse.com/comparateur-sgi</div></Entre>
        <Entre debut={48}><div style={{ fontSize: 24, color: C.sourd, marginTop: 90 }}>Contenu pédagogique · pas un conseil en investissement</div></Entre>
      </div>
    </Scene>
  );
}

export default function Ecosysteme({ durees }: { durees: Durees | null }) {
  if (!durees) return <AbsoluteFill style={{ background: C.fond }} />;
  let debut = 0;
  return (
    <AbsoluteFill style={{ background: C.fond }}>
      {SCENES.map((s) => {
        const dv = durees[s.id];
        const duree = Math.ceil((dv + RESPIRATION) * FPS) + (s.id === 'fin' ? 30 : 0);
        const from = debut;
        debut += duree - (s.id === 'fin' ? 30 : 0);
        const corps =
          s.id === 'intro' ? <Intro s={s} duree={duree} />
          : s.id === 'recap' ? <Recap duree={duree} />
          : s.id === 'fin' ? <Fin duree={duree} />
          : <SceneFamille s={s} duree={duree} dureeVoix={dv} />;
        return (
          <Sequence key={s.id} from={from} durationInFrames={duree} name={s.id}>
            <Audio src={staticFile(`ecosysteme/${s.id}.mp3`)} />
            {corps}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
