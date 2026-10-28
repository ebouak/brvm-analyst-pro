import { ImageResponse } from 'next/og';
import { LIBELLE_TYPE, type Article } from './types';

/**
 * Carte d'un article, rendue UNIQUEMENT depuis `article.chiffres` : elle ne
 * peut pas montrer un chiffre que l'article ne contient pas (le scraper a déjà
 * vérifié ces chiffres contre la liste blanche).
 *
 * Pas d'emoji ni d'espace fine : la police par défaut de next/og ne les a pas.
 * Rendu par une route Edge, comme toutes les images du site (voir lib/recap/rendu.tsx).
 */
const C = { fond: '#030303', carte: '#0a1417', blanc: '#FCFCFC', gris: '#A9BFC5', teal: '#16B6A4', accent: '#56D7FD' };
export const FORMATS = { paysage: [1200, 630], carre: [1080, 1080] } as const;
export type FormatImage = keyof typeof FORMATS;

function trace(serie: [string, number][], l: number, h: number): string {
  const v = serie.map((s) => s[1]);
  const min = Math.min(...v);
  const max = Math.max(...v);
  const ech = max > min ? max - min : 1;
  return v
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${((i / (v.length - 1)) * l).toFixed(1)},${(h - ((y - min) / ech) * h).toFixed(1)}`)
    .join(' ');
}

export function imageArticle(a: Article, format: FormatImage, logo: string | null): ImageResponse {
  const [L, H] = FORMATS[format];
  const carre = format === 'carre';
  const serie = (a.chiffres.serie ?? []).filter((s) => Number.isFinite(s[1]));
  const lc = L - 128;
  const hc = carre ? 300 : 140;
  const img = a.chiffres.image;
  const date = new Date(`${a.date_fait}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return new ImageResponse(
    (
      <div style={{ width: L, height: H, display: 'flex', flexDirection: 'column', background: C.fond, padding: 64, color: C.blanc }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={72} height={72} style={{ borderRadius: 16, background: '#ffffff', objectFit: 'contain' }} alt="" />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: 16, background: C.carte, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: C.accent }}>
              {(a.code ?? 'WB').slice(0, 2)}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{a.code ?? 'BRVM'}</div>
            <div style={{ fontSize: 22, color: C.gris }}>{`${LIBELLE_TYPE[a.type] ?? 'Article'} · ${date}`}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: carre ? 72 : 36 }}>
          <div style={{ fontSize: carre ? 128 : 96, fontWeight: 800, color: C.accent }}>{img?.chiffre ?? ''}</div>
          <div style={{ fontSize: carre ? 38 : 30, color: C.gris, marginTop: 8 }}>{img?.legende ?? ''}</div>
        </div>
        {serie.length > 1 ? (
          <svg width={lc} height={hc} style={{ marginTop: 'auto' }}>
            <path d={trace(serie, lc, hc)} fill="none" stroke={C.teal} strokeWidth={4} />
          </svg>
        ) : (
          <div style={{ marginTop: 'auto', display: 'flex' }} />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, fontSize: 22, color: C.gris }}>
          <div>WESTBOURSE · westbourse.com</div>
          <div>{serie.length > 1 ? 'Cours sur un an · Source : BRVM' : 'Source : BRVM'}</div>
        </div>
      </div>
    ),
    { width: L, height: H, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
