'use client';
/**
 * F1 — La saison à l'épreuve du mois en cours : le parcours du mois, séance par
 * séance, posé sur la fourchette habituelle (quartiles 25-75 %) des mêmes mois
 * passés, au même rang de séance. Ne calcule rien : trace `Confrontation`.
 */
import { useEffect, useState } from 'react';
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Confrontation } from '@/lib/seasonality/server';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const NBSP = ' ';
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1).replace('.', ',')}${NBSP}%`;
const rangFr = (n: number) => (n === 1 ? '1re' : `${n}e`);

/** Phrase d'état, sans verbe d'ordre. Exportée pour l'aperçu gratuit. */
export function phraseConfrontation(c: Confrontation): string {
  const m = MOIS[c.mois - 1]!;
  const depuis = `Depuis le début de ${m} (${rangFr(c.rangSeance)} séance) : ${pct(c.rdtEnCours)}, dividende compris.`;
  if (c.etat === 'trop_tot') return `${depuis} Trop tôt pour comparer à l’habitude : la comparaison commence à la 5e séance.`;
  if (c.etat === 'historique_insuffisant') return `${depuis} Moins de 5 années comparables : pas de fourchette habituelle.`;
  const fourchette = `Sur ${c.n} années, la fourchette habituelle à la même séance va de ${pct(c.q25!)} à ${pct(c.q75!)}`;
  const lecture = c.etat === 'au_dessus' ? 'au-dessus de son habitude' : c.etat === 'en_dessous' ? 'en dessous de son habitude' : 'dans sa fourchette habituelle';
  return `${depuis} ${fourchette} : le cours est ${lecture}.`;
}

interface Palette { accent: string; mediane: string; bande: string; grille: string; texte: string; fond: string; fort: string }
const SOMBRE: Palette = { accent: '#56d7fd', mediane: '#9aa7b0', bande: 'rgba(181,181,181,0.18)', grille: '#1f2a31', texte: '#9aa7b0', fond: '#0d1114', fort: '#e5e7eb' };
function usePalette(): Palette {
  const [p, setP] = useState(SOMBRE);
  useEffect(() => {
    const lire = () => {
      const st = getComputedStyle(document.documentElement);
      const v = (nom: string, a = 1) => {
        const t = st.getPropertyValue(nom).trim().split(/\s+/).map(Number);
        return t.length === 3 && t.every(Number.isFinite) ? `rgba(${t[0]}, ${t[1]}, ${t[2]}, ${a})` : null;
      };
      setP({
        accent: v('--color-accent') ?? SOMBRE.accent,
        mediane: v('--color-faint') ?? SOMBRE.mediane,
        bande: v('--color-muted', 0.18) ?? SOMBRE.bande,
        grille: v('--color-border') ?? SOMBRE.grille,
        texte: v('--color-faint') ?? SOMBRE.texte,
        fond: v('--color-surface', 0.95) ?? SOMBRE.fond,
        fort: v('--color-ivory') ?? SOMBRE.fort,
      });
    };
    lire();
    const o = new MutationObserver(lire);
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    return () => o.disconnect();
  }, []);
  return p;
}

export default function ConfrontationMois({ c }: { c: Confrontation }) {
  const p = usePalette();
  const rangs = Math.max(c.bande.length, c.enCours.length);
  const data = Array.from({ length: rangs }, (_, i) => {
    const b = c.bande[i];
    const e = c.enCours[i];
    return {
      rang: i + 1,
      fourchette: b && b.n >= 5 ? [b.q25 * 100, b.q75 * 100] : null,
      mediane: b && b.n >= 5 ? b.mediane * 100 : null,
      enCours: e ? e.cumul * 100 : null,
    };
  });
  const nomMois = MOIS[c.mois - 1]!;
  return (
    <figure className="space-y-3">
      <p className="text-sm text-ivory">{phraseConfrontation(c)}</p>
      {c.bande.length > 0 && (
        <div className="h-56 w-full" role="img" aria-label={`Parcours de ${nomMois} ${c.annee} comparé à la fourchette habituelle des ${nomMois} passés`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={p.grille} vertical={false} />
              <XAxis dataKey="rang" tick={{ fill: p.texte, fontSize: 12 }} tickLine={false} axisLine={{ stroke: p.grille }} />
              <YAxis tick={{ fill: p.texte, fontSize: 12 }} tickLine={false} axisLine={false} width={44}
                tickFormatter={(v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(0)}${NBSP}%`} />
              <Tooltip
                contentStyle={{ background: p.fond, border: `1px solid ${p.grille}`, borderRadius: 8, fontSize: 12, color: p.fort }}
                labelFormatter={(r) => `${rangFr(Number(r))} séance`}
                formatter={(v: unknown, nom: string) => {
                  const f = (x: number) => pct(x / 100);
                  if (Array.isArray(v)) return [`${f(v[0] as number)} à ${f(v[1] as number)}`, 'fourchette habituelle'];
                  return [f(Number(v)), nom === 'enCours' ? `${nomMois} ${c.annee}` : 'médiane des années passées'];
                }}
              />
              <Area dataKey="fourchette" stroke="none" fill={p.bande} isAnimationActive={false} connectNulls />
              <Line dataKey="mediane" stroke={p.mediane} strokeDasharray="4 4" dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls />
              <Line dataKey="enCours" stroke={p.accent} dot={false} strokeWidth={2.25} isAnimationActive={false} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <figcaption className="text-xs text-faint">
        Trait plein : {nomMois} {c.annee}. Bande grise : la moitié centrale des {nomMois} passés (15 ans au plus, mois sans
        échange écartés) ; pointillés : leur médiane. Rendements cumulés depuis la dernière clôture du mois précédent, dividende
        compris. Une habitude n’est pas une prévision.
      </figcaption>
    </figure>
  );
}
