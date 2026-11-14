import { ImageResponse } from 'next/og';

/**
 * Carte de partage carrée 1080 x 1080 (événement, dossier) pour WhatsApp.
 * Rendue UNIQUEMENT depuis des valeurs déjà calculées par l'appelant : elle n'invente aucun chiffre
 * et ne porte aucune donnée personnelle. Mêmes contraintes que les autres images du site :
 * route Edge, pas d'emoji ni d'espace fine (police par défaut de next/og).
 */
const C = { fond: '#030303', carte: '#0a1417', blanc: '#FCFCFC', gris: '#A9BFC5', accent: '#56D7FD', up: '#3fe18b', down: '#ff6b6b' };

export interface DonneesCarte {
  code: string;
  /** Ligne sous le code : type, période, date. */
  contexte: string;
  /** Constat en une phrase. */
  constat: string;
  /** Le gros chiffre (déjà formaté) et sa légende. */
  chiffre: string;
  legende: string;
  sens?: 'hausse' | 'baisse' | 'neutre';
  logo: string | null;
  /** Ligne de bas de carte (source, réserve). */
  pied: string;
}

/** « +2,10 % » / « -1,50 % » en ASCII : le signe moins typographique manque à la police par défaut. */
export function pctCarte(v: number, d = 2): string {
  const s = Math.abs(v).toFixed(d).replace('.', ',');
  return `${v > 0 ? '+' : v < 0 ? '-' : ''}${s} %`;
}

export function carte1080(d: DonneesCarte): ImageResponse {
  const couleur = d.sens === 'hausse' ? C.up : d.sens === 'baisse' ? C.down : C.accent;
  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.fond, padding: 72, color: C.blanc }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {d.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.logo} width={88} height={88} style={{ borderRadius: 18, background: '#ffffff', objectFit: 'contain' }} alt="" />
          ) : (
            <div style={{ width: 88, height: 88, borderRadius: 18, background: C.carte, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, color: C.accent }}>
              {d.code.slice(0, 2)}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 42, fontWeight: 700 }}>{d.code}</div>
            <div style={{ fontSize: 26, color: C.gris }}>{d.contexte}</div>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 40, lineHeight: 1.3, marginTop: 64 }}>{d.constat}</div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
          <div style={{ display: 'flex', fontSize: 168, fontWeight: 800, color: couleur }}>{d.chiffre}</div>
          <div style={{ display: 'flex', fontSize: 34, color: C.gris, marginTop: 8 }}>{d.legende}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 48, fontSize: 24, color: C.gris }}>
          <div style={{ display: 'flex' }}>{d.pied}</div>
          <div style={{ display: 'flex', marginTop: 8, color: C.blanc }}>WESTBOURSE · westbourse.com</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
