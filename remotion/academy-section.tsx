import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from 'remotion';
import { MONO, SANS, SERIF } from './polices';
import { C, Entre, Fond, FPS, Logo, instant, t } from './ecosysteme';

/**
 * Vidéo motion design d'UNE section de l'Academy, 16:9 (elle s'insère dans la
 * page de leçon), voix off.
 *
 * Source unique : academy/<section>.json porte les textes affichés ET la voix.
 * academy-voix.mjs en tire une piste par scène et écrit le plan complet, durées
 * mesurées comprises, dans public/academy/<section>/plan.json — que lit
 * calculateMetadata. La durée d'une scène est celle de sa voix, plus une
 * respiration ; un élément apparaît quand la voix prononce son mot.
 *
 * Chaque gabarit n'affiche que des chiffres présents dans le JSON, eux-mêmes
 * repris de la leçon publiée. Aucun n'est calculé ici, sauf les hauteurs de
 * barres, tracées sur une seule échelle.
 */

type Stat = { label: string; valeur: string; unite: string; detail: string; mot: string };
type SceneA = {
  id: string;
  gabarit: 'titre' | 'definition' | 'pays' | 'croissance' | 'stats' | 'fin';
  voix: string;
  titre?: string;
  sigle?: [string, string][];
  phrase?: string;
  publics?: string[];
  chute?: string;
  pays?: string[];
  superviseur?: string;
  superviseurNom?: string;
  label?: string;
  unite?: string;
  depart?: { annee: string; valeur: number };
  arrivee?: { annee: string; valeur: number };
  multiple?: string;
  variation?: string;
  acceleration?: string;
  stats?: Stat[];
  retenir?: string;
};
export type PlanAcademy = {
  section: string;
  cours: string;
  lecon: string;
  type: string;
  scenes: SceneA[];
  durees: Record<string, number>;
};
type Props = { section: string; plan: PlanAcademy | null };

const RESPIRATION = 0.8;
const QUEUE_FIN = 30;

const dureeScene = (plan: PlanAcademy, s: SceneA) =>
  Math.ceil((plan.durees[s.id] + RESPIRATION) * FPS) + (s.gabarit === 'fin' ? QUEUE_FIN : 0);

export const calculerAcademy: CalculateMetadataFunction<Props> = async ({ props }) => {
  const plan = (await (await fetch(staticFile(`academy/${props.section}/plan.json`))).json()) as PlanAcademy;
  const total = plan.scenes.reduce((a, s) => a + dureeScene(plan, s), 0);
  return { durationInFrames: total, props: { ...props, plan } };
};

/** Teinte et libellé par type de section, comme les badges de la page de leçon. */
const TYPES: Record<string, { label: string; teinte: string }> = {
  definition: { label: 'Définition', teinte: C.cyan },
  importance: { label: 'Pourquoi c’est important', teinte: '#F0B23A' },
  cas: { label: 'Cas réel BRVM', teinte: '#3fe18b' },
  piege: { label: 'Pièges fréquents', teinte: '#ff6b6b' },
  lexique: { label: 'Lexique', teinte: '#B69BF0' },
  retenir: { label: 'À retenir', teinte: '#B69BF0' },
};

/** Entier au format français, espace fine insécable entre les milliers. */
const entier = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ── Habillage commun ────────────────────────────────────────────────────────
function Habillage({ plan, teinte, rang }: { plan: PlanAcademy; teinte: string; rang: number }) {
  return (
    <>
      <div style={{ position: 'absolute', top: 56, left: 90, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Logo taille={46} />
        <span style={{ fontFamily: MONO, fontSize: 21, letterSpacing: '.3em', fontWeight: 600 }}>WESTBOURSE</span>
        <span style={{ fontFamily: MONO, fontSize: 21, letterSpacing: '.3em', color: teinte }}>ACADEMY</span>
      </div>
      <div style={{ position: 'absolute', top: 64, right: 90, fontFamily: MONO, fontSize: 20, letterSpacing: '.12em', color: C.sourd }}>
        {plan.cours.toUpperCase()}
      </div>
      <div style={{ position: 'absolute', bottom: 54, left: 90, right: 90, display: 'flex', gap: 10 }}>
        {plan.scenes.map((s, i) => (
          <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= rang ? teinte : C.bord, opacity: i <= rang ? 0.9 : 1 }} />
        ))}
      </div>
    </>
  );
}

function Cadre({ duree, children }: { duree: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const o = Math.min(t(f, 0, 10), t(f, duree - 10, duree, 1, 0));
  return <AbsoluteFill style={{ opacity: o, color: C.blanc, fontFamily: SANS }}>{children}</AbsoluteFill>;
}

/** Instant (en images) où la voix de la scène prononce `mot`, avancé de quelques images. */
const quand = (s: SceneA, dv: number, mot: string, avance = 4) => Math.max(6, instant(s.voix, mot, dv) - avance);

// ── Gabarits ────────────────────────────────────────────────────────────────
function Titre({ s, dv, plan, teinte }: { s: SceneA; dv: number; plan: PlanAcademy; teinte: string }) {
  const f = useCurrentFrame();
  const [avant, apres] = (s.titre ?? '').split(/,\s*/);
  const tCasino = quand(s, dv, 'pas un casino', 2);
  const barre = t(f, tCasino + 8, tCasino + 22);
  const type = TYPES[plan.type] ?? TYPES.definition;
  return (
    <div style={{ position: 'absolute', left: 90, right: 90, top: 250 }}>
      <Entre debut={2}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '10px 22px', borderRadius: 999, border: `1px solid ${teinte}88`, background: `${teinte}1a`, color: teinte, fontFamily: MONO, fontSize: 22, letterSpacing: '.22em' }}>
          {type.label.toUpperCase()}
        </div>
      </Entre>
      <Entre debut={8}><div style={{ fontSize: 30, color: C.gris, marginTop: 34 }}>{plan.lecon}</div></Entre>
      <Entre debut={quand(s, dv, 'infrastructure')}>
        <div style={{ fontFamily: SERIF, fontSize: 112, fontWeight: 600, lineHeight: 1.02, marginTop: 30 }}>{avant},</div>
      </Entre>
      {apres && (
        <Entre debut={tCasino}>
          <div style={{ fontFamily: SERIF, fontSize: 112, fontWeight: 600, lineHeight: 1.1, color: C.gris }}>
            {apres.slice(0, apres.lastIndexOf(' ') + 1)}
            <span style={{ position: 'relative', display: 'inline-block' }}>
              {apres.slice(apres.lastIndexOf(' ') + 1)}
              <span style={{ position: 'absolute', left: -6, right: -6, top: '55%', height: 8, borderRadius: 4, background: '#ff6b6b', transformOrigin: 'left', transform: `scaleX(${barre})` }} />
            </span>
          </div>
        </Entre>
      )}
    </div>
  );
}

function Definition({ s, dv, teinte }: { s: SceneA; dv: number; teinte: string }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tRegl = quand(s, dv, 'strictement');
  return (
    <>
      <div style={{ position: 'absolute', left: 90, top: 250, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {(s.sigle ?? []).map(([l, mot], i) => {
          const p = spring({ frame: f - 4 - i * 7, fps, config: { damping: 16, stiffness: 130 } });
          return (
            <div key={l} style={{ display: 'flex', alignItems: 'baseline', gap: 26, opacity: p, transform: `translateX(${(1 - p) * -50}px)` }}>
              <span style={{ fontFamily: SERIF, fontSize: 118, fontWeight: 700, color: teinte, width: 124, lineHeight: 1 }}>{l}</span>
              <span style={{ fontSize: 44, color: C.gris }}>{mot}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 900, right: 90, top: 280 }}>
        <Entre debut={quand(s, dv, 'système')}>
          <div style={{ fontFamily: SERIF, fontSize: 58, fontWeight: 600, lineHeight: 1.12 }}>
            {s.phrase}
            <div style={{ height: 6, marginTop: 14, width: 470, borderRadius: 3, background: teinte, transformOrigin: 'left', transform: `scaleX(${t(f, tRegl, tRegl + 16)})` }} />
          </div>
        </Entre>
        <Entre debut={quand(s, dv, "n'importe qui")}>
          <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: '.2em', color: C.sourd, marginTop: 64 }}>OUVERT À TOUS</div>
        </Entre>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 20 }}>
          {(s.publics ?? []).map((p) => {
            const d = quand(s, dv, p.toLowerCase());
            const k = spring({ frame: f - d, fps, config: { damping: 14, stiffness: 160 } });
            return (
              <div key={p} style={{ padding: '14px 26px', borderRadius: 999, background: C.surface, border: `1px solid ${teinte}66`, fontSize: 32, opacity: k, transform: `scale(${0.7 + k * 0.3})` }}>{p}</div>
            );
          })}
        </div>
        <Entre debut={quand(s, dv, 'investir')}>
          <div style={{ fontSize: 36, color: C.gris, marginTop: 50, lineHeight: 1.35 }}>
            → {s.chute}
          </div>
        </Entre>
      </div>
    </>
  );
}

function Pays({ s, dv, teinte }: { s: SceneA; dv: number; teinte: string }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pays = s.pays ?? [];
  const CX = 960, CY = 600, RX = 640, RY = 250, W = 300, H = 84;
  const tHuit = quand(s, dv, 'huit pays');
  const tSup = quand(s, dv, 'supervisé');
  const positions = pays.map((_, i) => {
    const a = -Math.PI / 2 + (i / pays.length) * Math.PI * 2;
    return { x: CX + Math.cos(a) * RX, y: CY + Math.sin(a) * RY };
  });
  const hub = spring({ frame: f - tSup, fps, config: { damping: 15, stiffness: 120 } });
  return (
    <>
      <Entre debut={4} style={{ position: 'absolute', top: 170, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ fontFamily: SERIF, fontSize: 64, fontWeight: 600 }}>{s.titre}</div>
      </Entre>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {positions.map((p, i) => (
          <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={teinte} strokeOpacity={0.45} strokeWidth={2.5}
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t(f, tSup + 4 + i * 2, tSup + 18 + i * 2)} />
        ))}
      </svg>
      {pays.map((nom, i) => {
        const k = spring({ frame: f - tHuit - i * 4, fps, config: { damping: 15, stiffness: 150 } });
        const p = positions[i];
        return (
          <div key={nom} style={{ position: 'absolute', left: p.x - W / 2, top: p.y - H / 2, width: W, height: H, borderRadius: 18, background: C.surface, border: `1px solid ${C.bord}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 500, opacity: k, transform: `scale(${0.6 + k * 0.4})` }}>
            {nom}
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: CX - 230, top: CY - 80, width: 460, height: 160, borderRadius: 24, background: `linear-gradient(160deg, ${teinte}33, ${C.surface})`, border: `2px solid ${teinte}`, boxShadow: `0 0 60px ${teinte}33`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: hub, transform: `scale(${0.8 + hub * 0.2})` }}>
        <div style={{ fontFamily: MONO, fontSize: 50, fontWeight: 700, color: teinte }}>{s.superviseur}</div>
        <div style={{ fontSize: 21, color: C.gris, marginTop: 8, textAlign: 'center', padding: '0 20px' }}>{s.superviseurNom}</div>
      </div>
    </>
  );
}

function Croissance({ s, dv, teinte }: { s: SceneA; dv: number; teinte: string }) {
  const f = useCurrentFrame();
  const dep = s.depart!, arr = s.arrivee!;
  const t0 = quand(s, dv, dep.annee), t1 = quand(s, dv, arr.annee);
  const tMult = quand(s, dv, 'multipliée'), tAcc = quand(s, dv, 'accélérée');
  // Une seule échelle pour les deux barres : la plus haute vaut HMAX.
  const HMAX = 540, BASE = 900;
  const hDep = (dep.valeur / arr.valeur) * HMAX;
  const croit = t(f, t1 - 30, t1 + 6);
  const compteur = dep.valeur + (arr.valeur - dep.valeur) * croit;
  const barre = (x: number, h: number, annee: string, valeur: string, op: number, couleur: string) => (
    <div style={{ position: 'absolute', left: x, top: BASE - h, width: 200, height: h, opacity: op }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '14px 14px 0 0', background: `linear-gradient(180deg, ${couleur}, ${couleur}33)` }} />
      <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, textAlign: 'center', marginBottom: 14, fontFamily: MONO, fontSize: 30, fontWeight: 700 }}>{valeur}</div>
      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, textAlign: 'center', marginTop: 16, fontFamily: MONO, fontSize: 28, color: C.gris }}>{annee}</div>
    </div>
  );
  return (
    <>
      <div style={{ position: 'absolute', left: 90, top: 200, width: 820 }}>
        <Entre debut={2}><div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: '.22em', color: teinte }}>{(s.label ?? '').toUpperCase()}</div></Entre>
        <Entre debut={4}>
          <div style={{ fontFamily: MONO, fontSize: 132, fontWeight: 700, marginTop: 20, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {entier(compteur)}
          </div>
          <div style={{ fontSize: 36, color: C.gris, marginTop: 14 }}>{s.unite} · {croit < 1 ? dep.annee : arr.annee}</div>
        </Entre>
        <Entre debut={tMult}>
          <div style={{ display: 'flex', gap: 18, marginTop: 70 }}>
            <div style={{ padding: '16px 28px', borderRadius: 16, background: `${teinte}22`, border: `1px solid ${teinte}`, fontFamily: MONO, fontSize: 40, fontWeight: 700, color: teinte }}>{s.multiple}</div>
            <div style={{ padding: '16px 28px', borderRadius: 16, background: C.surface, border: `1px solid ${C.bord}`, fontFamily: MONO, fontSize: 40, fontWeight: 700 }}>{s.variation}</div>
          </div>
        </Entre>
        <Entre debut={tAcc}>
          <div style={{ marginTop: 50, fontFamily: MONO, fontSize: 22, letterSpacing: '.2em', color: C.sourd }}>ACCÉLÉRATION RÉCENTE</div>
          <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 40, fontWeight: 700, color: '#3fe18b' }}>{s.acceleration}</div>
        </Entre>
      </div>
      <div style={{ position: 'absolute', left: 1080, right: 90, top: BASE, height: 2, background: C.bord }} />
      {barre(1180, Math.max(6, hDep), dep.annee, entier(dep.valeur), t(f, t0 - 4, t0 + 10), C.sourd)}
      {barre(1500, HMAX * croit, arr.annee, entier(arr.valeur), t(f, t1 - 30, t1 - 20), teinte)}
    </>
  );
}

function Stats({ s, dv, teinte }: { s: SceneA; dv: number; teinte: string }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stats = s.stats ?? [];
  return (
    <>
    {s.titre && (
      <Entre debut={2} style={{ position: 'absolute', top: 200, left: 90, right: 90 }}>
        <div style={{ fontFamily: SERIF, fontSize: 64, fontWeight: 600 }}>{s.titre}</div>
      </Entre>
    )}
    <div style={{ position: 'absolute', left: 90, right: 90, top: 360, display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 28 }}>
      {stats.map((st) => {
        const d = quand(s, dv, st.mot, 8);
        const k = spring({ frame: f - d, fps, config: { damping: 16, stiffness: 130 } });
        const cible = Number(st.valeur.replace(/\s/g, ''));
        const n = Number.isFinite(cible) ? entier(cible * t(f, d, d + 22)) : st.valeur;
        return (
          <div key={st.label} style={{ padding: '40px 34px', borderRadius: 26, background: `linear-gradient(170deg, ${teinte}1f, ${C.surface} 55%)`, border: `1px solid ${teinte}55`, minHeight: 440, display: 'flex', flexDirection: 'column', opacity: k, transform: `translateY(${(1 - k) * 60}px)` }}>
            <div style={{ fontFamily: MONO, fontSize: 21, letterSpacing: '.2em', color: teinte }}>{st.label.toUpperCase()}</div>
            <div style={{ fontFamily: MONO, fontSize: st.valeur.length > 3 ? 92 : 128, fontWeight: 700, marginTop: 34, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
            {st.unite && <div style={{ fontSize: 32, color: C.gris, marginTop: 10 }}>{st.unite}</div>}
            <div style={{ fontSize: 27, color: C.gris, marginTop: 'auto', lineHeight: 1.35 }}>{st.detail}</div>
          </div>
        );
      })}
    </div>
    </>
  );
}

function Fin({ s, teinte }: { s: SceneA; teinte: string }) {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 220px' }}>
      <Entre debut={2}><div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: '.3em', color: teinte }}>À RETENIR</div></Entre>
      <Entre debut={10}><div style={{ fontFamily: SERIF, fontSize: 70, fontWeight: 600, lineHeight: 1.15, marginTop: 30, textWrap: 'balance' } as React.CSSProperties}>{s.retenir}</div></Entre>
      <div style={{ marginTop: 90, display: 'flex', alignItems: 'center', gap: 20, opacity: t(f, 40, 60) }}>
        <Logo taille={64} prog={t(f, 40, 70)} />
        <span style={{ fontFamily: MONO, fontSize: 30, letterSpacing: '.32em' }}>WESTBOURSE</span>
      </div>
      <Entre debut={60}><div style={{ fontSize: 22, color: C.sourd, marginTop: 34 }}>Contenu pédagogique · pas un conseil en investissement · chiffres de la leçon, 2026</div></Entre>
    </div>
  );
}

export default function AcademySection({ plan }: Props) {
  if (!plan) return <AbsoluteFill style={{ background: C.fond }} />;
  const teinte = (TYPES[plan.type] ?? TYPES.definition).teinte;
  let debut = 0;
  return (
    <AbsoluteFill style={{ background: C.fond }}>
      {plan.scenes.map((s, rang) => {
        const dv = plan.durees[s.id];
        const duree = dureeScene(plan, s);
        const from = debut;
        debut += duree;
        const corps =
          s.gabarit === 'titre' ? <Titre s={s} dv={dv} plan={plan} teinte={teinte} />
          : s.gabarit === 'definition' ? <Definition s={s} dv={dv} teinte={teinte} />
          : s.gabarit === 'pays' ? <Pays s={s} dv={dv} teinte={teinte} />
          : s.gabarit === 'croissance' ? <Croissance s={s} dv={dv} teinte={teinte} />
          : s.gabarit === 'stats' ? <Stats s={s} dv={dv} teinte={teinte} />
          : <Fin s={s} teinte={teinte} />;
        return (
          <Sequence key={s.id} from={from} durationInFrames={duree} name={s.id}>
            <Audio src={staticFile(`academy/${plan.section}/${s.id}.mp3`)} />
            <Cadre duree={duree}>
              <Fond teinte={teinte} />
              <Habillage plan={plan} teinte={teinte} rang={rang} />
              {corps}
            </Cadre>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
