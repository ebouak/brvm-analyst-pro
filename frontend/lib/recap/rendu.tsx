import 'server-only';
import { ImageResponse } from 'next/og';
import type { Recap } from './calcul';

/**
 * Image de la récap (1080×1350, portrait — le format qu'affichent sans
 * recadrage WhatsApp, Telegram et les e-mails sur téléphone).
 *
 * Donnée PERSONNELLE et financière : l'image n'est jamais stockée, jamais
 * mise en cache partagé, et ne porte que des chiffres calculés (calcul.ts).
 * Pas d'emoji ni d'espace fine insécable : la police par défaut de next/og ne
 * les a pas, ils s'afficheraient en carrés vides.
 *
 * Rendu UNIQUEMENT par la route Edge /api/recap/image, comme toutes les images
 * du site : en runtime Node, @vercel/og bâtit sous Windows un chemin de police
 * invalide (constaté le 2026-10-24). Les envois demandent l'image à la route.
 */
export const LARGEUR = 1080;
export const HAUTEUR = 1350;

const C = {
  fond: '#030303', carte: '#0a1417', bord: 'rgba(255,255,255,0.10)', blanc: '#FCFCFC',
  gris: '#A9BFC5', sourd: '#7A8A90', teal: '#16B6A4', hausse: '#3fe18b', baisse: '#ff6b6b',
};
const PALETTE = ['#16B6A4', '#56D7FD', '#F0B23A', '#B69BF0', '#7A8A90'];

const nombre = (x: number, d = 0) =>
  x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[  ]/g, ' ');
const fcfa = (x: number) => `${nombre(Math.round(x))} FCFA`;
const signe = (x: number) => (x > 0 ? '+' : x < 0 ? '-' : '');
const pct = (x: number) => `${signe(x)}${nombre(Math.abs(x), 2)} %`;
const montant = (x: number) => `${signe(x)}${fcfa(Math.abs(x))}`;
const ton = (x: number) => (x > 0 ? C.hausse : x < 0 ? C.baisse : C.gris);

function Logo({ taille }: { taille: number }) {
  return (
    <svg width={taille} height={taille * 0.78} viewBox="6 4 122 90">
      <path d="M16 24 L40 82 L58 48 L76 82" fill="none" stroke={C.blanc} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M76 82 L100 33" fill="none" stroke={C.teal} strokeWidth={12} strokeLinecap="round" />
      <polygon points="110,12 117,40 86,28" fill={C.teal} />
    </svg>
  );
}

function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: C.carte, border: `2px solid ${C.bord}`, borderRadius: 28, padding: '26px 30px' }}>
      <div style={{ display: 'flex', fontSize: 24, letterSpacing: 3, color: C.sourd, marginBottom: 14 }}>{titre.toUpperCase()}</div>
      {children}
    </div>
  );
}

function Ligne({ gauche, droite, couleur }: { gauche: string; droite: string; couleur?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 32, padding: '6px 0' }}>
      <span style={{ color: C.blanc, fontWeight: 700 }}>{gauche}</span>
      <span style={{ color: couleur ?? C.gris }}>{droite}</span>
    </div>
  );
}

export function imageRecap(r: Recap, prenom?: string | null): ImageResponse {
  const vide = (t: string) => <div style={{ display: 'flex', fontSize: 28, color: C.sourd }}>{t}</div>;
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.fond, color: C.blanc, padding: '56px 60px' }}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Logo taille={64} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 6 }}>WESTBOURSE</span>
              <span style={{ fontSize: 24, color: C.gris }}>{prenom ? `Portefeuille de ${prenom}` : 'Mon portefeuille'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 22, color: C.sourd }}>SÉANCE DU</span>
            <span style={{ fontSize: 30, fontWeight: 700 }}>{r.seanceFr}</span>
          </div>
        </div>

        {/* Valeur, plus-value, séance */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 44 }}>
          <span style={{ fontSize: 26, color: C.gris }}>Valeur du portefeuille</span>
          <span style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05 }}>{fcfa(r.valeur)}</span>
          <div style={{ display: 'flex', gap: 22, marginTop: 10, fontSize: 32 }}>
            <span style={{ color: C.gris }}>Plus-value latente</span>
            <span style={{ color: ton(r.pnl), fontWeight: 700 }}>
              {/* latentPnlPct de derivePortfolio est une FRACTION (0,12 = 12 %). */}
              {`${montant(r.pnl)}${r.pnlPct != null ? `  (${pct(r.pnlPct * 100)})` : ''}`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 22, marginTop: 6, fontSize: 32 }}>
            <span style={{ color: C.gris }}>Séance du jour</span>
            <span style={{ color: r.varJour ? ton(r.varJour.montant) : C.sourd, fontWeight: 700 }}>
              {r.varJour ? `${montant(r.varJour.montant)}  (${pct(r.varJour.pct)})` : 'aucun de vos titres n’a coté'}
            </span>
          </div>
        </div>

        {/* Mouvements du jour */}
        <div style={{ display: 'flex', gap: 24, marginTop: 40 }}>
          <Carte titre="En hausse aujourd'hui">
            {r.meilleures.length ? r.meilleures.map((l) => <Ligne key={l.code} gauche={l.code} droite={pct(l.variation)} couleur={C.hausse} />) : vide('Aucune ligne en hausse')}
          </Carte>
          <Carte titre="En baisse aujourd'hui">
            {r.moinsBonnes.length ? r.moinsBonnes.map((l) => <Ligne key={l.code} gauche={l.code} droite={pct(l.variation)} couleur={C.baisse} />) : vide('Aucune ligne en baisse')}
          </Carte>
        </div>

        {/* Répartition */}
        <div style={{ display: 'flex', marginTop: 24 }}>
          <Carte titre="Répartition">
            <div style={{ display: 'flex', height: 26, borderRadius: 13, overflow: 'hidden', marginBottom: 16 }}>
              {r.secteurs.map((s, i) => <div key={s.secteur} style={{ display: 'flex', width: `${Math.max(1, s.poids * 100)}%`, background: PALETTE[i % PALETTE.length] }} />)}
            </div>
            {/* Marges explicites : le moteur d'image ignore `gap` entre lignes repliées. */}
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {r.secteurs.map((s, i) => (
                <div key={s.secteur} style={{ display: 'flex', alignItems: 'center', fontSize: 26, color: C.gris, marginRight: 32, marginBottom: 8 }}>
                  <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 9, marginRight: 10, background: PALETTE[i % PALETTE.length] }} />
                  {`${s.secteur} ${nombre(s.poids * 100, 0)} %`}
                </div>
              ))}
            </div>
          </Carte>
        </div>

        {/* Dividendes à venir */}
        <div style={{ display: 'flex', marginTop: 24 }}>
          <Carte titre="Détachements à venir">
            {r.dividendes.length
              ? r.dividendes.map((d) => (
                  <Ligne key={d.code + d.exDateFr} gauche={d.code} droite={`${d.exDateFr}${d.montant != null ? `  ·  ${fcfa(d.montant)} par titre` : ''}`} />
                ))
              : vide('Aucun détachement annoncé sur vos titres')}
          </Carte>
        </div>

        {/* Pied */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: C.gris }}>
            <span>{`${r.lignes} ligne${r.lignes > 1 ? 's' : ''} · capital investi ${fcfa(r.investi)}`}</span>
            <span>{r.alertesDuJour ? `${r.alertesDuJour} alerte${r.alertesDuJour > 1 ? 's' : ''} aujourd'hui` : ''}</span>
          </div>
          <div style={{ display: 'flex', fontSize: 21, color: C.sourd }}>
            Cours de clôture officiels de la BRVM. Information de marché, pas un conseil en investissement. westbourse.com
          </div>
        </div>
      </div>
    ),
    {
      width: LARGEUR,
      height: HAUTEUR,
      headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex' },
    },
  );
}
