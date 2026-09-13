import { fmtFcfa, fmtNumber, fmtDateFR } from '@/lib/format';
import type { PointAnnuel, Technique } from '@/lib/dossier/build';
import type { Levels } from '@/lib/hebdo/levels';

/**
 * Graphiques du dossier — SVG PUR, rendu côté serveur.
 *
 * POURQUOI PAS RECHARTS. Le reste du site l'utilise, mais il est client-only :
 * à l'impression, la boîte de dialogue peut partir avant que le composant ait
 * mesuré son conteneur, et la page sort avec des cadres vides. Un SVG rendu au
 * serveur est déjà là quand le navigateur ouvre l'aperçu.
 *
 * Règles suivies : une seule échelle par graphique (CA et RN sont tous deux en
 * FCFA — c'est un groupé, pas un double axe) ; chaque étiquette d'axe nomme une
 * valeur réellement atteinte ; toute forme porte un `fill` explicite ; les
 * étiquettes extrêmes tiennent DANS le viewBox.
 */

const ENCRE = '#12161c';
const DOUX = '#5b6672';
const TRAME = '#dfe4ea';
const HAUSSE = '#15803d';
const BAISSE = '#b91c1c';
const ACCENT = '#0e6f86';

/** Extrémités « rondes » d'une échelle, pour que les graduations disent vrai. */
function bornes(valeurs: number[]): { min: number; max: number } {
  const min = Math.min(0, ...valeurs);
  const max = Math.max(0, ...valeurs);
  if (min === 0 && max === 0) return { min: 0, max: 1 };
  const marge = (max - min) * 0.08;
  return { min: min - (min < 0 ? marge : 0), max: max + marge };
}

// ── Trajectoire annuelle : CA et résultat net ───────────────────────────────

export function BarresAnnuelles({ points }: { points: PointAnnuel[] }) {
  const utiles = points.filter((p) => p.chiffre_affaires != null || p.resultat_net != null);
  if (utiles.length === 0) {
    return <p className="dv-vide">Aucun exercice exploitable : le graphique ne peut pas être tracé.</p>;
  }

  const L = 620;
  const H = 240;
  const MG = { haut: 16, bas: 34, gauche: 74, droite: 8 };
  const largeurUtile = L - MG.gauche - MG.droite;
  const hauteurUtile = H - MG.haut - MG.bas;

  const toutes = utiles.flatMap((p) => [p.chiffre_affaires, p.resultat_net].filter((v): v is number => v != null));
  const { min, max } = bornes(toutes);
  const y = (v: number) => MG.haut + hauteurUtile * (1 - (v - min) / (max - min));
  const yZero = y(0);

  const pasX = largeurUtile / utiles.length;
  const largeurBarre = Math.min(pasX * 0.34, 30);

  /* Graduations : le plus bas et le plus haut RÉELLEMENT atteints, plus le
     zéro — pas les bornes rembourrées de l'échelle, qu'aucune barre n'atteint. */
  const graduations = Array.from(new Set([Math.min(0, ...toutes), 0, Math.max(0, ...toutes)])).sort((a, b) => a - b);

  return (
    <figure className="dv-figure">
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label="Chiffre d'affaires et résultat net par exercice">
        {graduations.map((g) => (
          <g key={g}>
            <line x1={MG.gauche} x2={L - MG.droite} y1={y(g)} y2={y(g)} stroke={g === 0 ? DOUX : TRAME} strokeWidth={g === 0 ? 1 : 1} />
            <text x={MG.gauche - 8} y={y(g) + 3.5} textAnchor="end" fontSize="10" fill={DOUX}>
              {fmtFcfa(g)}
            </text>
          </g>
        ))}

        {utiles.map((p, i) => {
          const centre = MG.gauche + pasX * (i + 0.5);
          const ca = p.chiffre_affaires;
          const rn = p.resultat_net;
          /* 2 px de blanc entre les deux barres : sans cet écart, un CA et un
             RN de signes opposés se touchent et se lisent comme un seul bloc. */
          const xCa = centre - largeurBarre - 1;
          const xRn = centre + 1;
          return (
            <g key={p.exercice}>
              {ca != null && (
                <rect
                  x={xCa} y={Math.min(y(ca), yZero)} width={largeurBarre}
                  height={Math.max(Math.abs(y(ca) - yZero), 1)} fill={ACCENT} rx="2"
                />
              )}
              {rn != null && (
                <rect
                  x={xRn} y={Math.min(y(rn), yZero)} width={largeurBarre}
                  height={Math.max(Math.abs(y(rn) - yZero), 1)} fill={rn >= 0 ? HAUSSE : BAISSE} rx="2"
                />
              )}
              <text x={centre} y={H - 12} textAnchor="middle" fontSize="10" fill={ENCRE}>
                {p.exercice}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="dv-legende">
        <span><i style={{ background: ACCENT }} /> Chiffre d&apos;affaires</span>
        <span><i style={{ background: HAUSSE }} /> Résultat net (rouge si négatif)</span>
      </figcaption>
    </figure>
  );
}

// ── Cours et niveaux du canal ───────────────────────────────────────────────

export function CourbeCours({ serie, niveaux }: { serie: Technique['serie']; niveaux: Levels | null }) {
  const pts = serie.filter((p): p is { date: string; cours: number; volume: number | null } => p.cours != null && p.cours > 0);
  if (pts.length < 2) {
    return <p className="dv-vide">Moins de deux clôtures connues : la trajectoire ne peut pas être tracée.</p>;
  }

  const L = 620;
  const H = 250;
  const MG = { haut: 14, bas: 30, gauche: 60, droite: 56 };
  const largeurUtile = L - MG.gauche - MG.droite;
  const hauteurUtile = H - MG.haut - MG.bas;

  const cours = pts.map((p) => p.cours);
  const repères = [niveaux?.support, niveaux?.resistance].filter((v): v is number => v != null);
  const min = Math.min(...cours, ...repères);
  const max = Math.max(...cours, ...repères);
  const etendue = max - min || 1;
  const y = (v: number) => MG.haut + hauteurUtile * (1 - (v - min) / etendue);
  const x = (i: number) => MG.gauche + (largeurUtile * i) / (pts.length - 1);

  const chemin = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.cours).toFixed(1)}`).join(' ');
  const aire = `${chemin} L${x(pts.length - 1).toFixed(1)},${MG.haut + hauteurUtile} L${MG.gauche},${MG.haut + hauteurUtile} Z`;

  const dernier = pts[pts.length - 1]!;
  const premier = pts[0]!;
  const hausse = dernier.cours >= premier.cours;
  const teinte = hausse ? HAUSSE : BAISSE;

  return (
    <figure className="dv-figure">
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={`Cours de clôture sur ${pts.length} séances`}>
        {[min, max].map((g) => (
          <g key={g}>
            <line x1={MG.gauche} x2={L - MG.droite} y1={y(g)} y2={y(g)} stroke={TRAME} strokeWidth="1" />
            <text x={MG.gauche - 8} y={y(g) + 3.5} textAnchor="end" fontSize="10" fill={DOUX}>
              {fmtNumber(g)}
            </text>
          </g>
        ))}

        {/* Support et résistance : tiretés, étiquetés à DROITE dans la marge
            réservée — une étiquette hors viewBox est simplement invisible. */}
        {niveaux && (
          <>
            {([['Résistance', niveaux.resistance], ['Support', niveaux.support]] as const).map(([nom, v]) => (
              <g key={nom}>
                <line x1={MG.gauche} x2={L - MG.droite} y1={y(v)} y2={y(v)} stroke={DOUX} strokeWidth="1" strokeDasharray="4 3" />
                <text x={L - MG.droite + 4} y={y(v) + 3.5} fontSize="9" fill={DOUX}>
                  {nom}
                </text>
              </g>
            ))}
          </>
        )}

        <path d={aire} fill={teinte} fillOpacity="0.08" />
        <path d={chemin} fill="none" stroke={teinte} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(pts.length - 1)} cy={y(dernier.cours)} r="3.5" fill={teinte} stroke="#ffffff" strokeWidth="1.5" />

        <text x={MG.gauche} y={H - 10} fontSize="10" fill={DOUX}>{fmtDateFR(premier.date)}</text>
        <text x={L - MG.droite} y={H - 10} textAnchor="end" fontSize="10" fill={ENCRE}>{fmtDateFR(dernier.date)}</text>
      </svg>
    </figure>
  );
}

// ── Décomposition d'un détachement ──────────────────────────────────────────

/**
 * Une baisse du jour de détachement, séparée en la part que le dividende
 * explique et celle qu'il n'explique pas. C'est la lecture qui manquait à la
 * note d'origine : « ajustement post-dividende » y couvrait une chute dont le
 * dividende ne représentait que 40 %.
 */
export function BarreDetachement({ baisse, dividende }: { baisse: number; dividende: number }) {
  const expliquee = Math.min(dividende, baisse);
  const reste = Math.max(baisse - dividende, 0);
  const total = expliquee + reste || 1;
  const pctExp = (expliquee / total) * 100;

  return (
    <figure className="dv-figure">
      <svg viewBox="0 0 620 74" role="img" aria-label="Part de la baisse expliquée par le détachement">
        <rect x="0" y="10" width="620" height="26" fill="#eef1f4" rx="4" />
        <rect x="0" y="10" width={(620 * pctExp) / 100} height="26" fill={ACCENT} rx="4" />
        {reste > 0 && (
          /* 2 px de blanc : les deux parts ne doivent pas se lire comme une. */
          <rect x={(620 * pctExp) / 100 + 2} y="10" width={Math.max(620 - (620 * pctExp) / 100 - 2, 0)} height="26" fill={BAISSE} rx="4" />
        )}
        <text x="0" y="56" fontSize="11" fill={ACCENT}>
          Dividende détaché : {fmtNumber(expliquee, 2)} FCFA
        </text>
        <text x="620" y="56" textAnchor="end" fontSize="11" fill={reste > 0 ? BAISSE : DOUX}>
          {reste > 0 ? `Baisse inexpliquée : ${fmtNumber(reste, 2)} FCFA` : 'Baisse intégralement expliquée'}
        </text>
      </svg>
    </figure>
  );
}
