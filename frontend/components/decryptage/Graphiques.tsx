'use client';
/**
 * Les cinq graphiques du décryptage. Ils ne calculent rien : ils tracent les
 * séries de `DecryptageDonnees`, déjà arrondies et vérifiées. Aucune
 * animation (prefers-reduced-motion respecté par construction).
 */
import { useEffect, useState } from 'react';
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { Barre, PointCours, PointDividende, PointResultat } from '@/lib/articles/decryptage';

/*
 * Couleurs lues dans les jetons du thème (globals.css), pour que les graphiques
 * suivent le mode clair comme le mode sombre. Valeurs par défaut : thème sombre.
 */
interface Palette {
  accent: string; up: string; down: string; warn: string;
  grille: string; texte: string; fort: string; mediane: string; ca: string; fond: string;
}
const SOMBRE: Palette = {
  accent: '#56d7fd', up: '#3fe18b', down: '#ff6b6b', warn: '#ffd166', grille: '#1f2a31',
  texte: '#9aa7b0', fort: '#e5e7eb', mediane: '#5b6b75', ca: '#1e4e60', fond: '#0d1114',
};
function lirePalette(): Palette {
  const st = getComputedStyle(document.documentElement);
  const v = (nom: string, a = 1) => {
    const t = st.getPropertyValue(nom).trim().split(/\s+/).map(Number);
    return t.length === 3 && t.every(Number.isFinite) ? `rgba(${t[0]}, ${t[1]}, ${t[2]}, ${a})` : null;
  };
  return {
    accent: v('--color-accent') ?? SOMBRE.accent,
    up: v('--color-up') ?? SOMBRE.up,
    down: v('--color-down') ?? SOMBRE.down,
    warn: v('--color-warn') ?? SOMBRE.warn,
    grille: v('--color-border') ?? SOMBRE.grille,
    texte: v('--color-faint') ?? SOMBRE.texte,
    fort: v('--color-ivory') ?? SOMBRE.fort,
    mediane: v('--color-faint', 0.75) ?? SOMBRE.mediane,
    ca: v('--color-accent', 0.32) ?? SOMBRE.ca,
    fond: v('--color-surface', 0.92) ?? SOMBRE.fond,
  };
}
function usePalette(): Palette {
  const [p, setP] = useState<Palette>(SOMBRE);
  useEffect(() => {
    setP(lirePalette());
    const o = new MutationObserver(() => setP(lirePalette()));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    return () => o.disconnect();
  }, []);
  return p;
}

/** Espace insécable : Recharts coupe les étiquettes sur les espaces ordinaires. */
const NBSP = ' ';
const nb = (x: number, d = 1) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
    .format(x)
    .replace(/[   ]/g, NBSP)
    .replace(/^-/, '−');
const mono = { fontFamily: 'var(--font-mono), monospace', fontSize: 11 };
const axe = (c: Palette) => ({ fill: c.texte, fontSize: 12 });
const tip = (c: Palette) => ({
  contentStyle: { background: c.fond, border: `1px solid ${c.grille}`, borderRadius: 8, fontSize: 12, color: c.fort },
  labelStyle: { color: c.fort },
  cursor: { fill: 'rgba(127,127,127,0.08)' },
});
const legende = (c: Palette) => ({
  verticalAlign: 'bottom' as const,
  iconType: 'circle' as const,
  iconSize: 8,
  wrapperStyle: { fontSize: 12, color: c.texte, paddingTop: 8 },
});

/** Étiquette lisible au-dessus d'un point : texte mono sur fond de carte. */
function EtiquetteFond({ x, y, texte, couleur, fond }: { x?: number | string; y?: number | string; texte: string; couleur: string; fond: string }) {
  if (x == null || y == null) return null;
  const w = texte.length * 6.6 + 8;
  const cx = Number(x);
  const cy = Number(y);
  return (
    <g>
      <rect x={cx - w / 2} y={cy - 24} width={w} height={16} rx={4} fill={fond} />
      <text x={cx} y={cy - 12} textAnchor="middle" fill={couleur} style={mono}>
        {texte}
      </text>
    </g>
  );
}
const unite = (v: number, suffixe: string, d?: number) => `${nb(v, d ?? (v % 1 ? 1 : 0))}${suffixe}`;

const domaine = (v: number[], pas: number, marge: number): [number, number] => {
  const min = Math.min(...v);
  const max = Math.max(...v);
  const e = Math.max(max - min, Math.abs(max) * 0.05) * marge;
  return [Math.floor((min - e) / pas) * pas, Math.ceil((max + e) / pas) * pas];
};
const graduations = (a: number, b: number, pas: number) =>
  Array.from({ length: Math.floor((b - a) / pas) + 1 }, (_, i) => a + i * pas);

export function ResultsChart({ serie }: { serie: PointResultat[] }) {
  const c = usePalette();
  const marges = serie.map((p) => p.marge).filter((x): x is number => x != null);
  const dm = marges.length ? domaine(marges, 2, 1.2) : ([0, 30] as [number, number]);
  return (
    <div className="h-[320px] md:h-[380px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={serie} margin={{ top: 28, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={c.grille} vertical={false} />
          <XAxis dataKey="exercice" tick={axe(c)} stroke={c.grille} />
          <YAxis yAxisId="md" tick={axe(c)} stroke={c.grille} tickFormatter={(v: number) => nb(v, 0)} width={52} />
          <YAxis
            yAxisId="pct"
            orientation="right"
            domain={dm}
            ticks={graduations(dm[0], dm[1], 2)}
            tick={axe(c)}
            stroke={c.grille}
            tickFormatter={(v: number) => `${nb(v, 0)}${NBSP}%`}
            width={48}
          />
          <Tooltip {...tip(c)} formatter={(v: number, k: string) => (k === 'Marge nette' ? `${nb(v)} %` : `${nb(v)} Md FCFA`)} />
          <Legend {...legende(c)} />
          <Bar yAxisId="md" dataKey="ca" name="Chiffre d’affaires" fill={c.ca} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar yAxisId="md" dataKey="rn" name="Résultat net" fill={c.accent} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Line yAxisId="pct" dataKey="marge" name="Marge nette" stroke={c.warn} strokeWidth={2} dot={{ r: 3, fill: c.warn }} isAnimationActive={false}>
            <LabelList
              dataKey="marge"
              content={(p) => <EtiquetteFond x={p.x} y={p.y} texte={unite(Number(p.value), `${NBSP}%`, 1)} couleur={c.warn} fond={c.fond} />}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DividendChart({ serie }: { serie: PointDividende[] }) {
  const c = usePalette();
  const max = Math.max(...serie.map((p) => p.montant));
  const pas = max > 400 ? 100 : 50;
  const haut = Math.ceil((max * 1.15) / pas) * pas;
  const vars = serie.map((p) => p.variation).filter((x): x is number => x != null);
  const vmax = Math.max(20, ...vars.map((v) => Math.ceil(v / 5) * 5 + 5));
  const vmin = Math.min(0, ...vars.map((v) => Math.floor(v / 5) * 5));
  const signe = (v: number) => `${v >= 0 ? '+' : ''}${unite(v, `${NBSP}%`, 1)}`;
  return (
    <div className="h-[280px] md:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={serie} margin={{ top: 28, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={c.grille} vertical={false} />
          <XAxis dataKey="exercice" tick={axe(c)} stroke={c.grille} />
          <YAxis yAxisId="f" domain={[0, haut]} ticks={graduations(0, haut, pas)} tick={axe(c)} stroke={c.grille} tickFormatter={(v: number) => nb(v, 0)} width={44} />
          <YAxis
            yAxisId="v"
            orientation="right"
            domain={[vmin, vmax]}
            ticks={graduations(vmin, vmax, 5)}
            tick={axe(c)}
            stroke={c.grille}
            tickFormatter={(v: number) => `${nb(v, 0)}${NBSP}%`}
            width={48}
          />
          <Tooltip {...tip(c)} formatter={(v: number, k: string) => (k === 'Variation annuelle' ? `${nb(v)} %` : `${nb(v, v % 1 ? 1 : 0)} F`)} />
          <Legend {...legende(c)} />
          <Bar yAxisId="f" dataKey="montant" name="Dividende net par action (F)" fill={c.up} radius={[3, 3, 0, 0]} isAnimationActive={false}>
            <LabelList dataKey="montant" position="insideTop" fill={c.fond} style={mono} formatter={(v: number) => nb(v, v % 1 ? 1 : 0)} />
          </Bar>
          <Line yAxisId="v" dataKey="variation" name="Variation annuelle" stroke={c.warn} strokeWidth={2} dot={{ r: 3, fill: c.warn }} isAnimationActive={false}>
            <LabelList
              dataKey="variation"
              content={(p) => (p.value == null ? null : <EtiquetteFond x={p.x} y={p.y} texte={signe(Number(p.value))} couleur={c.warn} fond={c.fond} />)}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PriceChart({ serie }: { serie: PointCours[] }) {
  const c = usePalette();
  const ton: Record<PointCours['ton'], string> = { neutre: c.mediane, up: c.up, down: c.down };
  const data = serie.map((p) => ({ ...p, etiquette: `${p.date}${p.ajuste ? '*' : ''}` }));
  const dom = domaine(serie.map((p) => p.cours), 100, 0.6);
  return (
    <div className="h-[280px] md:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 32, right: 24, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={c.grille} vertical={false} />
          <XAxis dataKey="etiquette" tick={axe(c)} stroke={c.grille} padding={{ left: 20, right: 20 }} />
          <YAxis
            domain={dom}
            ticks={graduations(dom[0], dom[1], dom[1] - dom[0] > 1000 ? 200 : 100)}
            tick={axe(c)}
            stroke={c.grille}
            tickFormatter={(v: number) => nb(v, 0)}
            width={52}
          />
          <Tooltip {...tip(c)} formatter={(v: number) => [`${nb(v, 0)} F`, 'Clôture']} />
          <Area dataKey="cours" stroke="none" fill={c.accent} fillOpacity={0.1} isAnimationActive={false} />
          <Line
            dataKey="cours"
            stroke={c.accent}
            strokeWidth={2}
            isAnimationActive={false}
            dot={(p: { cx?: number; cy?: number; index?: number }) => (
              <circle key={p.index} cx={p.cx} cy={p.cy} r={5} fill={ton[data[p.index ?? 0]?.ton ?? 'neutre']} stroke={c.fond} strokeWidth={2} />
            )}
          >
            <LabelList
              dataKey="cours"
              content={(p) => <EtiquetteFond x={p.x} y={p.y} texte={unite(Number(p.value), `${NBSP}F`, 0)} couleur={c.fort} fond={c.fond} />}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ProprietesEtiquette {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  index?: number;
  value?: number | string;
}

function Comparaison({ data, multiple, nom }: { data: Barre[]; multiple: boolean; nom: string }) {
  const c = usePalette();
  // Le P/B se lit au centième (3,62 contre 3,46) ; les autres multiples au dixième.
  const fmt = (v: number, indicateur: string) => (multiple ? `${nb(v, indicateur === 'P/B' ? 2 : 1)}x` : `${nb(v, 1)}${NBSP}%`);
  const radius: [number, number, number, number] = multiple ? [0, 3, 3, 0] : [3, 3, 0, 0];
  const etiquette = (teinte: string) =>
    function Etiquette(p: ProprietesEtiquette) {
      const ligne = data[p.index ?? 0];
      if (!ligne || p.value == null) return null;
      const x = Number(p.x) + (multiple ? Number(p.width) + 6 : Number(p.width) / 2);
      const y = Number(p.y) + (multiple ? Number(p.height) / 2 + 4 : -6);
      return (
        <text x={x} y={y} textAnchor={multiple ? 'start' : 'middle'} fill={teinte} style={mono}>
          {fmt(Number(p.value), ligne.indicateur)}
        </text>
      );
    };
  return (
    <div className="h-[280px] md:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={multiple ? 'vertical' : 'horizontal'} margin={{ top: 20, right: multiple ? 52 : 8, left: 4, bottom: 0 }} barGap={4}>
          <CartesianGrid stroke={c.grille} horizontal={!multiple} vertical={multiple} />
          {multiple ? (
            <>
              <XAxis type="number" tick={axe(c)} stroke={c.grille} tickFormatter={(v: number) => nb(v, 0)} />
              <YAxis type="category" dataKey="indicateur" tick={axe(c)} stroke={c.grille} width={76} />
            </>
          ) : (
            <>
              <XAxis dataKey="indicateur" tick={axe(c)} stroke={c.grille} />
              <YAxis tick={axe(c)} stroke={c.grille} tickFormatter={(v: number) => `${nb(v, 0)}${NBSP}%`} width={48} />
            </>
          )}
          <Tooltip {...tip(c)} formatter={(v: number, _k: string, item: { payload?: Barre }) => fmt(v, item.payload?.indicateur ?? '')} />
          <Legend {...legende(c)} />
          <Bar dataKey="valeur" name={nom} fill={multiple ? c.accent : c.up} radius={radius} isAnimationActive={false}>
            <LabelList dataKey="valeur" content={etiquette(c.fort)} />
          </Bar>
          <Bar dataKey="mediane" name="Médiane BRVM" fill={c.mediane} radius={radius} isAnimationActive={false}>
            <LabelList dataKey="mediane" content={etiquette(c.texte)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MultiplesChart({ data, nom }: { data: Barre[]; nom: string }) {
  return <Comparaison data={data} multiple nom={nom} />;
}

export function ProfitabilityChart({ data, nom }: { data: Barre[]; nom: string }) {
  return <Comparaison data={data} multiple={false} nom={nom} />;
}
