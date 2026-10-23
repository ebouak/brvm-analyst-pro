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
import { C, Entre, Fond, Logo, instant, t } from './ecosysteme';
import CONTENU from './canaux.json';

/**
 * « WESTBOURSE sur WhatsApp et Telegram » — vidéo verticale 1080×1920, voix off.
 *
 * Source unique : canaux.json (textes affichés ET voix). Durée de chaque scène
 * = sa piste de voix (public/canaux/durees.json, canaux-voix.mjs) + une
 * respiration. Les chiffres montrés dans les conversations viennent de
 * public/canaux/donnees.json, lu en base par canaux-prep.mjs, avec la date de
 * séance : rien n'est saisi à la main.
 */

type SceneC = { id: string; titre: string; sous?: string; voix: string };
const SCENES = CONTENU.scenes as SceneC[];
const FPS = 30;
const RESPIRATION = 0.7;

type Donnees = {
  seanceFr: string;
  snts: { cours: number; variation: number };
  palmares: { code: string; cours: number; variation: number }[];
  hausses: number;
  baisses: number;
  valeurs: number;
  composite: { valeur: number; variation: number };
};
type Props = { durees: Record<string, number> | null; donnees: Donnees | null };

export const calculerCanaux: CalculateMetadataFunction<Props> = async () => {
  const durees = (await (await fetch(staticFile('canaux/durees.json'))).json()) as Record<string, number>;
  const donnees = (await (await fetch(staticFile('canaux/donnees.json'))).json()) as Donnees;
  const total = SCENES.reduce((a, s) => a + Math.ceil((durees[s.id] + RESPIRATION) * FPS), 0);
  return { durationInFrames: total, props: { durees, donnees } };
};

// ── Mise en forme des nombres (fr) ──────────────────────────────────────────
const nb = (x: number, d = 0) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const varia = (v: number) => `${v >= 0 ? '▲ +' : '▼ −'}${nb(Math.abs(v), 2)} %`;

const WA = { vert: '#25D366', fond: '#0b141a', entete: '#1f2c34', moi: '#005c4b', lui: '#202c33', gris: '#8696a0' };
const TG = { bleu: '#2AABEE', fond: '#0e1621', entete: '#17212b', lui: '#182533' };

// ── Éléments ────────────────────────────────────────────────────────────────
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
    <div style={{ position: 'absolute', top: 200, left: 70, right: 70 }}>
      <Entre debut={4}>
        <div style={{ fontFamily: SERIF, fontSize: 76, lineHeight: 1.08, fontWeight: 600, color: C.blanc }}>{s.titre}</div>
      </Entre>
      {s.sous && (
        <Entre debut={12}>
          <div style={{ marginTop: 18, fontFamily: SANS, fontSize: 36, color: C.gris }}>{s.sous}</div>
        </Entre>
      )}
    </div>
  );
}

/** Téléphone : en-tête de conversation + zone de messages. */
function Telephone({ nom, sous, theme = 'wa', top = 560, hauteur = 1220, children }: {
  nom: string; sous: string; theme?: 'wa' | 'tg'; top?: number; hauteur?: number; children: React.ReactNode;
}) {
  const f = useCurrentFrame();
  const p = t(f, 0, 18);
  const tg = theme === 'tg';
  return (
    <div style={{
      position: 'absolute', left: 110, width: 860, top, height: hauteur, borderRadius: 64, overflow: 'hidden',
      background: tg ? TG.fond : WA.fond, border: `2px solid ${C.bord}`, boxShadow: '0 40px 120px rgba(0,0,0,.6)',
      opacity: p, transform: `translateY(${(1 - p) * 80}px)`,
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
  );
}

/** Bulle de message, qui apparaît à `debut` (images, relatives à la scène). */
function Bulle({ debut, moi = false, theme = 'wa', children }: { debut: number; moi?: boolean; theme?: 'wa' | 'tg'; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - debut, fps, config: { damping: 15, stiffness: 140 } });
  const fond = theme === 'tg' ? (moi ? '#2b5278' : TG.lui) : moi ? WA.moi : WA.lui;
  return (
    <div style={{ display: 'flex', justifyContent: moi ? 'flex-end' : 'flex-start', marginBottom: 22, opacity: f < debut ? 0 : s }}>
      <div style={{
        maxWidth: 640, padding: '20px 26px', borderRadius: 26, background: fond, color: C.blanc,
        fontFamily: SANS, fontSize: 31, lineHeight: 1.38, whiteSpace: 'pre-line',
        transform: `scale(${0.85 + 0.15 * s})`, transformOrigin: moi ? 'right bottom' : 'left bottom',
        borderBottomRightRadius: moi ? 8 : 26, borderBottomLeftRadius: moi ? 26 : 8,
      }}>{children}</div>
    </div>
  );
}

const G = ({ children }: { children: React.ReactNode }) => <b style={{ fontWeight: 700 }}>{children}</b>;

function Pastille({ debut, couleur, children }: { debut: number; couleur: string; children: React.ReactNode }) {
  return (
    <Entre debut={debut} dy={24}>
      <div style={{ padding: '18px 34px', borderRadius: 999, background: `${couleur}22`, border: `2px solid ${couleur}`, color: C.blanc, fontFamily: SANS, fontSize: 38, fontWeight: 700 }}>
        {children}
      </div>
    </Entre>
  );
}

// ── Scènes ──────────────────────────────────────────────────────────────────
function Intro({ s, d }: { s: SceneC; d: number }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 60 }}>
      <Logo taille={300} prog={t(f, 0, 40)} />
      <Entre debut={20}>
        <div style={{ fontFamily: SERIF, fontSize: 92, lineHeight: 1.06, textAlign: 'center', padding: '0 80px', color: C.blanc }}>{s.titre}</div>
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
  return (
    <>
      <Titre s={s} />
      <Telephone nom="WESTBOURSE Bourse BRVM" sous="Chaîne WhatsApp">
        <Bulle debut={14}>
          <div style={{ width: 560, height: 520, borderRadius: 18, marginBottom: 18, background: 'linear-gradient(160deg, #0a1417, #061012)', border: `1px solid ${C.bord}`, padding: 34, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: '.2em', color: C.teal }}>VIDÉO DE SÉANCE</div>
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 46, color: C.blanc }}>BRVM Composite</div>
              <div style={{ fontFamily: MONO, fontSize: 56, fontWeight: 700, color: x.composite.variation >= 0 ? '#3fe18b' : '#ff6b6b' }}>{varia(x.composite.variation)}</div>
              <div style={{ fontFamily: SANS, fontSize: 28, color: C.gris, marginTop: 10 }}>
                {x.hausses} hausses · {x.baisses} baisses
              </div>
            </div>
            <div style={{ fontFamily: SANS, fontSize: 24, color: C.sourd }}>▶ vidéo du soir</div>
          </div>
          📊 <G>BRVM — séance du {x.seanceFr}</G>
        </Bulle>
        <div style={{ position: 'absolute', left: 30, right: 30, bottom: 40, opacity: t(f, tNumero, tNumero + 14) }}>
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
  const defile = t(f, tPalm - 6, tPalm + 10) * 400;
  return (
    <>
      <Titre s={s} />
      <Telephone nom="WESTBOURSE" sous={CONTENU.numero}>
        <div style={{ transform: `translateY(${-defile}px)` }}>
          <Bulle debut={tAide} moi>AIDE</Bulle>
          <Bulle debut={tAide + 16}>
            👋 <G>Assistant WESTBOURSE</G>{'\n'}• <G>COURS SNTS</G> — dernier cours{'\n'}• <G>DIV ORAC</G> — dividendes{'\n'}• <G>PALMARES</G> — hausses du jour
          </Bulle>
          <Bulle debut={tCours} moi>COURS SNTS</Bulle>
          <Bulle debut={tCours + 16}>
            📈 <G>SNTS — SONATEL</G>{'\n'}Séance du {x.seanceFr}{'\n'}💰 Cours : <G>{nb(x.snts.cours)} FCFA</G>  {varia(x.snts.variation)}
          </Bulle>
          <Bulle debut={tPalm} moi>PALMARES</Bulle>
          <Bulle debut={tPalm + 16}>
            🏆 <G>Palmarès — séance du {x.seanceFr}</G>
            {x.palmares.map((l, i) => `\n${i + 1}. ${l.code}  ${nb(l.cours)} FCFA  ${varia(l.variation)}`).join('')}
          </Bulle>
        </div>
      </Telephone>
    </>
  );
}

function Appairage({ s, d }: { s: SceneC; d: number }) {
  const tCode = instant(s.voix, 'envoyant', d);
  return (
    <>
      <Titre s={s} />
      <Entre debut={10} style={{ position: 'absolute', left: 110, right: 110, top: 520 }}>
        <div style={{ borderRadius: 32, background: C.surface, border: `1px solid ${C.bord}`, padding: '34px 40px' }}>
          <div style={{ fontFamily: SANS, fontSize: 28, color: C.gris }}>westbourse.com · Paramètres → Mes alertes</div>
          <div style={{ fontFamily: MONO, fontSize: 84, fontWeight: 700, letterSpacing: '.18em', color: C.cyan, margin: '14px 0' }}>WB-7K3QPA</div>
          <div style={{ fontFamily: SANS, fontSize: 26, color: C.sourd }}>Code d'exemple · valable 15 minutes</div>
        </div>
      </Entre>
      <Telephone nom="WESTBOURSE" sous={CONTENU.numero} top={900} hauteur={880}>
        <Bulle debut={tCode} moi>WB-7K3QPA</Bulle>
        <Bulle debut={tCode + 20}>
          ✅ <G>Votre WhatsApp est lié à votre compte WESTBOURSE.</G>{'\n'}Tapez <G>AIDE</G> pour les commandes rapides.
        </Bulle>
      </Telephone>
    </>
  );
}

function Tuile({ debut, valeur, libelle, couleur }: { debut: number; valeur: string; libelle: string; couleur: string }) {
  return (
    <Entre debut={debut} style={{ flex: 1 }}>
      <div style={{ borderRadius: 28, background: C.surface, border: `2px solid ${couleur}`, padding: '26px 30px', textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 54, fontWeight: 700, color: couleur, whiteSpace: 'nowrap' }}>{valeur}</div>
        <div style={{ fontFamily: SANS, fontSize: 28, color: C.gris }}>{libelle}</div>
      </div>
    </Entre>
  );
}

function Assistant({ s, d }: { s: SceneC; d: number }) {
  return (
    <>
      <Titre s={s} />
      <Telephone nom="WESTBOURSE" sous="Assistant" top={560} hauteur={880}>
        <Bulle debut={14} moi>Où en est mon portefeuille ?</Bulle>
        <Bulle debut={34}>
          ⭐ <G>Abonnés Premium</G> : votre portefeuille, vos alertes et vos dossiers du samedi, ici même.{'\n'}
          <span style={{ color: WA.gris, fontSize: 26 }}>Information de marché, pas un conseil en investissement.</span>
        </Bulle>
      </Telephone>
      <div style={{ position: 'absolute', left: 110, right: 110, top: 1500, display: 'flex', gap: 30 }}>
        <Tuile debut={instant(s.voix, 'trois', d)} valeur="3 / jour" libelle="Gratuit" couleur={C.cyan} />
        <Tuile debut={instant(s.voix, 'cent en', d)} valeur="100 / jour" libelle="Premium" couleur="#F0B23A" />
      </div>
    </>
  );
}

function Soir({ s, x }: { s: SceneC; x: Donnees }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - 12, fps, config: { damping: 14, stiffness: 120 } });
  return (
    <>
      <Titre s={s} />
      <div style={{ position: 'absolute', left: 110, width: 860, top: 560, height: 1220, borderRadius: 64, background: 'linear-gradient(180deg,#0a1417,#030303)', border: `2px solid ${C.bord}` }}>
        <div style={{ textAlign: 'center', marginTop: 110, fontFamily: SANS, fontSize: 140, fontWeight: 300, color: C.blanc }}>18:05</div>
        <div style={{ margin: '80px 36px 0', borderRadius: 34, background: 'rgba(32,44,51,.92)', padding: '28px 32px', transform: `translateY(${(1 - p) * -260}px)`, opacity: p }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontFamily: SANS, fontSize: 26, color: WA.gris }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: WA.vert, display: 'inline-block' }} /> WhatsApp · WESTBOURSE
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
        <Bulle debut={14} theme="tg">
          📊 <G>BRVM — séance du {x.seanceFr}</G>{'\n'}BRVM Composite {varia(x.composite.variation)}{'\n'}{x.hausses} hausses · {x.baisses} baisses
        </Bulle>
        <Bulle debut={34} theme="tg">✈️ La vidéo de séance, chaque soir, sur le canal.</Bulle>
      </Telephone>
    </>
  );
}

function Outro({ s, d }: { s: SceneC; d: number }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 44, padding: '0 80px', textAlign: 'center' }}>
      <Logo taille={220} prog={t(f, 0, 30)} />
      <Entre debut={10}><div style={{ fontFamily: SERIF, fontSize: 96, color: C.blanc }}>{s.titre}</div></Entre>
      <Entre debut={18}><div style={{ fontFamily: MONO, fontSize: 64, fontWeight: 700, color: WA.vert }}>{CONTENU.numero}</div></Entre>
      <Entre debut={26}>
        <div style={{ fontFamily: SANS, fontSize: 34, lineHeight: 1.6, color: C.gris }}>
          📣 Chaîne WhatsApp WESTBOURSE<br />✈️ {CONTENU.telegram}
        </div>
      </Entre>
      <Entre debut={instant(s.voix, 'westbourse', d)}>
        <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 700, color: C.cyan }}>westbourse.com</div>
      </Entre>
      <div style={{ position: 'absolute', bottom: 110, fontFamily: SANS, fontSize: 26, color: C.sourd, opacity: t(f, 6, 20) }}>
        Information de marché, pas un conseil en investissement.
      </div>
    </AbsoluteFill>
  );
}

function SceneCadre({ longueur, children }: { longueur: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const o = Math.min(t(f, 0, 10), t(f, longueur - 10, longueur, 1, 0));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

// ── Montage ─────────────────────────────────────────────────────────────────
export default function Canaux({ durees, donnees }: Props) {
  if (!durees || !donnees) return <AbsoluteFill style={{ background: C.fond }} />;
  let debut = 0;
  return (
    <AbsoluteFill style={{ background: C.fond, color: C.blanc, fontFamily: SANS }}>
      <Fond teinte={WA.vert} />
      {SCENES.map((s) => {
        const d = durees[s.id];
        const longueur = Math.ceil((d + RESPIRATION) * FPS);
        const from = debut;
        debut += longueur;
        return (
          <Sequence key={s.id} from={from} durationInFrames={longueur} name={s.id}>
            <Audio src={staticFile(`canaux/${s.id}.mp3`)} />
            <SceneCadre longueur={longueur}>
              {s.id !== 'intro' && s.id !== 'outro' && <Marque />}
              {s.id === 'intro' && <Intro s={s} d={d} />}
              {s.id === 'chaine' && <Chaine s={s} d={d} x={donnees} />}
              {s.id === 'commandes' && <Commandes s={s} d={d} x={donnees} />}
              {s.id === 'appairage' && <Appairage s={s} d={d} />}
              {s.id === 'assistant' && <Assistant s={s} d={d} />}
              {s.id === 'soir' && <Soir s={s} x={donnees} />}
              {s.id === 'telegram' && <Telegram s={s} x={donnees} />}
              {s.id === 'outro' && <Outro s={s} d={d} />}
            </SceneCadre>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
