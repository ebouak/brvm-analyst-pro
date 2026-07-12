import type { EmbedTheme } from '@/lib/embed/params';

export interface TickerItem {
  code: string;
  cours: number | null;
  variation: number | null;
}

const fmt = (v: number | null) => (v == null ? '—' : v.toLocaleString('fr-FR'));

/**
 * Bandeau défilant des cours. Composant SERVEUR : zéro JavaScript — le
 * défilement est une animation CSS pure (cf. .wb-ticker-track dans globals.css).
 * Doit rester fonctionnel avec JS désactivé (test T3).
 */
export default function TickerStrip({ items, theme }: { items: TickerItem[]; theme: EmbedTheme }) {
  const dark = theme === 'dark';
  // Piste dupliquée : l'animation translateX(-50 %) boucle alors sans saut visible.
  const track = [...items, ...items];
  return (
    <div className="wb-ticker overflow-hidden">
      <div className="wb-ticker-track">
        {track.map((it, i) => {
          const up = (it.variation ?? 0) >= 0;
          return (
            <span
              key={`${it.code}-${i}`}
              className={`flex shrink-0 items-baseline gap-1.5 whitespace-nowrap border-r px-3 text-[13px] ${
                dark ? 'border-[#1a2a30]' : 'border-[#e6e8ea]'
              }`}
            >
              <b className="font-semibold">{it.code}</b>
              <span className="tabular-nums">{fmt(it.cours)}</span>
              <span className={`tabular-nums ${up ? 'text-[#3fe18b]' : 'text-[#ff6b6b]'}`}>
                {it.variation == null ? '—' : `${up ? '+' : ''}${it.variation.toFixed(2)}%`}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
