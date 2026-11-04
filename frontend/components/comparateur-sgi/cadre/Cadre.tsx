import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, BarChart3, Layers, MapPin, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { StatistiquesSgi } from '@/lib/sgi-frais/identite';
import { NavigationComparateur } from './Navigation';

/**
 * Illustration du bandeau : architecture abstraite, bougies et tendance.
 * Aucun logo ni bâtiment réel (la marque BRVM appartient à la BRVM).
 * Décorative : invisible aux lecteurs d'écran. Le tracé et les bougies
 * s'animent en CSS pur ; leur état de repos est l'état final.
 */
function IllustrationMarche() {
  const bougies = [
    { x: 300, h: 46, y: 214 }, { x: 330, h: 62, y: 196 }, { x: 360, h: 40, y: 206 },
    { x: 390, h: 78, y: 170 }, { x: 420, h: 58, y: 168 }, { x: 450, h: 96, y: 128 },
    { x: 480, h: 70, y: 126 }, { x: 510, h: 112, y: 86 }, { x: 540, h: 88, y: 76 },
  ];
  return (
    <svg viewBox="0 0 600 320" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[62%] md:block" preserveAspectRatio="xMaxYMid slice">
      <defs>
        <radialGradient id="cmp-halo" cx="72%" cy="38%" r="55%">
          <stop offset="0" className="[stop-color:rgb(var(--color-accent-nuit))]" stopOpacity="0.28" />
          <stop offset="1" className="[stop-color:rgb(var(--color-nuit))]" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cmp-tour" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="[stop-color:rgb(var(--color-sur-nuit))]" stopOpacity="0.16" />
          <stop offset="1" className="[stop-color:rgb(var(--color-sur-nuit))]" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <rect width="600" height="320" fill="url(#cmp-halo)" />
      {/* Quadrillage */}
      {[60, 120, 180, 240].map((y) => (
        <line key={y} x1="180" x2="600" y1={y} y2={y} className="stroke-sur-nuit/[0.07]" strokeWidth="1" />
      ))}
      {/* Tours abstraites */}
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
      {/* Bougies */}
      {bougies.map((b, i) => (
        <g key={b.x} className="cmp-bougie" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
          <line x1={b.x + 7} x2={b.x + 7} y1={b.y - 12} y2={b.y + b.h + 10} className="stroke-accent-nuit/60" strokeWidth="1.5" />
          <rect x={b.x} y={b.y} width="14" height={b.h} rx="2" className={i % 3 === 2 ? 'fill-sur-nuit/25' : 'fill-accent-nuit/70'} />
        </g>
      ))}
      {/* Tendance */}
      <path
        d="M 250 250 C 320 236, 360 214, 410 182 S 500 118, 590 58"
        pathLength={1}
        strokeDasharray="1"
        className="cmp-trace fill-none stroke-accent-nuit"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="590" cy="58" r="6" className="fill-accent-nuit" />
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

export function EnteteComparateur({
  titre,
  sousTitre,
  icone: Icone,
  stats,
  filAriane = false,
}: {
  titre: string;
  sousTitre: string;
  icone?: LucideIcon;
  /** Repères DÉRIVÉS des données (vue d'ensemble seulement). */
  stats?: StatistiquesSgi;
  filAriane?: boolean;
}) {
  return (
    <header className="relative overflow-hidden bg-nuit text-sur-nuit">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgb(var(--color-accent-nuit)/0.10),transparent_60%)]" />
      <IllustrationMarche />
      <div className="relative mx-auto max-w-[1280px] px-4 pb-14 pt-8 md:px-6 md:pb-20 md:pt-12">
        {filAriane && (
          <Link href="/comparateur-sgi" className="mb-4 inline-flex min-h-[32px] items-center gap-1.5 text-xs text-sur-nuit/75 transition-colors hover:text-sur-nuit">
            <ArrowLeft size={14} aria-hidden /> Outils · Comparateur de SGI
          </Link>
        )}
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-nuit">Outil BRVM / UEMOA</p>
        {/* Un nom de SGI publié en entier (jusqu’à 70 signes) passe à une taille plus sobre. */}
        <h1 className={`mt-2 flex items-center gap-3 font-display font-semibold leading-tight [letter-spacing:-0.02em] ${titre.length > 40 ? 'text-2xl md:text-[2.15rem]' : 'text-3xl md:text-5xl'}`}>
          {Icone && <Icone aria-hidden className="h-8 w-8 flex-none text-accent-nuit md:h-11 md:w-11" />}
          {titre}
        </h1>
        <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-sur-nuit/80 md:text-base">{sousTitre}</p>
        {stats && (
          <ul className="mt-7 grid max-w-[720px] grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            <Repere icone={BarChart3} valeur={`${stats.sgi} SGI`} libelle="référencées" />
            <Repere icone={MapPin} valeur={`${stats.pays} pays`} libelle="où siègent ces SGI" />
            <Repere icone={ShieldCheck} valeur={`${stats.baremesHomologues} barèmes`} libelle="homologués AMF-UMOA" />
            <Repere icone={Layers} valeur="Coûts" libelle="détaillés poste par poste" />
          </ul>
        )}
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
