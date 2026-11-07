import React from 'react';
import {
  AbsoluteFill, Audio, Easing, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig,
  type CalculateMetadataFunction,
} from 'remotion';
import './polices';
import { FPS, THEMES, fr, sg, t, ton } from './seance-modeles/theme';
import { Logo, Studio, Verre, Vignette, type Fiche } from './seance-modeles/elements';
import { DUREE_SIGNATURE, Signature } from './seance-modeles/signature';

/**
 * Vidéo de séance, version SITE — 1920×1080, habillage « verre ».
 *
 * MÊME LECTURE QUE LA VERTICALE. Aucune donnée n'est lue ici : tout vient de
 * public/seance/seance.json et de voix.mp3, écrits par video/genere.mjs. Le
 * même plan (début et durée de chaque phrase, mesurés sur la voix) cadence les
 * deux formats : la version 16:9 dit et montre exactement la même séance que
 * celle partie sur les réseaux, quel que soit le modèle vertical du jour.
 *
 * Les règles des scènes verticales valent ici :
 *  - AUCUN CHIFFRE NE DÉFILE : un nombre apparaît à sa valeur finale ; seules
 *    les barres, arcs et courbes (des proportions) se remplissent ;
 *  - AUCUNE CAUSALITÉ : on montre ce qui s'est passé, jamais pourquoi ;
 *  - une donnée absente fait disparaître son bloc, rien n'est complété.
 */

const th = THEMES.verre;
const QUEUE = 45 + DUREE_SIGNATURE;
const W = 1920;
const GAUCHE = 120;

export const calculerSeanceSite: CalculateMetadataFunction<{ fiche: Fiche | null }> = async () => {
  const r = await fetch(staticFile('seance/seance.json'));
  const fiche = (await r.json()) as Fiche;
  return { durationInFrames: Math.ceil(fiche.duree_s * FPS) + QUEUE, props: { fiche } };
};

interface PropsScene { fiche: Fiche; duree: number }
const nom = (fiche: Fiche, code: string) => fiche.video.noms[code] ?? code;

/* ── Habillage commun ─────────────────────────────────────────────────── */

/** Entrée d'un élément : bascule en perspective, depuis un léger flou. */
function Entre({ debut, children, style }: { debut: number; children: React.ReactNode; style?: React.CSSProperties }) {
  const f = useCurrentFrame();
  const p = t(f, debut, debut + 20);
  return (
    <div style={{ opacity: p, transform: `perspective(1600px) translateY(${(1 - p) * 40}px) rotateX(${(1 - p) * 18}deg)`, filter: `blur(${(1 - p) * 8}px)`, ...style }}>
      {children}
    </div>
  );
}

/** Panneau de verre qui bascule en place puis laisse passer un reflet. */
function Panneau({ debut = 0, style, children, rayon = 36 }: { debut?: number; style?: React.CSSProperties; children: React.ReactNode; rayon?: number }) {
  const f = useCurrentFrame();
  const p = t(f, debut, debut + 26);
  return (
    <div style={{ opacity: Math.min(1, p * 1.4), transform: `perspective(1800px) translateY(${(1 - p) * 70}px) rotateX(${(1 - p) * 18}deg) scale(${0.94 + 0.06 * p})`, ...style }}>
      <Verre rayon={rayon} reflet={t(f, debut + 18, debut + 52)} style={{ height: '100%', padding: '40px 44px' }}>{children}</Verre>
    </div>
  );
}

function Etiquette({ texte, couleur = th.accent }: { texte: string; couleur?: string }) {
  return <div style={{ fontFamily: th.chiffre, fontSize: 24, letterSpacing: '.16em', textTransform: 'uppercase', color: couleur }}>{texte}</div>;
}

/** Enveloppe de scène : fondu, sortie glissée et floutée, lente poussée de caméra. */
function Scene({ duree, children }: { duree: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const entree = t(f, 0, 10);
  const sortie = t(f, duree - 12, duree);
  const zoom = 1 + (f / Math.max(1, duree)) * 0.02;
  return (
    <AbsoluteFill style={{
      opacity: entree * (1 - sortie), filter: sortie > 0 ? `blur(${sortie * 12}px)` : undefined,
      transform: `translateX(${-sortie * 90}px) scale(${zoom * (1 - sortie * 0.03)})`,
      color: th.encre, fontFamily: th.texte,
    }}>{children}</AbsoluteFill>
  );
}

/* ── Ouverture ────────────────────────────────────────────────────────── */
function Ouverture({ fiche }: PropsScene) {
  const f = useCurrentFrame();
  const acc = fiche.video.accroche;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <Logo th={th} taille={200} prog={t(f, 0, 30)} />
      <Entre debut={14}><div style={{ fontFamily: th.chiffre, fontSize: 26, letterSpacing: '.3em', color: th.accent, marginTop: 52 }}>SÉANCE BRVM</div></Entre>
      <Entre debut={20}><div style={{ fontFamily: th.titre, fontSize: 84, fontWeight: 600, marginTop: 12 }}>{fiche.date_fr}</div></Entre>
      {acc && <Entre debut={30}><div style={{ fontSize: 44, fontWeight: 700, marginTop: 26, maxWidth: 1300, lineHeight: 1.2 }}>{acc}</div></Entre>}
      <div style={{ display: 'flex', gap: 14, marginTop: 46 }}>
        {fiche.video.frise.map((code, i) => {
          const p = t(f, 40 + i * 3, 52 + i * 3);
          return <div key={code} style={{ opacity: p, transform: `scale(${0.7 + 0.3 * p})` }}><Vignette th={th} fiche={fiche} code={code} taille={76} /></div>;
        })}
      </div>
    </AbsoluteFill>
  );
}

/* ── Indice ───────────────────────────────────────────────────────────── */
function Indice({ fiche }: PropsScene) {
  const f = useCurrentFrame();
  const c = fiche.composite;
  const h = fiche.historique_indice;
  const fa = fiche.video.faits;
  const badges: string[] = [];
  if (fa) {
    const sens = fa.sens > 0 ? 'hausse' : 'baisse';
    if (fa.record) badges.push(`Plus forte ${sens} sur ${fa.fenetre} séances`);
    if (fa.serie >= 2 && !fa.serie_plafonnee) badges.push(`${fa.serie}e séance de ${sens} d’affilée`);
    if (fa.evolution_pct != null) badges.push(`${fa.fenetre} séances : ${sg(fa.evolution_pct)} %`);
  }
  const LW = 980, LH = 470;
  let courbe: React.ReactNode = null;
  if (h.length >= 5) {
    const vals = h.map((p) => p.valeur);
    const min = Math.min(...vals), max = Math.max(...vals);
    const X = (i: number) => 30 + (i / (vals.length - 1)) * (LW - 150);
    const Y = (v: number) => 70 + (1 - (v - min) / (max - min || 1)) * (LH - 150);
    const prog = t(f, 14, 70);
    const n = Math.max(1, Math.floor(prog * (vals.length - 1)));
    const pts = vals.slice(0, n + 1).map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
    const iMax = vals.indexOf(max), iMin = vals.indexOf(min);
    const fin = prog >= 1;
    const tete = [X(n), Y(vals[n])];
    courbe = (
      <svg width={LW - 88} height={LH - 80} viewBox={`0 0 ${LW - 88} ${LH - 80}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="ss-aire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3FE0CB" stopOpacity={0.32} /><stop offset="1" stopColor="#18B6A4" stopOpacity={0} /></linearGradient>
          <linearGradient id="ss-ligne" x1="0" x2="1"><stop offset="0" stopColor="#18B6A4" /><stop offset="1" stopColor="#7FF5E6" /></linearGradient>
        </defs>
        <text x={30} y={26} fontFamily={th.chiffre} fontSize={18} fill={th.sourd}>BRVM COMPOSITE · {vals.length} SÉANCES</text>
        <path d={`${pts} L${X(n)} ${LH - 80} L${X(0)} ${LH - 80} Z`} fill="url(#ss-aire)" />
        <path d={pts} fill="none" stroke="url(#ss-ligne)" strokeWidth={5} strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 10px #18B6A4)' }} />
        <circle cx={tete[0]} cy={tete[1]} r={9} fill="#fff" style={{ filter: 'drop-shadow(0 0 12px #3FE0CB)' }} />
        {fin && (
          <g fontFamily={th.chiffre} fontSize={20} opacity={t(f, 70, 84)}>
            <line x1={30} x2={LW - 120} y1={Y(max)} y2={Y(max)} stroke={th.haut} strokeDasharray="6 8" strokeWidth={2} />
            <text x={Math.min(X(iMax) + 14, LW - 330)} y={Y(max) - 12} fill={th.haut}>Plus haut {fr(max)}</text>
            <line x1={30} x2={LW - 120} y1={Y(min)} y2={Y(min)} stroke={th.bas} strokeDasharray="6 8" strokeWidth={2} />
            <text x={Math.min(X(iMin) + 14, LW - 330)} y={Y(min) + 30} fill={th.bas}>Plus bas {fr(min)}</text>
          </g>
        )}
      </svg>
    );
  }
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: GAUCHE, top: 250, width: 640 }}>
        <Entre debut={0}><Etiquette texte="BRVM Composite" /></Entre>
        {c ? (
          <>
            <Entre debut={4}><div style={{ fontFamily: th.titre, fontSize: 190, lineHeight: 1, marginTop: 22 }}>{fr(c.valeur)}</div></Entre>
            <Entre debut={10}>
              <div style={{ display: 'inline-flex', marginTop: 26, padding: '10px 22px', borderRadius: 14, fontFamily: th.chiffre, fontWeight: 700, fontSize: 44,
                color: ton(th, c.variation_pct), background: c.variation_pct >= 0 ? 'rgba(74,222,128,.14)' : 'rgba(248,113,113,.14)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18)' }}>
                {c.variation_pct > 0 ? '▲' : c.variation_pct < 0 ? '▼' : '■'} {sg(c.variation_pct)} %
              </div>
            </Entre>
          </>
        ) : <Entre debut={4}><div style={{ fontSize: 40, color: th.doux, marginTop: 22 }}>Indice non publié pour cette séance</div></Entre>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 34 }}>
          {badges.map((b, i) => <Entre key={b} debut={20 + i * 6}><div style={{ fontFamily: th.chiffre, fontSize: 24, color: th.doux }}>{b}</div></Entre>)}
        </div>
      </div>
      {courbe && <Panneau debut={6} style={{ position: 'absolute', left: 820, top: 220, width: LW, height: LH + 40 }}>{courbe}</Panneau>}
    </AbsoluteFill>
  );
}

/* ── Largeur : un tube de verre qui se remplit ────────────────────────── */
function Largeur({ fiche }: PropsScene) {
  const f = useCurrentFrame();
  const n = fiche.valeurs || 1;
  const segs = [
    { v: fiche.hausses, c: '#22c55e', c2: '#a7f3c4', lib: 'hausses', couleur: th.haut },
    { v: fiche.stables, c: '#4b5563', c2: '#9ca3af', lib: 'stables', couleur: th.encre },
    { v: fiche.baisses, c: '#ef4444', c2: '#fecaca', lib: 'baisses', couleur: th.bas },
  ];
  const L = W - 2 * GAUCHE;
  let x = 0;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: GAUCHE, top: 210 }}>
        <Entre debut={0}><Etiquette texte="Largeur du marché" /></Entre>
        <Entre debut={4}>
          <div style={{ fontFamily: th.titre, fontSize: 92, marginTop: 16 }}>
            <span style={{ color: th.haut }}>{fiche.hausses} hausses</span>, <span style={{ color: th.bas }}>{fiche.baisses} baisses</span>.
          </div>
        </Entre>
        <Entre debut={8}><div style={{ fontSize: 32, color: th.doux, marginTop: 12 }}>sur {fiche.valeurs} valeurs cotées</div></Entre>
      </div>
      <div style={{ position: 'absolute', left: GAUCHE, top: 560, width: L, height: 88, opacity: t(f, 6, 20) }}>
        <Verre rayon={44} reflet={t(f, 50, 90)} style={{ height: 88 }} />
      </div>
      <svg width={L} height={88} style={{ position: 'absolute', left: GAUCHE, top: 560 }}>
        <defs><clipPath id="ss-tube"><rect width={L} height={88} rx={44} /></clipPath></defs>
        <g clipPath="url(#ss-tube)">
          {segs.map((s, k) => {
            const w0 = (s.v / n) * L;
            const p = t(f, 20 + k * 14, 50 + k * 14);
            const x0 = x; x += w0;
            const fw = w0 * p;
            if (fw < 1) return null;
            const amp = p < 1 ? 7 : 0;
            let d = `M${x0} 0 L${x0 + fw} 0`;
            for (let y = 0; y <= 88; y += 4) d += ` L${x0 + fw + amp * Math.sin(y * 0.12 + f * 0.33 + k)} ${y}`;
            d += ` L${x0} 88 Z`;
            return (
              <g key={s.lib}>
                <defs><linearGradient id={`ss-l${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.c2} /><stop offset=".5" stopColor={s.c} /><stop offset="1" stopColor={s.c} stopOpacity={0.85} /></linearGradient></defs>
                <path d={d} fill={`url(#ss-l${k})`} />
                {k > 0 && <rect x={x0 - 2} y={0} width={4} height={88} fill="#05090d" opacity={0.7} />}
              </g>
            );
          })}
          <rect width={L} height={28} fill="rgba(255,255,255,.10)" />
        </g>
      </svg>
      <div style={{ position: 'absolute', left: GAUCHE, top: 690, width: L, display: 'flex' }}>
        {segs.map((s, k) => (
          <div key={s.lib} style={{ width: `${Math.max(16, (s.v / n) * 100)}%`, textAlign: k === 2 ? 'right' : 'left' }}>
            <Entre debut={24 + k * 14}>
              <div style={{ fontFamily: th.titre, fontSize: 112, lineHeight: 1, color: s.couleur }}>{s.v}</div>
              <div style={{ fontFamily: th.chiffre, fontSize: 24, color: th.doux, marginTop: 8 }}>{s.lib} · {fr((s.v / n) * 100, 0)} %</div>
            </Entre>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/* ── Capitaux ─────────────────────────────────────────────────────────── */
function Capitaux({ fiche }: PropsScene) {
  const f = useCurrentFrame();
  const md = fiche.capitaux_fcfa >= 1e9;
  const montant = md ? fr(fiche.capitaux_fcfa / 1e9) : fr(fiche.capitaux_fcfa / 1e6, 0);
  const pb = fiche.video.part_baissiere_pct;
  const tuiles = [
    { v: `${fiche.capitaux_estimes ? '≈ ' : ''}${montant}`, u: md ? ' Md FCFA' : ' M FCFA', lib: `Capitaux échangés${fiche.capitaux_estimes ? ' (estimés)' : ''}` },
    ...(fiche.video.volume ? [{ v: fr(fiche.video.volume, 0), u: '', lib: 'Titres échangés' }] : []),
    ...(fiche.transactions ? [{ v: fr(fiche.transactions, 0), u: '', lib: 'Transactions' }] : []),
  ];
  const prog = t(f, 40, 76);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: GAUCHE, top: 190 }}><Entre debut={0}><Etiquette texte="Activité de la séance" /></Entre></div>
      <div style={{ position: 'absolute', left: GAUCHE, right: GAUCHE, top: 250, display: 'flex', gap: 30 }}>
        {tuiles.map((x, i) => (
          <Panneau key={x.lib} debut={4 + i * 6} style={{ flex: i === 0 ? 1.3 : 1, height: 300 }}>
            <div style={{ fontFamily: th.titre, fontSize: 104, lineHeight: 1, whiteSpace: 'nowrap' }}>{x.v}<span style={{ fontSize: 42 }}>{x.u}</span></div>
            <div style={{ fontSize: 30, color: th.doux, marginTop: 18 }}>{x.lib}</div>
          </Panneau>
        ))}
      </div>
      <Panneau debut={26} style={{ position: 'absolute', left: GAUCHE, right: GAUCHE, top: 600, height: 230 }}>
        <div style={{ fontSize: 32 }}>Répartition du montant échangé</div>
        <div style={{ display: 'flex', height: 34, borderRadius: 17, overflow: 'hidden', marginTop: 30, background: 'rgba(255,255,255,.06)' }}>
          <div style={{ width: `${pb * prog}%`, background: 'linear-gradient(90deg,#ef4444,#fca5a5)' }} />
          <div style={{ width: `${(100 - pb) * prog}%`, background: 'linear-gradient(90deg,#86efac,#22c55e)' }} />
        </div>
        <Entre debut={70}>
          <div style={{ fontFamily: th.chiffre, fontSize: 26, color: th.doux, marginTop: 20 }}>
            <span style={{ color: th.bas }}>{fr(pb, 1)} %</span> sur des titres en baisse · <span style={{ color: th.haut }}>{fr(100 - pb, 1)} %</span> sur des titres en hausse ou stables
          </div>
        </Entre>
      </Panneau>
    </AbsoluteFill>
  );
}

/* ── La valeur la plus échangée ───────────────────────────────────────── */
function Lourde({ fiche }: PropsScene) {
  const f = useCurrentFrame();
  const l = fiche.ligne_lourde;
  const prog = t(f, 16, 60);
  const R = 170;
  const circ = 2 * Math.PI * R;
  const cours = fiche.video.cours_lourde;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: GAUCHE, top: 300, width: 820 }}>
        <Entre debut={0}><Etiquette texte="La valeur la plus échangée" /></Entre>
        <Entre debut={4}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 30 }}>
            <Vignette th={th} fiche={fiche} code={l.code} taille={120} />
            <div>
              <div style={{ fontFamily: th.titre, fontSize: 66, lineHeight: 1.05 }}>{nom(fiche, l.code)}</div>
              <div style={{ fontFamily: th.chiffre, fontSize: 26, color: th.doux, marginTop: 8 }}>{l.code}</div>
            </div>
          </div>
        </Entre>
        <Entre debut={14}>
          <div style={{ fontSize: 36, color: th.doux, marginTop: 48, lineHeight: 1.4 }}>
            {Math.abs(l.variation_pct) < 0.05 ? 'Cours quasi inchangé' : l.variation_pct > 0 ? 'Gagne ' : 'Cède '}
            {Math.abs(l.variation_pct) >= 0.05 && <b style={{ fontFamily: th.chiffre, color: ton(th, l.variation_pct) }}>{sg(l.variation_pct)} %</b>}
            {cours ? <> · clôture <b style={{ fontFamily: th.chiffre, color: th.encre }}>{fr(cours, 0)}</b> FCFA</> : null}
          </div>
        </Entre>
      </div>
      <Panneau debut={8} rayon={260} style={{ position: 'absolute', left: 1180, top: 250, width: 520, height: 520 }}>
        <div style={{ position: 'relative', width: 432, height: 432, margin: '4px auto 0' }}>
          <svg width={432} height={432} style={{ position: 'absolute', inset: 0 }}>
            <circle cx={216} cy={216} r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={34} />
            <circle cx={216} cy={216} r={R} fill="none" stroke="#3FE0CB" strokeWidth={34} strokeLinecap="round"
              strokeDasharray={`${circ * (l.part_pct / 100) * prog} ${circ}`} transform="rotate(-90 216 216)" style={{ filter: 'drop-shadow(0 0 12px #18B6A4)' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: t(f, 30, 44) }}>
            <div style={{ fontFamily: th.chiffre, fontSize: 84, color: th.accent }}>{fr(l.part_pct, 1)}<span style={{ fontSize: 40 }}> %</span></div>
            <div style={{ fontSize: 24, color: th.doux, marginTop: 4 }}>du montant échangé</div>
          </div>
        </div>
      </Panneau>
    </AbsoluteFill>
  );
}

/* ── Palmarès ─────────────────────────────────────────────────────────── */
function Palmares({ fiche }: PropsScene) {
  const f = useCurrentFrame();
  const haut = (fiche.meilleures5 ?? fiche.video.meilleures).filter((x) => x.variation_pct > 0);
  const bas = (fiche.pires5 ?? fiche.video.pires).filter((x) => x.variation_pct < 0);
  const m = Math.max(...[...haut, ...bas].map((x) => Math.abs(x.variation_pct)), 0.01);
  const colonne = (titre: string, liste: typeof haut, couleur: string, degrade: string, debut: number, gauche: number) => (
    <Panneau debut={debut} style={{ position: 'absolute', left: gauche, top: 200, width: 820, height: 640 }}>
      <Etiquette texte={titre} couleur={couleur} />
      <div style={{ marginTop: 20 }}>
        {liste.length === 0 && <div style={{ fontSize: 28, color: th.doux, marginTop: 20 }}>Aucune valeur dans ce camp</div>}
        {liste.map((x, i) => {
          const s = debut + 14 + i * 7;
          const p = t(f, s, s + 18);
          return (
            <div key={x.code} style={{ display: 'grid', gridTemplateColumns: '42px 96px 150px 1fr 150px', alignItems: 'center', height: 92, borderBottom: i < liste.length - 1 ? `1px solid ${th.bord}` : 'none', opacity: p, transform: `translateX(${(1 - p) * -36}px)` }}>
              <span style={{ fontFamily: th.chiffre, fontSize: 22, color: th.sourd }}>{i + 1}</span>
              <Vignette th={th} fiche={fiche} code={x.code} taille={64} />
              <span style={{ fontFamily: th.chiffre, fontSize: 30, fontWeight: 700 }}>{x.code}</span>
              <span style={{ height: 16, marginRight: 22, position: 'relative' }}>
                <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8, background: degrade, boxShadow: 'inset 0 2px 0 rgba(255,255,255,.35)', width: `${(Math.abs(x.variation_pct) / m) * 100 * t(f, s + 6, s + 30)}%` }} />
              </span>
              <span style={{ fontFamily: th.chiffre, fontSize: 30, fontWeight: 700, textAlign: 'right', color: couleur }}>{sg(x.variation_pct)} %</span>
            </div>
          );
        })}
      </div>
    </Panneau>
  );
  return (
    <AbsoluteFill>
      {colonne(`▲ Plus fortes hausses`, haut, th.haut, 'linear-gradient(90deg,#22c55e,#a7f3c4)', 0, GAUCHE)}
      {colonne(`▼ Plus fortes baisses`, bas, th.bas, 'linear-gradient(90deg,#ef4444,#fecaca)', 8, W - GAUCHE - 820)}
    </AbsoluteFill>
  );
}

/* ── Secteurs : part des capitaux, et combien de valeurs ont monté ─────── */
function Secteurs({ fiche }: PropsScene) {
  const f = useCurrentFrame();
  const liste = [...fiche.secteurs].sort((a, b) => b.part_pct - a.part_pct).slice(0, 6);
  const m = Math.max(...liste.map((s) => s.part_pct), 1);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: GAUCHE, top: 180 }}>
        <Entre debut={0}><Etiquette texte="Les secteurs" /></Entre>
        <Entre debut={4}><div style={{ fontFamily: th.titre, fontSize: 64, marginTop: 12 }}>Où se sont concentrés les échanges</div></Entre>
      </div>
      <Panneau debut={8} style={{ position: 'absolute', left: GAUCHE, right: GAUCHE, top: 330, height: 560 }}>
        {liste.map((s, i) => {
          const d = 18 + i * 6;
          const p = t(f, d, d + 30);
          return (
            <div key={s.secteur} style={{ display: 'grid', gridTemplateColumns: '560px 1fr 150px', alignItems: 'center', height: 80, opacity: t(f, d - 4, d + 10) }}>
              <div>
                <div style={{ fontSize: 30, whiteSpace: 'nowrap' }}>{s.secteur}</div>
                <div style={{ fontFamily: th.chiffre, fontSize: 18, color: th.sourd, marginTop: 2 }}>{s.hausses} en hausse sur {s.valeurs}</div>
              </div>
              <div style={{ height: 28, borderRadius: 14, background: 'rgba(255,255,255,.06)', overflow: 'hidden', marginRight: 26 }}>
                <div style={{ width: `${(s.part_pct / m) * 100 * p}%`, height: '100%', borderRadius: 14, background: 'linear-gradient(90deg,#18B6A4,#7FF5E6)', boxShadow: 'inset 0 3px 0 rgba(255,255,255,.35)' }} />
              </div>
              <div style={{ fontFamily: th.chiffre, fontSize: 30, fontWeight: 700, textAlign: 'right', opacity: t(f, d + 20, d + 32) }}>{fr(s.part_pct, 1)} %</div>
            </div>
          );
        })}
      </Panneau>
      <div style={{ position: 'absolute', left: GAUCHE, top: 905, fontFamily: th.chiffre, fontSize: 18, color: th.sourd, opacity: t(f, 40, 56) }}>
        Part de chaque secteur dans le montant total échangé
      </div>
    </AbsoluteFill>
  );
}

/* ── Fin : carte légale ───────────────────────────────────────────────── */
function Fin({ fiche }: PropsScene) {
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <Logo th={th} taille={150} />
      <Entre debut={8}><div style={{ fontFamily: th.titre, fontSize: 72, letterSpacing: '.04em', marginTop: 40 }}>Le détail de chaque valeur</div></Entre>
      <Entre debut={16}><div style={{ fontFamily: th.chiffre, fontSize: 48, color: th.accent, marginTop: 16, fontWeight: 600 }}>westbourse.com</div></Entre>
      <Entre debut={26}>
        <div style={{ fontSize: 24, color: th.sourd, marginTop: 56, lineHeight: 1.5 }}>
          Information de marché, pas un conseil en investissement. Chiffres issus de la séance officielle de la BRVM.
          {fiche.capitaux_estimes ? <><br />Capitaux estimés (cours × titres), la valeur officielle n’étant pas publiée.</> : null}
        </div>
      </Entre>
    </AbsoluteFill>
  );
}

const SCENES: Record<string, (p: PropsScene) => React.ReactElement | null> = {
  ouverture: Ouverture, indice: Indice, largeur: Largeur, capitaux: Capitaux,
  lourde: Lourde, palmares: Palmares, secteurs: Secteurs, fin: Fin,
};
const CHAPITRES: Record<string, string> = {
  indice: 'Indice', largeur: 'Largeur', capitaux: 'Capitaux', lourde: 'Valeur phare', palmares: 'Palmarès', secteurs: 'Secteurs',
};

/* ── En-tête, chapitres, transitions ──────────────────────────────────── */
function EnTete({ fiche }: { fiche: Fiche }) {
  return (
    <div style={{ position: 'absolute', left: GAUCHE, right: GAUCHE, top: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Logo th={th} taille={54} />
        <span style={{ fontFamily: th.titre, fontSize: 34, letterSpacing: '.04em', color: th.encre }}>WESTBOURSE</span>
      </div>
      <span style={{ fontFamily: th.chiffre, fontSize: 22, letterSpacing: '.08em', color: th.sourd, textTransform: 'uppercase' }}>BRVM · séance du {fiche.date_fr}</span>
    </div>
  );
}

function Chapitres({ plan, total }: { plan: { type: string; d0: number; duree: number }[]; total: number }) {
  const f = useCurrentFrame();
  const vus = plan.filter((p) => CHAPITRES[p.type]);
  return (
    <div style={{ position: 'absolute', left: GAUCHE, right: GAUCHE, bottom: 52, display: 'flex', gap: 18 }}>
      {vus.map((p) => {
        const prog = Math.max(0, Math.min(1, (f - p.d0) / Math.max(1, p.duree)));
        const actif = f >= p.d0 && f < p.d0 + p.duree;
        return (
          <div key={p.d0} style={{ flex: 1, fontFamily: th.chiffre, fontSize: 18, letterSpacing: '.1em', textTransform: 'uppercase', color: actif ? th.encre : th.sourd }}>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ width: `${prog * 100}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg,#18B6A4,#3FE0CB)', boxShadow: '0 0 12px #18B6A4' }} />
            </div>
            {CHAPITRES[p.type]}
          </div>
        );
      })}
      <span style={{ display: 'none' }}>{total}</span>
    </div>
  );
}

/** Transition : la flèche du logo traverse l'écran en diagonale, avec sa traînée. */
function Fleche({ coupe }: { coupe: number }) {
  const f = useCurrentFrame();
  const p = interpolate(f, [coupe - 9, coupe + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  if (p <= 0 || p >= 1) return null;
  const angle = Math.atan2(-144, 78) * 180 / Math.PI; // direction du jambage du logo
  const x = -300 + p * 2600, y = 1450 - p * 1900;
  const o = Math.sin(p * Math.PI);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ opacity: o * 0.8, background: 'radial-gradient(60% 70% at 100% 0%, rgba(63,224,203,.32), transparent 60%)', mixBlendMode: 'screen' }} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: o, filter: 'drop-shadow(0 0 18px #3FE0CB)' }}>
        <defs><linearGradient id="ss-trainee" x1="0" x2="1"><stop offset="0" stopColor="#18B6A4" stopOpacity={0} /><stop offset=".85" stopColor="#3FE0CB" stopOpacity={0.9} /><stop offset="1" stopColor="#fff" /></linearGradient></defs>
        <g transform={`translate(${x} ${y}) rotate(${angle})`}>
          <rect x={-900} y={-17} width={900} height={34} rx={17} fill="url(#ss-trainee)" />
          <path d="M58 0 L-38 -58 L-24 0 L-38 58 Z" fill="#3FE0CB" />
        </g>
      </svg>
    </AbsoluteFill>
  );
}

export default function SeanceSite({ fiche }: { fiche: Fiche | null }) {
  const { durationInFrames } = useVideoConfig();
  const f = useCurrentFrame();
  if (!fiche) return <AbsoluteFill style={{ background: th.fond }} />;
  const plan = fiche.video.plan.map((p, i, tous) => {
    const d0 = Math.round(p.debut_s * FPS);
    const fin = i === tous.length - 1 ? durationInFrames - DUREE_SIGNATURE : Math.round(tous[i + 1].debut_s * FPS);
    return { type: p.type, d0, duree: fin - d0 };
  });
  return (
    <AbsoluteFill style={{ background: th.fond }}>
      <Studio f={f} th={th} horizon={0.66} />
      <Audio src={staticFile('seance/voix.mp3')} />
      {plan.map(({ type, d0, duree }, i) => {
        const Comp = SCENES[type];
        if (!Comp) return null;
        return (
          <Sequence key={i} from={d0} durationInFrames={duree}>
            <Scene duree={duree}><Comp fiche={fiche} duree={duree} /></Scene>
          </Sequence>
        );
      })}
      <EnTete fiche={fiche} />
      <Chapitres plan={plan} total={durationInFrames} />
      {plan.slice(1).map((p) => <Fleche key={p.d0} coupe={p.d0} />)}
      <Sequence from={durationInFrames - DUREE_SIGNATURE}>
        <Signature th={th} />
      </Sequence>
    </AbsoluteFill>
  );
}
