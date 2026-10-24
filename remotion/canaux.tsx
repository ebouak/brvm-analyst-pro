import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from 'remotion';
import { MONO, SANS, SERIF } from './polices';
import { C, Entre, Logo, instant, t } from './ecosysteme';
import CONTENU from './canaux.json';

/**
 * « WESTBOURSE sur WhatsApp et Telegram » — vidéo verticale 1080×1920, voix off.
 *
 * VRAI d'un bout à l'autre :
 *  - les bulles affichent le texte produit par le CODE DE PRODUCTION
 *    (rendreCommande, legendeWhatsapp) à partir des chiffres lus en base par
 *    canaux-prep.mjs (public/canaux/donnees.json), avec leur date de séance ;
 *  - le post de la Chaîne joue la VRAIE vidéo de séance publiée ce soir-là ;
 *  - les écrans du site sont de vraies captures (video/captures-showreel.mjs).
 * Source des textes et de la voix : canaux.json. Durées : pistes de voix
 * (public/canaux/durees.json, canaux-voix.mjs).
 */

type SceneC = { id: string; titre: string; sous?: string; voix: string };
const SCENES = CONTENU.scenes as SceneC[];
const FPS = 30;
const RESPIRATION = 0.6;

type Donnees = {
  seanceFr: string;
  hausses: number;
  baisses: number;
  valeurs: number;
  composite: { valeur: number; variation: number };
  videoSeance: string | null;
  legendeChaine: string | null;
  messages: { aide: string; cours: string; palmares: string };
};
type Props = { durees: Record<string, number> | null; donnees: Donnees | null };

export const calculerCanaux: CalculateMetadataFunction<Props> = async () => {
  const durees = (await (await fetch(staticFile('canaux/durees.json'))).json()) as Record<string, number>;
  const donnees = (await (await fetch(staticFile('canaux/donnees.json'))).json()) as Donnees;
  const total = SCENES.reduce((a, s) => a + Math.ceil((durees[s.id] + RESPIRATION) * FPS), 0);
  return { durationInFrames: total, props: { durees, donnees } };
};

const nb = (x: number, d = 2) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const varia = (v: number) => `${v >= 0 ? '▲ +' : '▼ −'}${nb(Math.abs(v))} %`;
/** Le corps d'un message de production, sans son pied (mention + incitation). */
const corps = (m: string) => m.split('\n\n_Information de marché')[0];

const WA = { vert: '#25D366', fond: '#0b141a', entete: '#1f2c34', moi: '#005c4b', lui: '#202c33', gris: '#8696a0', lien: '#53bdeb' };
const TG = { bleu: '#2AABEE', fond: '#0e1621', entete: '#17212b', lui: '#182533' };

// ── Texte WhatsApp : *gras*, _italique_, liens ──────────────────────────────
function TexteWa({ texte }: { texte: string }) {
  return (
    <>
      {texte.split('\n').map((ligne, i) => (
        <div key={i} style={{ minHeight: '1.38em' }}>
          {ligne.split(/(\*[^*\n]+\*|_[^_\n]+_|https?:\/\/\S+)/g).map((m, j) =>
            /^\*[^*]+\*$/.test(m) ? <b key={j}>{m.slice(1, -1)}</b>
            : /^_[^_]+_$/.test(m) ? <i key={j} style={{ color: '#c7d0d5' }}>{m.slice(1, -1)}</i>
            : /^https?:/.test(m) ? <span key={j} style={{ color: WA.lien }}>{m.replace(/^https?:\/\/(www\.)?/, '')}</span>
            : <React.Fragment key={j}>{m}</React.Fragment>,
          )}
        </div>
      ))}
    </>
  );
}

// ── Décor : vraie capture en fond, particules, reflet ───────────────────────
function FondEcran({ ecran, teinte = WA.vert }: { ecran: string; teinte?: string }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.fond, overflow: 'hidden' }}>
      <Img
        src={staticFile(`ecrans/${ecran}.png`)}
        style={{
          position: 'absolute', width: '220%', left: '-60%', top: '-10%', opacity: 0.22,
          filter: 'blur(10px) saturate(1.2)',
          transform: `scale(${1.05 + f * 0.0008}) translateY(${-f * 0.35}px)`,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 120% 60% at 50% 15%, ${teinte}2e 0%, transparent 60%), linear-gradient(180deg, rgba(3,3,3,.55), rgba(3,3,3,.92) 70%)` }} />
      <Particules />
    </AbsoluteFill>
  );
}

function Particules() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      {Array.from({ length: 34 }, (_, i) => {
        const x = random(`x${i}`) * 1080;
        const v = 0.6 + random(`v${i}`) * 1.6;
        const y = 1920 - ((f * v + random(`y${i}`) * 1920) % 2050);
        const taille = 3 + random(`s${i}`) * 6;
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y, width: taille, height: taille, borderRadius: taille,
            background: i % 3 ? C.teal : WA.vert, opacity: 0.18 + random(`o${i}`) * 0.35,
            boxShadow: `0 0 ${taille * 3}px ${i % 3 ? C.teal : WA.vert}`,
          }} />
        );
      })}
    </AbsoluteFill>
  );
}

/** Titre avec reflet lumineux qui le traverse. */
function Brillant({ children, debut = 0, taille = 76 }: { children: React.ReactNode; debut?: number; taille?: number }) {
  const f = useCurrentFrame();
  const pos = interpolate(f, [debut + 10, debut + 50], [-60, 160], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <span style={{
      fontFamily: SERIF, fontSize: taille, lineHeight: 1.06, fontWeight: 600,
      backgroundImage: `linear-gradient(105deg, ${C.blanc} 0%, ${C.blanc} ${pos - 12}%, #b8fff4 ${pos}%, ${C.blanc} ${pos + 12}%, ${C.blanc} 100%)`,
      WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
    }}>{children}</span>
  );
}

function Marque() {
  return (
    <div style={{ position: 'absolute', top: 80, left: 70, display: 'flex', alignItems: 'center', gap: 16 }}>
      <Logo taille={54} />
      <span style={{ fontFamily: MONO, fontSize: 24, letterSpacing: '.32em', fontWeight: 600, color: C.blanc }}>WESTBOURSE</span>
    </div>
  );
}

function Titre({ s }: { s: SceneC }) {
  return (
    <div style={{ position: 'absolute', top: 190, left: 70, right: 70 }}>
      <Entre debut={2}><Brillant debut={2}>{s.titre}</Brillant></Entre>
      {s.sous && (
        <Entre debut={10}>
          <div style={{ marginTop: 16, fontFamily: SANS, fontSize: 36, color: C.gris }}>{s.sous}</div>
        </Entre>
      )}
    </div>
  );
}

/** Téléphone en 3D : entre de biais, se redresse, flotte. */
function Telephone({ nom, sous, theme = 'wa', top = 540, hauteur = 1240, children }: {
  nom: string; sous: string; theme?: 'wa' | 'tg'; top?: number; hauteur?: number; children: React.ReactNode;
}) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f, fps, config: { damping: 18, stiffness: 90 } });
  const tg = theme === 'tg';
  return (
    <div style={{ position: 'absolute', left: 110, width: 860, top, height: hauteur, perspective: 1800 }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: 64, overflow: 'hidden',
        background: tg ? TG.fond : WA.fond, border: `3px solid rgba(255,255,255,.14)`,
        boxShadow: `0 50px 140px rgba(0,0,0,.7), 0 0 80px ${tg ? TG.bleu : WA.vert}22`,
        opacity: p,
        transform: `translateY(${(1 - p) * 220 + Math.sin(f / 22) * 6}px) rotateY(${(1 - p) * -28 + Math.sin(f / 40) * 2}deg) rotateX(${(1 - p) * 12}deg)`,
      }}>
        <div style={{ height: 130, background: tg ? TG.entete : WA.entete, display: 'flex', alignItems: 'center', gap: 22, padding: '0 34px' }}>
          <div style={{ width: 76, height: 76, borderRadius: 38, background: '#0a1417', display: 'grid', placeItems: 'center' }}>
            <Logo taille={46} />
          </div>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 34, fontWeight: 700, color: C.blanc }}>{nom}</div>
            <div style={{ fontFamily: SANS, fontSize: 24, color: tg ? '#7f91a4' : WA.gris }}>{sous}</div>
          </div>
        </div>
        <div style={{ position: 'relative', padding: '30px 30px', height: hauteur - 130, overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
}

/** « en train d'écrire… » puis la bulle. */
function Bulle({ debut, moi = false, theme = 'wa', ecrit = 0, children }: {
  debut: number; moi?: boolean; theme?: 'wa' | 'tg'; ecrit?: number; children: React.ReactNode;
}) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const apparait = debut + ecrit;
  const s = spring({ frame: f - apparait, fps, config: { damping: 14, stiffness: 150 } });
  const fond = theme === 'tg' ? (moi ? '#2b5278' : TG.lui) : moi ? WA.moi : WA.lui;
  if (f < debut) return null;
  if (f < apparait) {
    return (
      <div style={{ display: 'flex', marginBottom: 22 }}>
        <div style={{ padding: '22px 28px', borderRadius: 26, background: fond, display: 'flex', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 14, height: 14, borderRadius: 7, background: WA.gris, opacity: 0.35 + 0.65 * Math.abs(Math.sin((f - debut) / 5 + i)) }} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', justifyContent: moi ? 'flex-end' : 'flex-start', marginBottom: 22, opacity: s }}>
      <div style={{
        maxWidth: 680, padding: '20px 26px', borderRadius: 26, background: fond, color: C.blanc,
        fontFamily: SANS, fontSize: 29, lineHeight: 1.38,
        transform: `scale(${0.8 + 0.2 * s}) translateY(${(1 - s) * 30}px)`, transformOrigin: moi ? 'right bottom' : 'left bottom',
        borderBottomRightRadius: moi ? 8 : 26, borderBottomLeftRadius: moi ? 26 : 8,
      }}>{children}</div>
    </div>
  );
}

function Pastille({ debut, couleur, children }: { debut: number; couleur: string; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const halo = 0.5 + 0.5 * Math.sin((f - debut) / 8);
  return (
    <Entre debut={debut} dy={30}>
      <div style={{ padding: '20px 38px', borderRadius: 999, background: `${couleur}26`, border: `2px solid ${couleur}`, color: C.blanc, fontFamily: SANS, fontSize: 40, fontWeight: 700, boxShadow: `0 0 ${20 + halo * 30}px ${couleur}66` }}>
        {children}
      </div>
    </Entre>
  );
}

// ── Scènes ──────────────────────────────────────────────────────────────────
function Intro({ s, d }: { s: SceneC; d: number }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 56 }}>
      <div style={{ transform: `scale(${interpolate(f, [0, 30], [0.6, 1], { extrapolateRight: 'clamp' })})`, filter: `drop-shadow(0 0 ${30 + 20 * Math.sin(f / 9)}px ${C.teal}88)` }}>
        <Logo taille={300} prog={t(f, 0, 36)} />
      </div>
      <Entre debut={14}>
        <div style={{ textAlign: 'center', padding: '0 70px' }}><Brillant debut={14} taille={96}>{s.titre}</Brillant></div>
      </Entre>
      <div style={{ display: 'flex', gap: 28 }}>
        <Pastille debut={instant(s.voix, 'WhatsApp', d)} couleur={WA.vert}>WhatsApp</Pastille>
        <Pastille debut={instant(s.voix, 'Telegram', d)} couleur={TG.bleu}>Telegram</Pastille>
      </div>
    </AbsoluteFill>
  );
}

function Chaine({ s, d, x }: { s: SceneC; d: number; x: Donnees }) {
  const f = useCurrentFrame();
  const tNumero = instant(s.voix, 'personne', d);
  const legende = (x.legendeChaine ?? '').split('\n').slice(0, 3).join('\n');
  return (
    <>
      <Titre s={s} />
      <Telephone nom="WESTBOURSE Bourse BRVM" sous="Chaîne WhatsApp">
        <Bulle debut={10}>
          {/* La VRAIE vidéo de séance, publiée ce soir-là sur la Chaîne. */}
          <div style={{ width: 400, height: 711, borderRadius: 18, overflow: 'hidden', marginBottom: 16, background: '#000' }}>
            {x.videoSeance ? (
              <OffthreadVideo src={x.videoSeance} muted startFrom={60} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : null}
          </div>
          <TexteWa texte={legende} />
        </Bulle>
        <div style={{ position: 'absolute', left: 30, right: 30, bottom: 34, opacity: t(f, tNumero, tNumero + 14) }}>
          <div style={{ textAlign: 'center', fontFamily: SANS, fontSize: 30, color: WA.gris }}>🔒 Votre numéro reste invisible des autres abonnés</div>
        </div>
      </Telephone>
    </>
  );
}

function Commandes({ s, d, x }: { s: SceneC; d: number; x: Donnees }) {
  const f = useCurrentFrame();
  const tAide = instant(s.voix, 'AIDE', d);
  const tCours = instant(s.voix, 'Cours SNTS', d);
  const tPalm = instant(s.voix, 'Palmarès', d);
  const defile = t(f, tCours - 4, tCours + 12) * 470 + t(f, tPalm - 4, tPalm + 12) * 470;
  return (
    <>
      <Titre s={s} />
      <Telephone nom="WESTBOURSE" sous={CONTENU.numero}>
        <div style={{ transform: `translateY(${-defile}px)` }}>
          <Bulle debut={tAide} moi>AIDE</Bulle>
          <Bulle debut={tAide + 4} ecrit={14}><TexteWa texte={corps(x.messages.aide)} /></Bulle>
          <Bulle debut={tCours} moi>COURS SNTS</Bulle>
          <Bulle debut={tCours + 4} ecrit={12}><TexteWa texte={corps(x.messages.cours)} /></Bulle>
          <Bulle debut={tPalm} moi>PALMARES</Bulle>
          <Bulle debut={tPalm + 4} ecrit={12}><TexteWa texte={corps(x.messages.palmares)} /></Bulle>
        </div>
      </Telephone>
    </>
  );
}

function Appairage({ s, d }: { s: SceneC; d: number }) {
  const f = useCurrentFrame();
  const tCode = instant(s.voix, 'envoyant', d);
  const vol = t(f, tCode - 8, tCode + 6);
  return (
    <>
      <Titre s={s} />
      <Entre debut={8} style={{ position: 'absolute', left: 110, right: 110, top: 500 }}>
        <div style={{ borderRadius: 32, background: 'rgba(10,20,23,.92)', border: `1px solid ${C.bord}`, padding: '32px 40px', boxShadow: `0 0 60px ${C.cyan}22` }}>
          <div style={{ fontFamily: SANS, fontSize: 28, color: C.gris }}>westbourse.com · Paramètres → Mes alertes</div>
          <div style={{ fontFamily: MONO, fontSize: 84, fontWeight: 700, letterSpacing: '.18em', color: C.cyan, margin: '12px 0', opacity: 1 - vol * 0.6, transform: `translateY(${vol * 60}px) scale(${1 - vol * 0.2})` }}>WB-7K3QPA</div>
          <div style={{ fontFamily: SANS, fontSize: 26, color: C.sourd }}>Code d'exemple · valable 15 minutes</div>
        </div>
      </Entre>
      <Telephone nom="WESTBOURSE" sous={CONTENU.numero} top={900} hauteur={880}>
        <Bulle debut={tCode} moi>WB-7K3QPA</Bulle>
        <Bulle debut={tCode + 4} ecrit={14}>
          <TexteWa texte={'✅ *Votre WhatsApp est lié à votre compte WESTBOURSE.*\n\n💡 Tapez *AIDE* pour les commandes rapides, *HUMAIN* pour écrire à l’équipe.'} />
        </Bulle>
      </Telephone>
    </>
  );
}

function Compteur({ debut, jusqua, libelle, couleur }: { debut: number; jusqua: number; libelle: string; couleur: string }) {
  const f = useCurrentFrame();
  const v = Math.round(interpolate(f, [debut, debut + 20], [0, jusqua], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  return (
    <Entre debut={debut} style={{ flex: 1 }}>
      <div style={{ borderRadius: 28, background: 'rgba(10,20,23,.92)', border: `2px solid ${couleur}`, padding: '24px 26px', textAlign: 'center', boxShadow: `0 0 50px ${couleur}33` }}>
        <div style={{ fontFamily: MONO, fontSize: 60, fontWeight: 700, color: couleur, whiteSpace: 'nowrap' }}>{v} / jour</div>
        <div style={{ fontFamily: SANS, fontSize: 28, color: C.gris }}>{libelle}</div>
      </div>
    </Entre>
  );
}

function Assistant({ s, d }: { s: SceneC; d: number }) {
  return (
    <>
      <Titre s={s} />
      <Telephone nom="WESTBOURSE" sous="Assistant" top={540} hauteur={900}>
        <Bulle debut={10} moi>Où en est mon portefeuille ?</Bulle>
        <Bulle debut={14} ecrit={18}>
          <TexteWa texte={'⭐ *Abonnés Premium* : votre portefeuille, vos alertes et vos dossiers du samedi, ici même.\n_Information de marché, pas un conseil en investissement._'} />
        </Bulle>
      </Telephone>
      <div style={{ position: 'absolute', left: 110, right: 110, top: 1500, display: 'flex', gap: 30 }}>
        <Compteur debut={instant(s.voix, 'trois', d)} jusqua={3} libelle="Gratuit" couleur={C.cyan} />
        <Compteur debut={instant(s.voix, 'cent en', d)} jusqua={100} libelle="Premium" couleur="#F0B23A" />
      </div>
    </>
  );
}

function Soir({ s, x }: { s: SceneC; x: Donnees }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - 10, fps, config: { damping: 9, stiffness: 140 } });
  const vibre = f > 10 && f < 24 ? Math.sin(f * 2.4) * 6 : 0;
  return (
    <>
      <Titre s={s} />
      <div style={{ position: 'absolute', left: 110, width: 860, top: 540, height: 1240, borderRadius: 64, overflow: 'hidden', border: `3px solid rgba(255,255,255,.14)`, transform: `translateX(${vibre}px)` }}>
        <Img src={staticFile('ecrans/mobile.png')} style={{ position: 'absolute', width: '100%', filter: 'blur(14px) brightness(.45)' }} />
        <div style={{ position: 'relative', textAlign: 'center', marginTop: 110, fontFamily: SANS, fontSize: 150, fontWeight: 300, color: C.blanc }}>18:05</div>
        <div style={{ position: 'relative', margin: '80px 36px 0', borderRadius: 34, background: 'rgba(32,44,51,.94)', padding: '28px 32px', transform: `translateY(${(1 - p) * -300}px)`, opacity: Math.min(1, p * 1.4), boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: SANS, fontSize: 26, color: WA.gris }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: WA.vert, display: 'inline-block' }} /> WhatsApp · WESTBOURSE · maintenant
          </div>
          <div style={{ marginTop: 12, fontFamily: SANS, fontSize: 32, fontWeight: 700, color: C.blanc }}>Point de clôture — séance du {x.seanceFr}</div>
          <div style={{ marginTop: 8, fontFamily: SANS, fontSize: 30, lineHeight: 1.4, color: C.gris }}>
            BRVM Composite {varia(x.composite.variation)} · {x.hausses} hausses, {x.baisses} baisses sur {x.valeurs} valeurs
          </div>
        </div>
      </div>
    </>
  );
}

function Telegram({ s, x }: { s: SceneC; x: Donnees }) {
  return (
    <>
      <Titre s={s} />
      <Telephone nom="WESTBOURSE" sous={CONTENU.telegram} theme="tg">
        <Bulle debut={10} theme="tg">
          <div style={{ width: 400, height: 500, borderRadius: 16, overflow: 'hidden', marginBottom: 14, background: '#000' }}>
            {x.videoSeance ? <OffthreadVideo src={x.videoSeance} muted startFrom={240} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
          </div>
          <b>BRVM — séance du {x.seanceFr}</b>
          {`\nBRVM Composite ${varia(x.composite.variation)}\n${x.hausses} hausses · ${x.baisses} baisses`.split('\n').map((l, i) => <div key={i}>{l}</div>)}
        </Bulle>
      </Telephone>
    </>
  );
}

/** Vraies captures du site : fiche SONATEL sur mobile qui défile, accueil en fond. */
function Site({ s }: { s: SceneC }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f, fps, config: { damping: 18, stiffness: 80 } });
  return (
    <>
      <Titre s={s} />
      <div style={{ position: 'absolute', left: -120, top: 560, width: 1320, perspective: 2000, opacity: 0.55 }}>
        <Img src={staticFile('ecrans/accueil.png')} style={{ width: '100%', borderRadius: 24, transform: `rotateY(24deg) rotateX(8deg) translateX(${(1 - p) * -200}px)`, boxShadow: '0 40px 120px rgba(0,0,0,.8)' }} />
      </div>
      <div style={{ position: 'absolute', left: 300, width: 560, top: 620, height: 1180, borderRadius: 60, overflow: 'hidden', border: `4px solid rgba(255,255,255,.18)`, boxShadow: `0 50px 140px rgba(0,0,0,.8), 0 0 70px ${C.cyan}33`, transform: `translateY(${(1 - p) * 300}px) rotate(${(1 - p) * 6}deg)` }}>
        <Img src={staticFile('ecrans/mobile.png')} style={{ width: '100%', transform: `translateY(${-interpolate(f, [20, 150], [0, 520], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)` }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 70, textAlign: 'center', fontFamily: MONO, fontSize: 30, color: C.sourd, opacity: t(f, 20, 40) }}>
        Captures réelles de westbourse.com
      </div>
    </>
  );
}

function Outro({ s }: { s: SceneC }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 40, padding: '0 80px', textAlign: 'center' }}>
      <div style={{ filter: `drop-shadow(0 0 ${30 + 20 * Math.sin(f / 9)}px ${C.teal}88)` }}><Logo taille={220} prog={t(f, 0, 28)} /></div>
      <Entre debut={8}><Brillant debut={8} taille={104}>{s.titre}</Brillant></Entre>
      <Entre debut={16}>
        <div style={{ fontFamily: MONO, fontSize: 66, fontWeight: 700, color: WA.vert, textShadow: `0 0 ${20 + 14 * Math.sin(f / 7)}px ${WA.vert}aa` }}>{CONTENU.numero}</div>
      </Entre>
      <Entre debut={24}>
        <div style={{ fontFamily: SANS, fontSize: 34, lineHeight: 1.7, color: C.gris }}>
          📣 Chaîne WhatsApp WESTBOURSE<br />✈️ {CONTENU.telegram}<br />🌐 westbourse.com
        </div>
      </Entre>
      <div style={{ position: 'absolute', bottom: 110, fontFamily: SANS, fontSize: 26, color: C.sourd, opacity: t(f, 6, 20) }}>
        Information de marché, pas un conseil en investissement.
      </div>
    </AbsoluteFill>
  );
}

/** Transition : zoom + flou à l'entrée et à la sortie de chaque scène. */
function SceneCadre({ longueur, children }: { longueur: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const entree = t(f, 0, 12);
  const sortie = t(f, longueur - 10, longueur);
  return (
    <AbsoluteFill style={{
      opacity: Math.min(entree, 1 - sortie),
      transform: `scale(${1.06 - entree * 0.06 + sortie * 0.08})`,
      filter: `blur(${(1 - entree) * 12 + sortie * 14}px)`,
    }}>{children}</AbsoluteFill>
  );
}

const ECRAN: Record<string, string> = {
  intro: 'accueil', chaine: 'aujourdhui', commandes: 'fiche', appairage: 'accueil', assistant: 'fiche-bas',
  soir: 'aujourdhui', telegram: 'analyses', site: 'societes', outro: 'accueil',
};

// ── Montage ─────────────────────────────────────────────────────────────────
export default function Canaux({ durees, donnees }: Props) {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (!durees || !donnees) return <AbsoluteFill style={{ background: C.fond }} />;
  let debut = 0;
  return (
    <AbsoluteFill style={{ background: C.fond, color: C.blanc, fontFamily: SANS }}>
      {SCENES.map((s) => {
        const d = durees[s.id];
        const longueur = Math.ceil((d + RESPIRATION) * FPS);
        const from = debut;
        debut += longueur;
        return (
          <Sequence key={s.id} from={from} durationInFrames={longueur} name={s.id}>
            <Audio src={staticFile(`canaux/${s.id}.mp3`)} />
            <FondEcran ecran={ECRAN[s.id] ?? 'accueil'} teinte={s.id === 'telegram' ? TG.bleu : WA.vert} />
            <SceneCadre longueur={longueur}>
              {s.id !== 'intro' && s.id !== 'outro' && <Marque />}
              {s.id === 'intro' && <Intro s={s} d={d} />}
              {s.id === 'chaine' && <Chaine s={s} d={d} x={donnees} />}
              {s.id === 'commandes' && <Commandes s={s} d={d} x={donnees} />}
              {s.id === 'appairage' && <Appairage s={s} d={d} />}
              {s.id === 'assistant' && <Assistant s={s} d={d} />}
              {s.id === 'soir' && <Soir s={s} x={donnees} />}
              {s.id === 'telegram' && <Telegram s={s} x={donnees} />}
              {s.id === 'site' && <Site s={s} />}
              {s.id === 'outro' && <Outro s={s} />}
            </SceneCadre>
          </Sequence>
        );
      })}
      {/* Barre de progression */}
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 8, width: `${(f / durationInFrames) * 100}%`, background: `linear-gradient(90deg, ${C.teal}, ${WA.vert})`, boxShadow: `0 0 20px ${WA.vert}` }} />
    </AbsoluteFill>
  );
}
