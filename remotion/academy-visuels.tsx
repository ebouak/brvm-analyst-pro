import React from 'react';
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { C, t } from './ecosysteme';

/**
 * Habillage « motion design » des vidéos Academy : un narrateur animé dont la
 * bouche suit la VRAIE voix (amplitude de la piste), des pictogrammes qui se
 * dessinent selon le sujet du paragraphe, et la photo de la leçon en mouvement.
 * Décoratif uniquement : aucun chiffre, aucun texte de fond n'est produit ici.
 */

// ── Pictogrammes (traits 48×48, dessinés progressivement) ──────────────────
const PICTOS: Record<string, string[]> = {
  banque: ['M6 18 L24 8 L42 18 Z', 'M10 22 v14 M18 22 v14 M30 22 v14 M38 22 v14', 'M6 40 h36'],
  telephone: ['M16 5 h16 a3 3 0 0 1 3 3 v32 a3 3 0 0 1 -3 3 h-16 a3 3 0 0 1 -3 -3 v-32 a3 3 0 0 1 3 -3 Z', 'M21 38 h6'],
  pieces: ['M8 30 a10 4 0 1 0 20 0 a10 4 0 1 0 -20 0', 'M8 30 v6 a10 4 0 0 0 20 0 v-6', 'M20 16 a10 4 0 1 0 20 0 a10 4 0 1 0 -20 0', 'M20 16 v6 a10 4 0 0 0 20 0 v-6'],
  billet: ['M5 14 h38 v20 h-38 Z', 'M24 24 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0', 'M10 19 v10 M38 19 v10'],
  hausse: ['M6 40 h36', 'M8 34 L18 24 L26 30 L40 14', 'M32 14 h8 v8'],
  baisse: ['M6 40 h36', 'M8 14 L18 24 L26 18 L40 34', 'M32 34 h8 v-8'],
  calendrier: ['M7 11 h34 v30 h-34 Z', 'M7 19 h34', 'M15 6 v9 M33 6 v9', 'M14 26 h4 M22 26 h4 M30 26 h4 M14 33 h4 M22 33 h4'],
  bouclier: ['M24 5 L40 11 v12 c0 10 -7 17 -16 20 c-9 -3 -16 -10 -16 -20 v-12 Z', 'M17 24 l5 5 l9 -10'],
  alerte: ['M24 6 L43 40 h-38 Z', 'M24 18 v11', 'M24 34 v1'],
  cadenas: ['M12 22 h24 v19 h-24 Z', 'M17 22 v-6 a7 7 0 0 1 14 0 v6', 'M24 29 v5'],
  globe: ['M24 24 m-18 0 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0', 'M6 24 h36', 'M24 6 c-7 6 -7 30 0 36 c7 -6 7 -30 0 -36'],
  diplome: ['M4 18 L24 9 L44 18 L24 27 Z', 'M12 22 v10 c6 5 18 5 24 0 v-10', 'M44 18 v12'],
  maison: ['M6 22 L24 8 L42 22', 'M11 19 v22 h26 v-22', 'M20 41 v-11 h8 v11'],
  document: ['M12 5 h17 l9 9 v29 h-26 Z', 'M29 5 v9 h9', 'M17 23 h14 M17 29 h14 M17 35 h9'],
  horloge: ['M24 24 m-18 0 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0', 'M24 13 v11 l8 6'],
  camembert: ['M24 24 m-17 0 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0', 'M24 7 v17 h17', 'M24 24 L12 36'],
  cible: ['M24 24 m-17 0 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0', 'M24 24 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0', 'M24 24 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0'],
  ampoule: ['M24 6 a12 12 0 0 1 7 22 v5 h-14 v-5 a12 12 0 0 1 7 -22 Z', 'M18 38 h12 M20 43 h8'],
  urne: ['M8 22 h32 v19 h-32 Z', 'M18 22 v-14 h12 v14', 'M14 29 h20'],
  immeuble: ['M10 42 v-32 h18 v32', 'M28 42 v-20 h10 v20', 'M15 16 h3 M21 16 h3 M15 23 h3 M21 23 h3 M15 30 h3 M21 30 h3', 'M6 42 h36'],
  echange: ['M8 17 h30 l-7 -7', 'M40 31 h-30 l7 7'],
  carte: ['M5 12 h38 v24 h-38 Z', 'M5 19 h38', 'M10 29 h10'],
  flamme: ['M24 42 c-9 0 -13 -7 -11 -14 c2 -6 7 -8 7 -16 c6 4 13 11 13 20 c0 6 -3 10 -9 10 Z'],
  antenne: ['M24 22 v20', 'M16 42 h16', 'M14 12 a14 14 0 0 1 20 0', 'M9 7 a21 21 0 0 1 30 0', 'M24 22 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0'],
  livre: ['M24 12 c-6 -4 -13 -4 -18 -2 v28 c5 -2 12 -2 18 2 c6 -4 13 -4 18 -2 v-28 c-5 -2 -12 -2 -18 2 Z', 'M24 12 v28'],
  etoile: ['M24 5 L29 18 L43 18 L32 27 L36 41 L24 33 L12 41 L16 27 L5 18 L19 18 Z'],
  loupe: ['M20 20 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0', 'M29 29 L42 42'],
  personnes: ['M17 17 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0', 'M6 40 c0 -8 5 -12 11 -12 s11 4 11 12', 'M33 18 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0', 'M30 28 c7 0 12 3 12 11'],
};

const REGLES: [RegExp, string][] = [
  [/fraude|arnaque|escroqu|alerte|danger|attention/, 'alerte'],
  [/r[ée]gul|crepmf|amf|sanction|prot[èe]g|loi\b|agr[ée]/, 'bouclier'],
  [/dividende|b[ée]n[ée]fice|coupon|revenu|salaire/, 'pieces'],
  [/carte bancaire|\bcarte\b/, 'carte'],
  [/t[ée]l[ée]phone|mobile|whatsapp|application|\bapp\b|telegram/, 'telephone'],
  [/diaspora|[ée]tranger|lyon|paris|france|international|monde/, 'globe'],
  [/scolarit|enfant|[ée]tudiant|[ée]cole|formation|universit/, 'diplome'],
  [/loyer|maison|immobilier|logement/, 'maison'],
  [/hausse|monte|croissance|progress|gagn|plus-value|multipli/, 'hausse'],
  [/baisse|perte|chute|recul|krach/, 'baisse'],
  [/calendrier|assembl[ée]e|\bag\b|date|d[ée]tachement|[ée]ch[ée]ance/, 'calendrier'],
  [/horizon|long terme|patience|ann[ée]es|s[ée]ance|heure/, 'horloge'],
  [/diversif|r[ée]partition|portefeuille|secteur/, 'camembert'],
  [/objectif|strat[ée]gie|cible|but\b/, 'cible'],
  [/vote|voix|d[ée]cision/, 'urne'],
  [/ordre|ach[eè]t|vend|transaction|n[ée]goci/, 'echange'],
  [/document|relev[ée]|justificatif|formulaire|cni|kyc|compte-titres|dossier/, 'document'],
  [/s[ée]cur|confiance|garanti|coffre/, 'cadenas'],
  [/sgi|banque|bancaire|courtier|interm[ée]diaire|bourse r[ée]gionale|brvm/, 'banque'],
  [/action|actionnaire|entreprise|soci[ée]t[ée]|copropri/, 'immeuble'],
  [/[ée]nergie|p[ée]trol|carburant/, 'flamme'],
  [/t[ée]l[ée]com|sonatel|orange|op[ée]rateur/, 'antenne'],
  [/investisseur|client|particulier|famille|personne/, 'personnes'],
  [/argent|fcfa|francs|d[ée]p[ôo]t|[ée]pargne|capital|montant|prix|frais|co[ûu]t/, 'billet'],
  [/r[ée]flexe|astuce|conseil|retenir|id[ée]e/, 'ampoule'],
];
const PAR_TYPE: Record<string, string> = { definition: 'livre', importance: 'etoile', cas: 'loupe', piege: 'alerte', retenir: 'ampoule', lexique: 'livre', intro: 'livre' };

/** Pictogramme le plus parlant pour un texte (premier mot-clé reconnu), sinon celui du type de section. */
export function choisirPicto(texte: string, type: string): string {
  const s = texte.toLowerCase();
  for (const [re, nom] of REGLES) if (re.test(s)) return nom;
  return PAR_TYPE[type] ?? 'etoile';
}

/** Pictogramme qui se dessine trait par trait, puis rebondit. */
export function Pictogramme({ nom, debut, taille = 64, couleur }: { nom: string; debut: number; taille?: number; couleur: string }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const traits = PICTOS[nom] ?? PICTOS.etoile;
  const rebond = spring({ frame: f - debut - 14, fps, config: { damping: 8, stiffness: 180 } });
  return (
    <div style={{ width: taille, height: taille, borderRadius: taille * 0.28, background: `${couleur}1f`, border: `1.5px solid ${couleur}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      transform: `scale(${0.85 + 0.15 * rebond}) rotate(${(1 - rebond) * -8}deg)`, boxShadow: `0 0 ${18 * rebond}px ${couleur}55` }}>
      <svg width={taille * 0.66} height={taille * 0.66} viewBox="0 0 48 48" fill="none">
        {traits.map((d, i) => (
          <path key={i} d={d} stroke={couleur} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - t(f, debut + i * 4, debut + i * 4 + 16)} />
        ))}
      </svg>
    </div>
  );
}

// ── Narrateur animé ─────────────────────────────────────────────────────────
/** Ouverture de la bouche (0..1) d'après l'amplitude réelle de la voix à cette image. */
function useParole(src: string | null): number {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audio = useAudioData(src ?? '');
  if (!src || !audio) return 0;
  const v = visualizeAudio({ fps, frame: f, audioData: audio, numberOfSamples: 16 });
  const m = v.slice(0, 8).reduce((a, x) => a + x, 0) / 8;
  return Math.min(1, m * 9);
}

/**
 * « Wes », narrateur WestBourse : respire, cligne des yeux, parle avec la voix,
 * et désigne le contenu (`gestes` = images où il pointe : apparition d'un bloc).
 */
export function Mascotte({ src, teinte, taille = 300, gestes = [], entree = 0, salut = false }: {
  src: string | null; teinte: string; taille?: number; gestes?: number[]; entree?: number; salut?: boolean;
}) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const parole = useParole(src);
  const arrivee = spring({ frame: f - entree, fps, config: { damping: 13, stiffness: 110 } });
  const souffle = Math.sin(f / 14) * 0.012;
  const clin = f % 96 > 92 ? 0.15 : 1;
  // Bras : se lève brièvement à chaque geste, ou s'agite pour saluer.
  const dernier = gestes.filter((g) => g <= f).pop();
  const leve = salut
    ? 0.75 + 0.25 * Math.sin(f / 4)
    : dernier != null ? Math.max(0, 1 - Math.abs(f - dernier - 10) / 22) : 0;
  const bras = interpolate(leve, [0, 1], [8, -62]);
  const bouche = 2 + parole * 11;
  return (
    <svg width={taille} height={taille * 1.25} viewBox="0 0 200 250"
      style={{ overflow: 'visible', opacity: arrivee, transform: `translateY(${(1 - arrivee) * 80}px) scale(${1 + souffle}, ${1 - souffle})`, transformOrigin: 'bottom center',
        filter: 'drop-shadow(0 18px 30px rgba(0,0,0,.55))' }}>
      <ellipse cx={100} cy={244} rx={62} ry={7} fill="#000" opacity={0.35} />
      <path d="M58 150 C 44 175, 44 200, 52 222" stroke={teinte} strokeWidth={20} strokeLinecap="round" fill="none" />
      <path d="M50 245 L 56 140 Q 100 118 144 140 L 150 245 Z" fill={teinte} />
      <path d="M86 128 L 100 165 L 114 128 Z" fill="#F4F1EA" />
      <path d="M100 136 L 94 150 L 100 190 L 106 150 Z" fill={C.fond} />
      <path d="M86 128 L 72 150 M114 128 L 128 150" stroke="rgba(0,0,0,.25)" strokeWidth={3} />
      <g transform={`rotate(${bras} 144 146)`}>
        <path d="M144 146 C 160 170, 164 196, 156 222" stroke={teinte} strokeWidth={20} strokeLinecap="round" fill="none" />
        <circle cx={156} cy={226} r={11} fill="#8D5524" />
      </g>
      <rect x={90} y={108} width={20} height={22} rx={6} fill="#7A4A21" />
      <circle cx={100} cy={78} r={40} fill="#8D5524" />
      <path d="M62 70 Q 64 36 100 34 Q 138 36 138 70 Q 126 54 100 54 Q 76 54 62 70 Z" fill="#1E1410" />
      <ellipse cx={86} cy={80} rx={4.5} ry={5.5 * clin} fill="#1E1410" />
      <ellipse cx={114} cy={80} rx={4.5} ry={5.5 * clin} fill="#1E1410" />
      <path d="M79 69 q7 -4 14 0 M107 69 q7 -4 14 0" stroke="#1E1410" strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <ellipse cx={100} cy={98} rx={9} ry={bouche / 2} fill="#3B1A12" />
      <path d={`M90 ${97 - bouche / 2} q10 -3 20 0`} stroke="#5A2A1C" strokeWidth={2} fill="none" />
    </svg>
  );
}

// ── Photo de la leçon, en mouvement lent (Ken Burns) ────────────────────────
export function PhotoFond({ url, credit, teinte, duree }: { url: string; credit?: string; teinte: string; duree: number }) {
  const f = useCurrentFrame();
  const z = 1.08 + 0.1 * (f / Math.max(1, duree));
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <Img src={url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z}) translateX(${-f * 0.08}px)`, filter: 'saturate(.85) brightness(.55)' }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(100deg, ${C.fond} 18%, ${C.fond}cc 45%, ${teinte}33 100%)` }} />
      </div>
      {credit && <div style={{ position: 'absolute', right: 90, bottom: 80, fontSize: 15, color: C.sourd, opacity: t(f, 20, 40) }}>{credit}</div>}
    </>
  );
}
