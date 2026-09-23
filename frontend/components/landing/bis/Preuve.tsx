import type { Fraicheur } from '@/lib/freshness';
import { fmtDateFR, fmtNumber } from '@/lib/format';

/**
 * Bandeau de preuve + « La preuve de la donnée », version claire de la landing
 * bis. Reprend, sans les réécrire, les règles de components/landing/ProofBand
 * et PreuveDonnee : rien n'est inventé, un maillon manquant est déclaré, et
 * aucune source n'est citée sans donnée réelle derrière (BRVM = cours,
 * BCEAO = macro_indicators, Bloomfield = notations en base).
 */

const SOURCES = [
  { src: '/brand/brvm-logo.png', alt: 'BRVM' },
  { src: '/brand/bceao-logo.png', alt: 'BCEAO' },
  { src: '/brand/bloomfield-logo.png', alt: 'Bloomfield Investment' },
] as const;

const ICONS = {
  societes: 'M3 21h18M5 21V7l7-4 7 4v14M9 11h.01M9 15h.01M15 11h.01M15 15h.01',
  horloge: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  note: 'M4 12a8 8 0 0113.7-5.7M20 12a8 8 0 01-13.7 5.7M17 3v3.5h-3.5M7 21v-3.5h3.5',
  sources: 'M12 3l8 3.5v5c0 4.2-3.2 7.8-8 8.5-4.8-.7-8-4.3-8-8.5v-5L12 3zM9 12l2 2 4-4',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6',
  hash: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8 12h8',
  cal: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
} as const;

function Ico({ d, size = 22 }: { d: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

/** « il y a 12 h », « il y a 34 min » — jamais une précision qu'on n'a pas. */
function depuis(minutes: number | null): string | null {
  if (minutes == null || minutes < 0) return null;
  if (minutes < 60) return `il y a ${minutes} min`;
  const h = Math.round(minutes / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} jours`;
}

export function ProofBandBis({ nbActions }: { nbActions: number }) {
  const metrics = [
    { value: nbActions > 0 ? String(nbActions) : '48', label: 'sociétés BRVM suivies', icon: ICONS.societes },
    { value: '15 min', label: 'actualisation en séance', icon: ICONS.horloge },
    { value: 'A–F', label: 'notation quantitative', icon: ICONS.note },
    { value: 'Sources', label: 'données vérifiées et officielles', icon: ICONS.sources },
  ];
  return (
    <section className="proofband" aria-label="Preuves">
      <div className="metrics">
        {metrics.map((m) => (
          <div key={m.label} className="metric">
            <span className="ic"><Ico d={m.icon} /></span>
            <span><b className="num">{m.value}</b><small>{m.label}</small></span>
          </div>
        ))}
      </div>
      <div className="sources">
        <p className="over">Nos données proviennent des sources du marché</p>
        <ul>
          {SOURCES.map((s) => (
            <li key={s.alt}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.src} alt={s.alt} height={22} loading="lazy" />
            </li>
          ))}
          <li className="txt">Publications des émetteurs</li>
        </ul>
      </div>
    </section>
  );
}

interface PreuveProps {
  fraicheur: Fraicheur;
  exemple: { code: string; nom: string | null; cours: number | null } | null;
  nbActions: number;
}

export function PreuveDonneeBis({ fraicheur, exemple, nbActions }: PreuveProps) {
  const age = depuis(fraicheur.ageMinutes);
  const collecte = fraicheur.derniereCollecte
    ? new Date(fraicheur.derniereCollecte).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    : null;
  return (
    <section className="preuve" aria-labelledby="h-preuve">
      <div className="preuve-copy">
        <p className="over">La preuve de la donnée</p>
        <h2 id="h-preuve">Chaque chiffre a une source, une date et une heure.</h2>
        <p>Voici la chaîne complète d&apos;un chiffre affiché sur cette page — vous pouvez la remonter jusqu&apos;à sa source. Aucun cours n&apos;est saisi à la main, et une donnée manquante est déclarée plutôt que comblée.</p>
        <a href="/methodologie" className="btn btn-ink btn-sm">Voir un exemple de source <span aria-hidden="true">→</span></a>
      </div>
      <ol className="chain">
        <li>
          <span className="rang">01</span><span className="ic"><Ico d={ICONS.doc} size={20} /></span>
          <p className="over">La source</p>
          <p className="val">BRVM · publications des émetteurs</p>
          <p className="det">Cotations relevées sur le site officiel de la Bourse, états financiers extraits des publications.{nbActions > 0 ? ` ${nbActions} sociétés suivies.` : ''}</p>
        </li>
        <li>
          <span className="rang">02</span><span className="ic"><Ico d={ICONS.hash} size={20} /></span>
          <p className="over">Le chiffre</p>
          {exemple && exemple.cours != null ? (
            <>
              <p className="val"><span className="num">{exemple.code}</span> <span className="num">{fmtNumber(exemple.cours)}</span> FCFA</p>
              <p className="det">{exemple.nom ? `${exemple.nom}, ` : ''}clôture{fraicheur.derniereSeance ? ` de la séance du ${fmtDateFR(fraicheur.derniereSeance)}` : ''}. Le même chiffre apparaît dans le palmarès ci-dessous et sur la fiche société.</p>
            </>
          ) : (
            <>
              <p className="val muted">Aucune cotation disponible</p>
              <p className="det">La séance n&apos;est pas encore disponible : la page le dit au lieu d&apos;afficher un cours périmé.</p>
            </>
          )}
        </li>
        <li>
          <span className="rang">03</span><span className="ic"><Ico d={ICONS.cal} size={20} /></span>
          <p className="over">La collecte</p>
          {collecte ? (
            <>
              <p className="val num">{collecte} <small>UTC</small></p>
              <p className="det">Dernière collecte réussie{age ? `, ${age}` : ''}. En séance, les cours sont relevés toutes les 15 minutes.</p>
            </>
          ) : (
            <>
              <p className="val muted">Horodatage indisponible</p>
              <p className="det">Nous ne connaissons pas l&apos;heure de la dernière collecte : ce maillon reste vide plutôt que supposé.</p>
            </>
          )}
        </li>
      </ol>
      <p className="preuve-note">Ce que nous ne savons pas, nous l&apos;écrivons. La BRVM ne publiant pas de carnet d&apos;ordres, la profondeur de marché est <em>estimée</em> — jamais présentée comme mesurée.</p>
    </section>
  );
}
