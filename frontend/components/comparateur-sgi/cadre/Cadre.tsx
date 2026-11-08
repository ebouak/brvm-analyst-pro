import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, BarChart3, Layers, MapPin, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { StatistiquesSgi } from '@/lib/sgi-frais/identite';
import { NavigationComparateur } from './Navigation';

/* ──────────────────────────────────────────────────────────────────────────
   Bandeau commun des outils. Illustrations décoratives (invisibles aux
   lecteurs d'écran), aucun logo ni bâtiment réel. Tout le mouvement est en
   CSS (globals.css, classes cmp-*), coupé si le système le demande : l'état
   de repos est l'état final, complet.
   ────────────────────────────────────────────────────────────────────────── */

/** Courbe de tendance, partagée par le tracé, la comète et le point d'arrivée. */
const TENDANCE = 'M 250 250 C 320 236, 360 214, 410 182 S 500 118, 590 58';

/** Décalage d'animation propre à chaque élément (respiration désynchronisée). */
const delai = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;

function Defs() {
  return (
    <defs>
      <radialGradient id="cmp-halo" cx="72%" cy="38%" r="55%">
        <stop offset="0" className="[stop-color:rgb(var(--color-accent-nuit))]" stopOpacity="0.28" />
        <stop offset="1" className="[stop-color:rgb(var(--color-nuit))]" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="cmp-tour" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" className="[stop-color:rgb(var(--color-sur-nuit))]" stopOpacity="0.16" />
        <stop offset="1" className="[stop-color:rgb(var(--color-sur-nuit))]" stopOpacity="0.02" />
      </linearGradient>
      <linearGradient id="cmp-lumiere" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" className="[stop-color:rgb(var(--color-sur-nuit))]" stopOpacity="0" />
        <stop offset="0.5" className="[stop-color:rgb(var(--color-sur-nuit))]" stopOpacity="0.09" />
        <stop offset="1" className="[stop-color:rgb(var(--color-sur-nuit))]" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

/** Tendance qui se trace, éclat qui la parcourt, point d'arrivée qui pulse. */
function Tendance() {
  return (
    <>
      <path d={TENDANCE} pathLength={1} strokeDasharray="1" className="cmp-trace fill-none stroke-accent-nuit" strokeWidth="3" strokeLinecap="round" />
      <path
        d={TENDANCE}
        pathLength={1}
        strokeDasharray="0.08 1.2"
        className="cmp-comete fill-none stroke-sur-nuit"
        strokeWidth="5"
        strokeLinecap="round"
        style={{ filter: 'drop-shadow(0 0 6px rgb(var(--color-accent-nuit)))' }}
      />
      <circle cx="590" cy="58" r="6" className="cmp-halo fill-accent-nuit" />
      <circle cx="590" cy="58" r="6" className="fill-accent-nuit" />
    </>
  );
}

function IllustrationMarche() {
  const bougies = [
    { x: 300, h: 46, y: 214 }, { x: 330, h: 62, y: 196 }, { x: 360, h: 40, y: 206 },
    { x: 390, h: 78, y: 170 }, { x: 420, h: 58, y: 168 }, { x: 450, h: 96, y: 128 },
    { x: 480, h: 70, y: 126 }, { x: 510, h: 112, y: 86 }, { x: 540, h: 88, y: 76 },
  ];
  return (
    <svg viewBox="0 0 600 320" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[62%] md:block" preserveAspectRatio="xMaxYMid slice">
      <Defs />
      <rect width="600" height="320" fill="url(#cmp-halo)" />
      {[60, 120, 180, 240].map((y) => (
        <line key={y} x1="180" x2="600" y1={y} y2={y} className="stroke-sur-nuit/[0.07]" strokeWidth="1" />
      ))}
      {/* Tours abstraites, balayées par une lumière lente */}
      {[
        { x: 200, y: 120, w: 70 }, { x: 278, y: 70, w: 92 }, { x: 378, y: 150, w: 60 }, { x: 560, y: 40, w: 60 },
      ].map((t) => (
        <g key={t.x}>
          <rect x={t.x} y={t.y} width={t.w} height={320 - t.y} fill="url(#cmp-tour)" />
          {Array.from({ length: Math.floor(t.w / 14) }, (_, i) => (
            <line key={i} x1={t.x + 8 + i * 14} x2={t.x + 8 + i * 14} y1={t.y + 10} y2={320} className="stroke-sur-nuit/[0.08]" strokeWidth="1" />
          ))}
        </g>
      ))}
      <rect x="0" y="0" width="160" height="320" fill="url(#cmp-lumiere)" className="cmp-balayage" />
      {bougies.map((b, i) => (
        <g key={b.x} className="cmp-bougie" style={delai(0.1 + i * 0.07)}>
          <line x1={b.x + 7} x2={b.x + 7} y1={b.y - 12} y2={b.y + b.h + 10} className="stroke-accent-nuit/60" strokeWidth="1.5" />
          <rect x={b.x} y={b.y} width="14" height={b.h} rx="2" className={i % 3 === 2 ? 'fill-sur-nuit/25' : 'fill-accent-nuit/70'} />
        </g>
      ))}
      <Tendance />
    </svg>
  );
}

/** Variante « épargne » : piles de pièces qui montent, une pièce qui tombe. */
function IllustrationEpargne() {
  const piles = [
    { x: 300, n: 4 }, { x: 362, n: 7 }, { x: 424, n: 10 }, { x: 486, n: 14 }, { x: 548, n: 19 },
  ];
  const BAS = 300;
  const PAS = 10;
  const sommet = piles[piles.length - 1]!;
  return (
    <svg viewBox="0 0 600 320" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[62%] md:block" preserveAspectRatio="xMaxYMid slice">
      <Defs />
      <rect width="600" height="320" fill="url(#cmp-halo)" />
      {[60, 120, 180, 240].map((y) => (
        <line key={y} x1="180" x2="600" y1={y} y2={y} className="stroke-sur-nuit/[0.07]" strokeWidth="1" />
      ))}
      <rect x="0" y="0" width="160" height="320" fill="url(#cmp-lumiere)" className="cmp-balayage" />
      {piles.map((p, i) => (
        <g key={p.x} className="cmp-pile" style={delai(0.12 + i * 0.12)}>
          {Array.from({ length: p.n }, (_, k) => {
            const y = BAS - k * PAS;
            return (
              <g key={k}>
                <rect x={p.x - 24} y={y - 7} width="48" height="8" className={k % 2 ? 'fill-accent-nuit/55' : 'fill-accent-nuit/40'} />
                <ellipse cx={p.x} cy={y - 7} rx="24" ry="6" className="fill-accent-nuit/80 stroke-sur-nuit/30" strokeWidth="1" />
              </g>
            );
          })}
        </g>
      ))}
      {/* Pièce qui rejoint la plus haute pile */}
      <ellipse cx={sommet.x} cy={BAS - sommet.n * PAS - 7} rx="24" ry="6" className="cmp-piece fill-sur-nuit/80" />
      <Tendance />
    </svg>
  );
}

function Repere({ icone: Icone, valeur, libelle }: { icone: LucideIcon; valeur?: string; libelle: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-full border border-sur-nuit/20 bg-sur-nuit/[0.06]">
        <Icone size={18} aria-hidden className="text-accent-nuit" />
      </span>
      <span className="text-[13px] leading-tight text-sur-nuit/80">
        {valeur && <b className="tabular block text-[15px] font-semibold text-sur-nuit">{valeur}</b>}
        {libelle}
      </span>
    </li>
  );
}

export interface ElementBande {
  libelle: string;
  valeur: string;
  /** Variation ou précision, colorée selon `ton`. */
  detail?: string;
  ton?: 'up' | 'down' | 'neutre';
}

/**
 * Bande de données RÉELLES qui défile (SGI et coût, actions et cours…).
 * Pause au survol et au focus ; immobile et défilable à la main si le
 * système limite les animations. La seconde copie, qui boucle la bande,
 * est masquée aux lecteurs d'écran.
 */
function Bande({ elements, titre }: { elements: ElementBande[]; titre: string }) {
  const ton = { up: 'text-up', down: 'text-down', neutre: 'text-sur-nuit/60' } as const;
  const liste = (copie: boolean) => (
    <ul className="flex flex-none items-center" aria-hidden={copie || undefined}>
      {elements.map((e, i) => (
        <li key={`${copie}-${i}`} className="flex items-baseline gap-2 whitespace-nowrap px-5 text-[13px]">
          <span className="font-semibold text-sur-nuit">{e.libelle}</span>
          <span className="tabular text-sur-nuit/80">{e.valeur}</span>
          {e.detail && <span className={`tabular text-[12px] ${ton[e.ton ?? 'neutre']}`}>{e.detail}</span>}
          <span aria-hidden className="pl-3 text-accent-nuit/50">•</span>
        </li>
      ))}
    </ul>
  );
  return (
    // Fond presque opaque : la bande passe devant l'illustration (pièces,
    // bougies claires) et doit rester lisible par-dessus.
    <section aria-label={titre} className="cmp-defile-cadre relative z-10 mt-8 rounded-lg border border-sur-nuit/10 bg-nuit/85 py-2.5 backdrop-blur-sm">
      <div tabIndex={0} role="region" aria-label="Bandeau défilant, utilisez les flèches pour le parcourir" className="overflow-hidden motion-reduce:overflow-x-auto [mask-image:linear-gradient(90deg,transparent,#000_5%,#000_95%,transparent)]">
        <div className="cmp-defile flex w-max" style={{ '--duree': `${Math.max(30, elements.length * 3.2)}s` } as CSSProperties}>
          {liste(false)}
          {liste(true)}
        </div>
      </div>
    </section>
  );
}

export function EnteteComparateur({
  titre,
  sousTitre,
  icone: Icone,
  stats,
  reperes,
  filAriane = false,
  retour,
  surtitre,
  variante = 'marche',
  bande,
}: {
  titre: string;
  sousTitre: string;
  icone?: LucideIcon;
  /** Repères DÉRIVÉS des données (vue d'ensemble seulement). */
  stats?: StatistiquesSgi;
  /** Repères d'un autre outil, eux aussi tirés des données. */
  reperes?: { icone: LucideIcon; valeur?: string; libelle: string }[];
  /** Lien de retour vers le comparateur. */
  filAriane?: boolean;
  /** Lien de retour vers une autre page (remplace `filAriane`). */
  retour?: { href: string; libelle: string };
  surtitre?: string;
  /** Illustration : bougies de cours, ou piles de pièces pour l'épargne. */
  variante?: 'marche' | 'epargne';
  /** Bande défilante de données réelles ; absente si vide. */
  bande?: { titre: string; elements: ElementBande[] };
}) {
  const lienRetour = retour ?? (filAriane ? { href: '/comparateur-sgi', libelle: 'Outils · Comparateur de SGI' } : null);
  const listeReperes =
    stats != null
      ? [
          { icone: BarChart3, valeur: `${stats.sgi} SGI`, libelle: 'référencées' },
          { icone: MapPin, valeur: `${stats.pays} pays`, libelle: 'où siègent ces SGI' },
          { icone: ShieldCheck, valeur: `${stats.baremesHomologues} barèmes`, libelle: 'homologués AMF-UMOA' },
          { icone: Layers, valeur: 'Coûts', libelle: 'détaillés poste par poste' },
        ]
      : reperes ?? [];
  return (
    <header className="relative overflow-hidden bg-nuit text-sur-nuit">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgb(var(--color-accent-nuit)/0.10),transparent_60%)]" />
      {variante === 'epargne' ? <IllustrationEpargne /> : <IllustrationMarche />}
      <div className="relative mx-auto max-w-[1280px] px-4 pb-14 pt-8 md:px-6 md:pb-20 md:pt-12">
        {lienRetour && (
          <Link href={lienRetour.href} className="mb-4 inline-flex min-h-[32px] items-center gap-1.5 text-xs text-sur-nuit/75 transition-colors hover:text-sur-nuit">
            <ArrowLeft size={14} aria-hidden /> {lienRetour.libelle}
          </Link>
        )}
        {surtitre && <p className="font-mono text-[11px] font-semibold text-accent-nuit">{surtitre}</p>}
        {/* Un nom de SGI publié en entier (jusqu’à 70 signes) passe à une taille plus sobre. */}
        <h1 className={`mt-2 flex items-center gap-3 font-display font-semibold leading-tight [letter-spacing:-0.02em] ${titre.length > 40 ? 'text-2xl md:text-[2.15rem]' : 'text-3xl md:text-5xl'}`}>
          {Icone && <Icone aria-hidden className="h-8 w-8 flex-none text-accent-nuit md:h-11 md:w-11" />}
          {titre}
        </h1>
        <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-sur-nuit/80 md:text-base">{sousTitre}</p>
        {listeReperes.length > 0 && (
          <ul className="cmp-revele mt-7 grid max-w-[720px] grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            {listeReperes.map((r) => (
              <Repere key={r.libelle} icone={r.icone} valeur={r.valeur} libelle={r.libelle} />
            ))}
          </ul>
        )}
        {bande && bande.elements.length > 0 && <Bande titre={bande.titre} elements={bande.elements} />}
      </div>
    </header>
  );
}

/** Bandeau + navigation entre modules + contenu centré (1280 px). */
export function CadreComparateur({
  entete,
  nbSgi,
  children,
}: {
  entete: Parameters<typeof EnteteComparateur>[0];
  nbSgi: number;
  children: ReactNode;
}) {
  return (
    <>
      <EnteteComparateur {...entete} />
      <NavigationComparateur nbSgi={nbSgi} />
      <div className="mx-auto max-w-[1280px] px-4 py-8 md:px-6 md:py-10">{children}</div>
    </>
  );
}
