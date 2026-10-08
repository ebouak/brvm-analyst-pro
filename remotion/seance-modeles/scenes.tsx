import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { chaleur, fr, sg, t, ton, type Theme } from './theme';
import { Entre, Etiquette, Logo, Scene, Vignette, type Fiche } from './elements';

/**
 * Les scènes de la vidéo de séance, une par TYPE de temps du récit
 * (video/recit.mjs). Chacune se décline dans les trois modèles.
 *
 * AUCUN CHIFFRE NE DÉFILE. Un compteur qui part de zéro affiche, le temps de
 * monter, des valeurs que la séance n'a jamais eues. Les nombres apparaissent
 * à leur valeur finale ; seules les barres, tuiles et arcs — des proportions —
 * se remplissent.
 */
export interface PropsScene { th: Theme; fiche: Fiche; duree: number }

const nom = (fiche: Fiche, code: string) => fiche.video.noms[code] ?? code;

/* ── Carte du marché : une tuile par valeur cotée ─────────────────────── */
function Carte({ th, fiche, debut, codes = true, colonnes = 6 }: { th: Theme; fiche: Fiche; debut: number; codes?: boolean; colonnes?: number }) {
  const f = useCurrentFrame();
  const cotes = fiche.video.cotes;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colonnes}, 1fr)`, gap: 8 }}>
      {cotes.map((c, i) => {
        const p = t(f, debut + i * 0.9, debut + i * 0.9 + 12);
        return (
          <div key={c.code} style={{
            height: codes ? 104 : 70, background: chaleur(th, c.variation_pct), opacity: p,
            transform: `scale(${0.7 + 0.3 * p})`, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: '#fff',
          }}>
            {codes && <span style={{ fontFamily: th.chiffre, fontSize: 24, fontWeight: 700 }}>{c.code}</span>}
            {codes && <span style={{ fontFamily: th.chiffre, fontSize: 20, opacity: 0.9 }}>{sg(c.variation_pct)}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ── Ouverture ────────────────────────────────────────────────────────── */
function Ouverture({ th, fiche, duree }: PropsScene) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const acc = fiche.video.accroche;
  const frise = (taille: number, debut: number) => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: th.modele === 'nuit' ? 'center' : 'flex-start' }}>
      {fiche.video.frise.map((code, i) => {
        const s = spring({ frame: f - debut - i * 4, fps, config: { damping: 14, stiffness: 140 } });
        return <div key={code} style={{ transform: `scale(${0.6 + s * 0.4})`, opacity: s }}><Vignette th={th} fiche={fiche} code={code} taille={taille} /></div>;
      })}
    </div>
  );

  if (th.modele === 'papier') {
    return (
      <Scene th={th} duree={duree}>
        <Entre th={th} debut={4}><div style={{ fontSize: 30, letterSpacing: '.2em', textTransform: 'uppercase', color: th.accent, fontWeight: 700 }}>La séance du jour</div></Entre>
        <Entre th={th} debut={10}>
          <div style={{ fontFamily: th.titre, fontSize: acc ? 88 : 96, fontWeight: 700, lineHeight: 1.06, marginTop: 26 }}>
            {acc ?? `Séance du ${fiche.date_fr}`}
          </div>
        </Entre>
        <div style={{ height: 3, background: th.encre, width: `${t(f, 22, 46) * 100}%`, margin: '44px 0 40px' }} />
        {frise(88, 30)}
        <Entre th={th} debut={40}><div style={{ fontSize: 26, color: th.sourd, marginTop: 20 }}>Les huit valeurs les plus échangées de la séance</div></Entre>
      </Scene>
    );
  }

  if (th.modele === 'mosaique') {
    return (
      <Scene th={th} duree={duree}>
        <div style={{ position: 'relative' }}>
          <Carte th={th} fiche={fiche} debut={0} codes={false} colonnes={8} />
          <Entre th={th} debut={28} style={{ position: 'absolute', left: -12, right: -12, top: '50%', transform: 'translateY(-50%)' }}>
            <div style={{ background: 'rgba(5,10,12,.9)', border: `1px solid ${th.bord}`, padding: '44px 40px' }}>
              <div style={{ fontFamily: th.chiffre, fontSize: 26, letterSpacing: '.24em', color: th.accent }}>SÉANCE BRVM · {fiche.valeurs} VALEURS</div>
              <div style={{ fontFamily: th.titre, fontSize: 46, marginTop: 18, letterSpacing: '.02em', textTransform: 'uppercase' }}>{fiche.date_fr}</div>
              {acc && <div style={{ fontFamily: th.texte, fontSize: 52, fontWeight: 700, lineHeight: 1.2, marginTop: 26 }}>{acc}</div>}
            </div>
          </Entre>
        </div>
      </Scene>
    );
  }

  return (
    <Scene th={th} duree={duree} centre>
      <Logo th={th} taille={170} prog={t(f, 0, 30)} />
      <Entre th={th} debut={12}><div style={{ fontFamily: th.chiffre, fontSize: 30, letterSpacing: '.34em', color: th.accent, marginTop: 44 }}>SÉANCE BRVM</div></Entre>
      <Entre th={th} debut={18}><div style={{ fontFamily: th.titre, fontSize: 76, fontWeight: 600, marginTop: 18 }}>{fiche.date_fr}</div></Entre>
      {acc && (
        <Entre th={th} debut={30}>
          <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.22, marginTop: 50, maxWidth: 880 }}>{acc}</div>
        </Entre>
      )}
      <div style={{ marginTop: 64 }}>{frise(92, 40)}</div>
    </Scene>
  );
}

/* ── Indice ───────────────────────────────────────────────────────────── */
function badgesIndice(fiche: Fiche): string[] {
  const fa = fiche.video.faits;
  if (!fa) return [];
  const sens = fa.sens > 0 ? 'hausse' : 'baisse';
  const b: string[] = [];
  if (fa.record) b.push(`Plus forte ${sens} sur ${fa.fenetre} séances`);
  if (fa.serie >= 2 && !fa.serie_plafonnee) b.push(`${fa.serie}e séance de ${sens} d’affilée`);
  if (fa.evolution_pct != null) b.push(`${fa.fenetre} séances : ${sg(fa.evolution_pct)} %`);
  return b;
}

function Courbe({ th, fiche, debut, largeur = 890, hauteur = 280, encre = false }: { th: Theme; fiche: Fiche; debut: number; largeur?: number; hauteur?: number; encre?: boolean }) {
  const f = useCurrentFrame();
  const h = fiche.historique_indice;
  if (h.length < 5) return null;
  const vals = h.map((p) => p.valeur);
  const min = Math.min(...vals), max = Math.max(...vals);
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * largeur, hauteur - ((v - min) / (max - min || 1)) * hauteur * 0.82 - hauteur * 0.09]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const prog = t(f, debut, debut + 50);
  const col = encre ? th.encre : (fiche.composite && fiche.composite.variation_pct >= 0 ? th.haut : th.bas);
  const dernier = pts[pts.length - 1];
  const iMin = vals.indexOf(min), iMax = vals.indexOf(max);
  return (
    <svg width={largeur} height={hauteur + (encre ? 40 : 0)} style={{ overflow: 'visible', marginTop: 50 }}>
      {!encre && <path d={`${d} L${largeur} ${hauteur} L0 ${hauteur} Z`} fill={col} opacity={0.08 * prog} />}
      <path d={d} fill="none" stroke={col} strokeWidth={encre ? 3 : 4} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog}
        style={encre ? undefined : { filter: `drop-shadow(0 0 10px ${col})` }} />
      {encre && prog > 0.95 && (
        <g fontFamily={th.texte} fontSize={22} fill={th.doux}>
          <circle cx={pts[iMax][0]} cy={pts[iMax][1]} r={6} fill={th.encre} />
          <text x={Math.min(pts[iMax][0], largeur - 120)} y={pts[iMax][1] - 16}>{fr(max)}</text>
          <circle cx={pts[iMin][0]} cy={pts[iMin][1]} r={6} fill={th.encre} />
          <text x={Math.min(pts[iMin][0], largeur - 120)} y={pts[iMin][1] + 36}>{fr(min)}</text>
        </g>
      )}
      <circle cx={dernier[0]} cy={dernier[1]} r={10 * t(f, debut + 46, debut + 56)} fill={encre ? th.accent : th.fond} stroke={encre ? th.accent : col} strokeWidth={4} />
    </svg>
  );
}

function BarresJour({ th, fiche, debut }: { th: Theme; fiche: Fiche; debut: number }) {
  const f = useCurrentFrame();
  const h = fiche.historique_indice;
  if (h.length < 5) return null;
  const v = h.slice(1).map((p, i) => (p.valeur / h[i].valeur - 1) * 100);
  const m = Math.max(...v.map(Math.abs), 0.01);
  const H = 150;
  return (
    <div style={{ marginTop: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: H * 2 }}>
        {v.map((x, i) => {
          const p = t(f, debut + i * 1.5, debut + i * 1.5 + 14);
          const dernier = i === v.length - 1;
          return (
            <div key={i} style={{ flex: 1, height: '100%', position: 'relative' }}>
              <div style={{
                position: 'absolute', left: 0, right: 0, background: x >= 0 ? th.haut : th.bas,
                opacity: dernier ? 1 : 0.55, outline: dernier ? `3px solid ${th.encre}` : 'none',
                height: (Math.abs(x) / m) * H * p, ...(x >= 0 ? { bottom: H } : { top: H }),
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: th.chiffre, fontSize: 22, color: th.sourd, marginTop: 12, letterSpacing: '.1em' }}>
        VARIATION QUOTIDIENNE · {v.length} DERNIÈRES SÉANCES
      </div>
    </div>
  );
}

function Indice({ th, fiche, duree }: PropsScene) {
  const c = fiche.composite;
  const badges = badgesIndice(fiche);
  const grand = th.modele === 'papier' ? 190 : 200;
  return (
    <Scene th={th} duree={duree}>
      <Entre th={th} debut={0}><Etiquette th={th} texte="BRVM Composite" /></Entre>
      <Entre th={th} debut={4}>
        <div style={{ fontFamily: th.chiffre, fontSize: grand, lineHeight: 0.9, letterSpacing: th.modele === 'papier' ? '-.02em' : '-.04em', color: c ? ton(th, c.variation_pct) : th.doux, fontWeight: th.modele === 'papier' ? 700 : 400 }}>
          {c ? sg(c.variation_pct) : '—'}<span style={{ fontSize: '.4em' }}> %</span>
        </div>
      </Entre>
      <Entre th={th} debut={12}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 30 }}>
          <span style={{ fontFamily: th.chiffre, fontSize: 92 }}>{c ? fr(c.valeur) : '—'}</span>
          <span style={{ fontSize: 36, color: th.doux }}>points</span>
        </div>
      </Entre>
      {th.modele === 'mosaique'
        ? <BarresJour th={th} fiche={fiche} debut={18} />
        : <Courbe th={th} fiche={fiche} debut={18} encre={th.modele === 'papier'} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 40 }}>
        {badges.map((b, i) => (
          <Entre key={b} th={th} debut={40 + i * 8}>
            <div style={{
              fontFamily: th.modele === 'papier' ? th.texte : th.chiffre, fontSize: 28, padding: '12px 20px',
              border: `1.5px solid ${th.modele === 'papier' ? th.encre : th.bord}`, borderRadius: th.modele === 'nuit' ? 40 : 0,
              color: th.encre, background: th.modele === 'papier' ? 'transparent' : th.surface,
            }}>{b}</div>
          </Entre>
        ))}
      </div>
    </Scene>
  );
}

/* ── Largeur du marché ────────────────────────────────────────────────── */
function Largeur({ th, fiche, duree }: PropsScene) {
  const f = useCurrentFrame();
  const n = fiche.valeurs || 1;
  const comptes = (
    <div style={{ display: 'flex', gap: 30, marginTop: 44 }}>
      {[
        { v: fiche.hausses, l: fiche.hausses > 1 ? 'hausses' : 'hausse', c: th.haut },
        { v: fiche.baisses, l: fiche.baisses > 1 ? 'baisses' : 'baisse', c: th.bas },
        { v: fiche.stables, l: fiche.stables > 1 ? 'stables' : 'stable', c: th.doux },
      ].map((x, i) => (
        <Entre key={x.l} th={th} debut={30 + i * 6} style={{ flex: 1 }}>
          <div style={{ fontFamily: th.chiffre, fontSize: 104, lineHeight: 1, color: x.c, fontWeight: th.modele === 'papier' ? 700 : 500 }}>{x.v}</div>
          <div style={{ fontSize: 34, color: th.doux, marginTop: 8 }}>{x.l}</div>
        </Entre>
      ))}
    </div>
  );

  if (th.modele === 'mosaique') {
    return (
      <Scene th={th} duree={duree}>
        <Entre th={th} debut={0}><Etiquette th={th} texte={`Carte des ${fiche.valeurs} valeurs`} /></Entre>
        <Carte th={th} fiche={fiche} debut={4} />
        <Entre th={th} debut={50}>
          <div style={{ fontFamily: th.chiffre, fontSize: 34, marginTop: 34 }}>
            <span style={{ color: th.haut }}>▲ {fiche.hausses}</span>{'   '}
            <span style={{ color: th.bas }}>▼ {fiche.baisses}</span>{'   '}
            <span style={{ color: th.doux }}>= {fiche.stables}</span>
          </div>
        </Entre>
      </Scene>
    );
  }

  if (th.modele === 'papier') {
    const points = [
      ...Array(fiche.hausses).fill(th.haut),
      ...Array(fiche.stables).fill(th.neutre),
      ...Array(fiche.baisses).fill(th.bas),
    ];
    return (
      <Scene th={th} duree={duree}>
        <Entre th={th} debut={0}><Etiquette th={th} texte="Largeur du marché" /></Entre>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 22, maxWidth: 820 }}>
          {points.map((c, i) => {
            const p = t(f, 6 + i * 0.7, 6 + i * 0.7 + 10);
            return <div key={i} style={{ aspectRatio: '1', borderRadius: '50%', background: c, transform: `scale(${p})` }} />;
          })}
        </div>
        {comptes}
        <Entre th={th} debut={50}><div style={{ fontSize: 28, color: th.sourd, marginTop: 20 }}>Un point par valeur cotée · {n} au total</div></Entre>
      </Scene>
    );
  }

  const segs = [
    { v: fiche.hausses, c: th.haut },
    { v: fiche.stables, c: th.neutre },
    { v: fiche.baisses, c: th.bas },
  ];
  const prog = t(f, 8, 40);
  return (
    <Scene th={th} duree={duree}>
      <Entre th={th} debut={0}><Etiquette th={th} texte="Largeur du marché" /></Entre>
      <div style={{ display: 'flex', height: 130, width: '100%', borderRadius: 16, overflow: 'hidden', background: th.surface, gap: 4 }}>
        {segs.map((s, i) => <div key={i} style={{ width: `${(s.v / n) * 100 * prog}%`, background: s.c }} />)}
      </div>
      {comptes}
      <Entre th={th} debut={50}><div style={{ fontSize: 30, color: th.sourd, marginTop: 24 }}>sur {fiche.valeurs} valeurs cotées</div></Entre>
    </Scene>
  );
}

/* ── Capitaux ─────────────────────────────────────────────────────────── */
function Capitaux({ th, fiche, duree }: PropsScene) {
  const f = useCurrentFrame();
  const pb = fiche.video.part_baissiere_pct;
  const md = fiche.capitaux_fcfa >= 1e9;
  const montant = md ? fr(fiche.capitaux_fcfa / 1e9) : fr(fiche.capitaux_fcfa / 1e6, 0);
  const tete = (
    <>
      <Entre th={th} debut={0}><Etiquette th={th} texte={`Capitaux échangés${fiche.capitaux_estimes ? ' (estimés)' : ''}`} /></Entre>
      <Entre th={th} debut={4}>
        <div style={{ fontFamily: th.chiffre, fontSize: 190, lineHeight: 0.9, letterSpacing: '-.03em', fontWeight: th.modele === 'papier' ? 700 : 400 }}>
          {fiche.capitaux_estimes ? '≈ ' : ''}{montant}<span style={{ fontSize: '.3em' }}> {md ? 'Md' : 'M'}</span>
        </div>
      </Entre>
      <Entre th={th} debut={10}><div style={{ fontSize: 38, color: th.doux, marginTop: 22 }}>de francs CFA ont changé de mains</div></Entre>
    </>
  );
  const contributeurs = [...fiche.video.cotes].sort((a, b) => b.part_pct - a.part_pct).slice(0, th.modele === 'mosaique' ? 7 : 5);

  if (th.modele === 'nuit') {
    const prog = t(f, 26, 56);
    return (
      <Scene th={th} duree={duree}>
        {tete}
        <div style={{ display: 'flex', height: 70, width: '100%', marginTop: 70, borderRadius: 12, overflow: 'hidden', background: th.surface }}>
          <div style={{ width: `${pb * prog}%`, background: th.bas }} />
          <div style={{ width: `${(100 - pb) * prog}%`, background: th.haut }} />
        </div>
        <Entre th={th} debut={54}>
          <div style={{ fontSize: 38, color: th.doux, marginTop: 30, lineHeight: 1.4 }}>
            <b style={{ color: th.bas, fontFamily: th.chiffre }}>{fr(pb, 1)} %</b> du montant sur des titres en baisse
          </div>
        </Entre>
      </Scene>
    );
  }

  const m = Math.max(...contributeurs.map((c) => c.part_pct), 1);
  return (
    <Scene th={th} duree={duree}>
      {tete}
      <Entre th={th} debut={20}>
        <div style={{ fontSize: 30, color: th.doux, marginTop: 36 }}>
          dont <b style={{ color: th.bas }}>{fr(pb, 1)} %</b> sur des titres en baisse · les plus échangées :
        </div>
      </Entre>
      <div style={{ marginTop: 26 }}>
        {contributeurs.map((c, i) => {
          const p = t(f, 26 + i * 5, 26 + i * 5 + 16);
          return (
            <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '12px 0', borderBottom: th.modele === 'papier' ? `1px solid ${th.bord}` : 'none', opacity: Math.min(1, p * 2) }}>
              <span style={{ fontFamily: th.chiffre, fontSize: 32, width: 130, fontWeight: 700 }}>{c.code}</span>
              <div style={{ flex: 1, height: th.modele === 'papier' ? 18 : 30, background: th.surface }}>
                <div style={{ width: `${(c.part_pct / m) * 100 * p}%`, height: '100%', background: th.modele === 'papier' ? th.accent : ton(th, c.variation_pct) }} />
              </div>
              <span style={{ fontFamily: th.chiffre, fontSize: 30, width: 120, textAlign: 'right' }}>{fr(c.part_pct, 1)} %</span>
            </div>
          );
        })}
      </div>
    </Scene>
  );
}

/* ── La valeur la plus échangée ───────────────────────────────────────── */
function Lourde({ th, fiche, duree }: PropsScene) {
  const f = useCurrentFrame();
  const l = fiche.ligne_lourde;
  const prog = t(f, 18, 58);
  const mvt = Math.abs(l.variation_pct) < 0.05 ? 'cours quasi inchangé ' : null;
  const tete = (
    <Entre th={th} debut={4}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
        <Vignette th={th} fiche={fiche} code={l.code} taille={140} />
        <div>
          <div style={{ fontFamily: th.titre, fontSize: th.modele === 'mosaique' ? 44 : 58, fontWeight: 700, lineHeight: 1.05, textTransform: th.casseTitre }}>{nom(fiche, l.code)}</div>
          <div style={{ fontFamily: th.chiffre, fontSize: 30, color: th.doux, marginTop: 10 }}>{l.code}</div>
        </div>
      </div>
    </Entre>
  );
  const variation = (
    <Entre th={th} debut={52}>
      <div style={{ fontSize: 44, marginTop: 50 }}>
        {mvt ?? (l.variation_pct > 0 ? 'gagne ' : 'cède ')}
        <b style={{ color: ton(th, l.variation_pct), fontFamily: th.chiffre }}>{sg(l.variation_pct)} %</b>
      </div>
    </Entre>
  );

  if (th.modele === 'papier') {
    return (
      <Scene th={th} duree={duree}>
        <Etiquette th={th} texte="La valeur la plus échangée" />
        {tete}
        <Entre th={th} debut={30}><div style={{ fontFamily: th.chiffre, fontSize: 210, fontWeight: 700, color: th.accent, lineHeight: 1, marginTop: 50 }}>{fr(l.part_pct, 1)}<span style={{ fontSize: '.35em' }}> %</span></div></Entre>
        <div style={{ height: 34, background: th.surface, marginTop: 20, border: `1px solid ${th.bord}` }}>
          <div style={{ height: '100%', width: `${l.part_pct * prog}%`, background: th.accent }} />
        </div>
        <Entre th={th} debut={40}><div style={{ fontSize: 32, color: th.doux, marginTop: 16 }}>du montant total échangé sur la séance</div></Entre>
        {variation}
      </Scene>
    );
  }

  const R = 150, circ = 2 * Math.PI * R;
  return (
    <Scene th={th} duree={duree}>
      <Entre th={th} debut={0}><Etiquette th={th} texte="La valeur la plus échangée" /></Entre>
      {tete}
      <div style={{ display: 'flex', alignItems: 'center', gap: 46, marginTop: 64 }}>
        <svg width={2 * R + 40} height={2 * R + 40} style={{ transform: 'rotate(-90deg)', flex: '0 0 auto' }}>
          <circle cx={R + 20} cy={R + 20} r={R} fill="none" stroke={th.surface} strokeWidth={34} />
          <circle cx={R + 20} cy={R + 20} r={R} fill="none" stroke={th.accent} strokeWidth={34} strokeLinecap={th.modele === 'mosaique' ? 'butt' : 'round'}
            strokeDasharray={`${(l.part_pct / 100) * circ * prog} ${circ}`} style={{ filter: `drop-shadow(0 0 12px ${th.accent})` }} />
        </svg>
        <div>
          <Entre th={th} debut={36}><div style={{ fontFamily: th.chiffre, fontSize: 118, color: th.accent, lineHeight: 0.9 }}>{fr(l.part_pct, 1)}<span style={{ fontSize: '.4em' }}> %</span></div></Entre>
          <Entre th={th} debut={42}><div style={{ fontSize: 32, color: th.doux, marginTop: 16 }}>du montant total échangé</div></Entre>
        </div>
      </div>
      {variation}
    </Scene>
  );
}

/* ── Palmarès ─────────────────────────────────────────────────────────── */
function Palmares({ th, fiche, duree }: PropsScene) {
  const f = useCurrentFrame();
  const hauts = fiche.video.meilleures, bas = fiche.video.pires;

  if (th.modele === 'mosaique') {
    const lignes = [...hauts, ...bas];
    const m = Math.max(...lignes.map((x) => Math.abs(x.variation_pct)), 0.01);
    return (
      <Scene th={th} duree={duree}>
        <Entre th={th} debut={0}><Etiquette th={th} texte="Plus fortes variations" /></Entre>
        {lignes.map((x, i) => {
          const p = t(f, 6 + i * 6, 6 + i * 6 + 16);
          const hausse = x.variation_pct > 0;
          return (
            <div key={x.code} style={{ display: 'flex', alignItems: 'center', height: 104, marginTop: i === hauts.length ? 30 : 6 }}>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', paddingRight: 8 }}>
                {!hausse && <div style={{ width: `${(Math.abs(x.variation_pct) / m) * 100 * p}%`, height: 70, background: th.bas }} />}
              </div>
              <div style={{ width: 150, textAlign: 'center', fontFamily: th.chiffre, fontSize: 30, fontWeight: 700 }}>{x.code}</div>
              <div style={{ flex: 1, paddingLeft: 8 }}>
                {hausse && <div style={{ width: `${(x.variation_pct / m) * 100 * p}%`, height: 70, background: th.haut }} />}
              </div>
              <div style={{ width: 170, textAlign: 'right', fontFamily: th.chiffre, fontSize: 34, color: ton(th, x.variation_pct), opacity: p }}>{sg(x.variation_pct)} %</div>
            </div>
          );
        })}
      </Scene>
    );
  }

  const groupe = (titre: string, liste: typeof hauts, debut: number) => liste.length > 0 && (
    <div style={{ marginTop: 26 }}>
      <Entre th={th} debut={debut}>
        <div style={{ fontFamily: th.modele === 'papier' ? th.titre : th.chiffre, fontSize: th.modele === 'papier' ? 40 : 26, fontWeight: 700, letterSpacing: th.modele === 'papier' ? 0 : '.2em', textTransform: th.modele === 'papier' ? 'none' : 'uppercase', color: th.doux, borderBottom: th.modele === 'papier' ? `2px solid ${th.encre}` : 'none', paddingBottom: 8 }}>{titre}</div>
      </Entre>
      {liste.map((x, i) => {
        const p = t(f, debut + 6 + i * 6, debut + 6 + i * 6 + 18);
        return (
          <div key={x.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 22, padding: '20px 0', borderBottom: `1px solid ${th.bord}`, opacity: p, transform: `translateX(${(1 - p) * -60}px)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, minWidth: 0 }}>
              <Vignette th={th} fiche={fiche} code={x.code} taille={84} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: th.chiffre, fontSize: 42, fontWeight: th.modele === 'papier' ? 700 : 500 }}>{x.code}</div>
                <div style={{ fontSize: 24, color: th.sourd, marginTop: 4, maxWidth: 470, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nom(fiche, x.code)}</div>
              </div>
            </div>
            <div style={{ fontFamily: th.chiffre, fontSize: 52, fontWeight: 700, color: ton(th, x.variation_pct), whiteSpace: 'nowrap' }}>{sg(x.variation_pct)} %</div>
          </div>
        );
      })}
    </div>
  );
  return (
    <Scene th={th} duree={duree}>
      <Entre th={th} debut={0}><Etiquette th={th} texte="Palmarès de la séance" /></Entre>
      {groupe('En hausse', hauts, 4)}
      {groupe('En baisse', bas, Math.round(duree * 0.45))}
    </Scene>
  );
}

/* ── Secteurs ─────────────────────────────────────────────────────────── */
function Secteurs({ th, fiche, duree }: PropsScene) {
  const f = useCurrentFrame();
  const liste = fiche.secteurs.filter((s) => s.secteur !== 'Non classé').slice(0, 5);
  const m = Math.max(...liste.map((s) => s.part_pct), 1);
  return (
    <Scene th={th} duree={duree}>
      <Entre th={th} debut={0}><Etiquette th={th} texte="Capitaux par secteur" /></Entre>
      {liste.map((s, i) => {
        const p = t(f, 6 + i * 7, 6 + i * 7 + 20);
        return (
          <div key={s.secteur} style={{ margin: '22px 0', opacity: Math.min(1, p * 2) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: th.modele === 'papier' ? th.titre : th.texte, fontSize: 38, fontWeight: 600 }}>{s.secteur}</span>
              <span style={{ fontFamily: th.chiffre, fontSize: 40, fontWeight: 700 }}>{fr(s.part_pct, 1)} %</span>
            </div>
            <div style={{ height: 22, background: th.surface, marginTop: 12 }}>
              <div style={{ height: '100%', width: `${(s.part_pct / m) * 100 * p}%`, background: th.accent }} />
            </div>
            <div style={{ fontSize: 26, color: th.sourd, marginTop: 8 }}>{s.hausses} en hausse sur {s.valeurs}</div>
          </div>
        );
      })}
    </Scene>
  );
}

/* ── Fin ──────────────────────────────────────────────────────────────── */
function Fin({ th, fiche, duree }: PropsScene) {
  const f = useCurrentFrame();
  return (
    <Scene th={th} duree={duree + 8} centre>
      <Logo th={th} taille={160} prog={t(f, 0, 28)} />
      <Entre th={th} debut={10}><div style={{ fontFamily: th.modele === 'papier' ? th.titre : th.chiffre, fontSize: 52, letterSpacing: th.modele === 'papier' ? '.04em' : '.34em', fontWeight: 700, marginTop: 40 }}>{th.modele === 'papier' ? 'Westbourse' : 'WESTBOURSE'}</div></Entre>
      <Entre th={th} debut={18}><div style={{ fontSize: 42, color: th.doux, marginTop: 30 }}>Le détail de chaque valeur</div></Entre>
      <Entre th={th} debut={24}><div style={{ fontFamily: th.chiffre, fontSize: 56, color: th.accent, marginTop: 18, fontWeight: 600 }}>westbourse.com</div></Entre>
      <Entre th={th} debut={34}>
        <div style={{ fontSize: 25, color: th.sourd, marginTop: 70, maxWidth: 820, lineHeight: 1.5 }}>
          Information de marché, pas un conseil en investissement.<br />
          Chiffres issus de la séance officielle de la BRVM.
          {fiche.capitaux_estimes ? <><br />Capitaux estimés (cours × titres), la valeur officielle n’étant pas publiée.</> : null}
        </div>
      </Entre>
    </Scene>
  );
}

export const SCENES: Record<string, (p: PropsScene) => React.ReactElement | null> = {
  ouverture: Ouverture,
  indice: Indice,
  largeur: Largeur,
  capitaux: Capitaux,
  lourde: Lourde,
  palmares: Palmares,
  secteurs: Secteurs,
  fin: Fin,
};
