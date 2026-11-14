import { dateSeanceLongue } from '@/components/CarnetOrdres';
import { agDeLaSociete, heureCourte, titreAg, type BocAssemblee } from '@/lib/boc/assemblees';
import { derniersAvis, libelleCategorie, operationsEnCours, type BocAvis, type BocOperation } from '@/lib/boc/informations';

/**
 * Assemblées générales et informations d'une société, lues dans le Bulletin
 * Officiel de la Cote (collecteur `scraper/src/boc/`).
 *
 * Tout est repris tel que la BRVM le publie : date, heure, nature et lieu de
 * l'AG, texte des opérations et objet des avis. Rien n'est résumé ni
 * interprété. Une AG à venir n'est affichée que si le dernier bulletin lu la
 * liste encore (sinon elle a été retirée ou reportée), et une opération n'est
 * « en cours » que dans le même cas.
 *
 * Le bloc disparaît s'il n'a rien à montrer.
 */

const dateCourte = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export default function BulletinSociete({
  assemblees, operations, avis, dernierBulletin, aujourdhui,
}: {
  assemblees: BocAssemblee[];
  operations: BocOperation[];
  avis: BocAvis[];
  dernierBulletin: string | null;
  aujourdhui: string;
}) {
  const { aVenir, passees } = agDeLaSociete(assemblees, aujourdhui, dernierBulletin);
  const enCours = operationsEnCours(operations, dernierBulletin);
  const recents = derniersAvis(avis, 5);
  if (aVenir.length === 0 && passees.length === 0 && enCours.length === 0 && recents.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-border bg-surface p-5">
      <header className="mb-4">
        <h2 className="font-display text-lg text-ivory">Assemblées générales et avis</h2>
        <p className="mt-1 text-xs text-faint">Tels que publiés par la BRVM dans son Bulletin Officiel de la Cote</p>
      </header>

      {aVenir.length > 0 && (
        <ul className="mb-4 space-y-3">
          {aVenir.map((a) => {
            const h = heureCourte(a.heure);
            return (
              <li key={`${a.date_ag}-${a.nature_cle}`} className="rounded-lg border border-border p-4">
                <p className="text-xs text-faint">{titreAg(a)}</p>
                <p className="mt-1 text-base text-ivory">
                  {dateSeanceLongue(a.date_ag)}{h ? `, ${h}` : ''}
                </p>
                {a.lieu && <p className="mt-1 text-sm text-muted">{a.lieu}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {passees.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs text-faint">{aVenir.length > 0 ? 'Précédentes assemblées' : 'Dernières assemblées'}</h3>
          <ul className="mt-2 divide-y divide-border text-sm">
            {passees.slice(0, 4).map((a) => (
              <li key={`${a.date_ag}-${a.nature_cle}`} className="flex justify-between gap-4 py-2">
                <span className="text-muted">{titreAg(a)}</span>
                <span className="tabular shrink-0 text-faint">{dateCourte(a.date_ag)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {enCours.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs text-faint">Opérations en cours</h3>
          <ul className="mt-2 space-y-2 text-sm text-muted">
            {enCours.map((o) => <li key={o.operation}>{o.operation}</li>)}
          </ul>
        </div>
      )}

      {recents.length > 0 && (
        <div>
          <h3 className="text-xs text-faint">Avis et communiqués</h3>
          <ul className="mt-2 divide-y divide-border text-sm">
            {recents.map((a) => (
              <li key={`${a.categorie}-${a.numero ?? a.objet}`} className="py-2">
                <p className="text-muted">{a.objet}</p>
                <p className="mt-0.5 text-xs text-faint">
                  {libelleCategorie(a.categorie)}{a.numero ? ` n° ${a.numero}` : ''} · {dateCourte(a.date_bulletin)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dernierBulletin && (
        <p className="mt-4 text-xs text-faint">Dernier bulletin lu : {dateSeanceLongue(dernierBulletin)}.</p>
      )}
    </section>
  );
}
