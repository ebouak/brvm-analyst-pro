import { fmtNumber, fmtDateFR } from '@/lib/format';
import type { Fraicheur } from '@/lib/freshness';

/**
 * « La preuve de la donnée » — la chaîne source → chiffre → horodatage.
 *
 * POURQUOI CETTE SECTION EXISTE. WESTBOURSE ne saisit aucun chiffre à la
 * main : tout vient d'une collecte datée, et un trou est déclaré plutôt que
 * comblé. C'est le vrai écart face aux sites de rumeurs — et il était
 * jusqu'ici INVISIBLE pour le visiteur. La page l'affirmait (« sources
 * officielles ») sans jamais le MONTRER.
 *
 * Ici on prend UN chiffre réellement affiché ailleurs sur la page et on
 * remonte sa chaîne : d'où il vient, ce qu'il vaut, quand il a été collecté.
 * Un visiteur peut vérifier chaque maillon.
 *
 * RIEN N'EST INVENTÉ : l'horodatage vient de `v_fraicheur_cours`
 * (`scraper_sources.last_success_at` de la source intraday, exposé par la
 * migration 0122), le cours de `brvm_actions_daily`. Si l'un manque, le
 * maillon le dit au lieu d'afficher une valeur de confort.
 */

interface Props {
  fraicheur: Fraicheur;
  /** Le chiffre témoin : une valeur réellement cotée à la dernière séance. */
  exemple: { code: string; nom: string | null; cours: number | null } | null;
  nbActions: number;
}

/** « il y a 12 h », « il y a 34 min » — jamais une précision qu'on n'a pas. */
function depuis(minutes: number | null): string | null {
  if (minutes == null || minutes < 0) return null;
  if (minutes < 60) return `il y a ${minutes} min`;
  const h = Math.round(minutes / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} jours`;
}

function Maillon({
  rang,
  titre,
  valeur,
  detail,
}: {
  rang: string;
  titre: string;
  valeur: React.ReactNode;
  detail: string;
}) {
  return (
    <li className="relative flex-1 rounded-panel border border-border bg-surface/60 p-5">
      <span className="tabular font-mono text-[10px] font-bold text-accent">{rang}</span>
      <p className="overline mt-1 text-faint">{titre}</p>
      <p className="mt-2 font-display text-xl leading-tight text-ivory">{valeur}</p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{detail}</p>
    </li>
  );
}

export function PreuveDonnee({ fraicheur, exemple, nbActions }: Props) {
  const age = depuis(fraicheur.ageMinutes);
  const collecteLisible = fraicheur.derniereCollecte
    ? new Date(fraicheur.derniereCollecte).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <section aria-labelledby="preuve-titre" className="mt-14 md:mt-24">
      <div className="mb-8 max-w-[54ch]">
        <p className="overline mb-3 text-gold-2">La preuve de la donnée</p>
        <h2 id="preuve-titre" className="font-display text-2xl text-ivory md:text-4xl [letter-spacing:-0.035em]">
          Chaque chiffre a une source, une date et une heure.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Voici la chaîne complète d&apos;un chiffre affiché sur cette page — vous pouvez la remonter
          jusqu&apos;à sa source. Aucun cours n&apos;est saisi à la main, et une donnée manquante est
          déclarée plutôt que comblée.
        </p>
      </div>

      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Maillon
          rang="01"
          titre="La source"
          valeur="BRVM · publications des émetteurs"
          detail={`Cotations relevées sur le site officiel de la Bourse, états financiers extraits des publications. ${nbActions > 0 ? `${nbActions} sociétés suivies.` : ''}`}
        />
        <Maillon
          rang="02"
          titre="Le chiffre"
          valeur={
            exemple && exemple.cours != null ? (
              <>
                <span className="font-mono">{exemple.code}</span>{' '}
                <span className="tabular">{fmtNumber(exemple.cours)}</span>{' '}
                <span className="text-base text-muted">FCFA</span>
              </>
            ) : (
              <span className="text-muted">Aucune cotation disponible</span>
            )
          }
          detail={
            exemple && exemple.cours != null
              ? `Clôture de ${exemple.nom ?? exemple.code}${
                  fraicheur.derniereSeance ? ` — séance du ${fmtDateFR(fraicheur.derniereSeance)}` : ''
                }. Le même chiffre apparaît dans le terminal, la cartographie et la fiche société.`
              : 'La séance n’est pas encore disponible : la page le dit au lieu d’afficher un cours périmé.'
          }
        />
        <Maillon
          rang="03"
          titre="La collecte"
          valeur={collecteLisible ?? <span className="text-muted">Horodatage indisponible</span>}
          detail={
            collecteLisible
              ? `Dernière collecte réussie${age ? `, ${age}` : ''}. En séance, les cours sont relevés toutes les 15 minutes.`
              : 'Nous ne connaissons pas l’heure de la dernière collecte : ce maillon reste vide plutôt que supposé.'
          }
        />
      </ol>

      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        Ce que nous ne savons pas, nous l&apos;écrivons. La BRVM ne publiant pas de carnet d&apos;ordres,
        la profondeur de marché est <em>estimée</em> — jamais présentée comme mesurée.
      </p>
    </section>
  );
}
