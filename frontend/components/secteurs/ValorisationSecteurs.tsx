import Link from 'next/link';
import type { ReactNode } from 'react';
import { PremiumPanel } from '@/components/ui/premium';
import { getDonneesSecteurs } from '@/lib/secteurs/server';
import { fmtDateCourte } from '@/lib/format';

/**
 * Valorisation sectorielle — PER, PBR et rendement du dividende par secteur.
 *
 * Complète la performance (variation, classement, rotation) déjà présente sur
 * /secteurs : la performance dit comment le secteur a bougé, la valorisation dit
 * à quel prix il se paie. Composant serveur autonome : il charge ses propres
 * données, mises en cache 15 minutes, sans alourdir le chargement de la page.
 */

const n1 = (v: number | null, suffixe = '') =>
  v == null ? '—' : `${v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${suffixe}`;

/** Position face à la médiane du marché, en toutes lettres — jamais une couleur seule. */
function situe(valeur: number | null, marche: number | null): string {
  if (valeur == null || marche == null || marche <= 0) return '';
  const ecart = (valeur / marche - 1) * 100;
  if (Math.abs(ecart) < 10) return 'proche du marché';
  return `${Math.abs(Math.round(ecart))} % ${ecart > 0 ? 'au-dessus' : 'au-dessous'} du marché`;
}

const LIEN = 'rounded-sm font-medium text-accent-ink underline underline-offset-2 transition-colors hover:decoration-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** `entete` remplace le titre interne (chapitre numéroté de la page /secteurs). */
export default async function ValorisationSecteurs({ entete }: { entete?: ReactNode } = {}) {
  const d = await getDonneesSecteurs();
  if (d.secteurs.length === 0) return null;

  const exploitables = d.societes.length - d.sansDonnees.length;

  return (
    <section aria-labelledby={entete ? 'valorisation-titre' : undefined} className="space-y-4">
      {entete}
      <div className="flex flex-wrap items-end justify-between gap-3">
        {!entete && (
          <div>
            <h2 className="mt-1 font-display text-heading-sm text-ivory [text-wrap:balance]">À quel prix se paie chaque secteur</h2>
          </div>
        )}
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
          <div className="flex gap-1.5"><dt>PER médian du marché</dt><dd className="tabular text-ivory">{n1(d.marche.per)}</dd></div>
          <div className="flex gap-1.5"><dt>PBR médian du marché</dt><dd className="tabular text-ivory">{n1(d.marche.pbr)}</dd></div>
          <div className="flex gap-1.5"><dt>Rendement médian du marché</dt><dd className="tabular text-ivory">{n1(d.marche.rendement, ' %')}</dd></div>
        </dl>
      </div>

      <PremiumPanel className="p-0">
        <div
          tabIndex={0}
          role="region"
          aria-label="Valorisation des secteurs, défilement horizontal"
          className="relative overflow-x-auto rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
        <table className="w-full text-sm">
          <caption className="sr-only">
            Médianes du PER, du PBR et du rendement du dividende par secteur, avec le nombre de sociétés retenues.
          </caption>
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th scope="col" className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-medium">Secteur</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">Retenues pour le PER</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">PER médian</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">PBR médian</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">Rendement médian</th>
              <th scope="col" className="whitespace-nowrap px-4 py-3 text-left font-medium">PER le plus bas, le plus haut</th>
            </tr>
          </thead>
          <tbody>
            {d.secteurs.map((s) => (
              <tr key={s.secteur} className="group border-b border-border/60 transition-colors last:border-0 hover:bg-sunken">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-medium text-ivory transition-colors group-hover:bg-sunken">{s.secteur}</th>
                <td className="px-4 py-3 text-right tabular text-muted">
                  {s.perRetenus} / {s.societes}
                  {s.perEcartes > 0 && <span className="block text-xs text-faint">{s.perEcartes} sans PER exploitable</span>}
                </td>
                <td className="px-4 py-3 text-right tabular text-ivory">
                  {n1(s.perMedian)}
                  <span className="block text-xs text-faint">{situe(s.perMedian, d.marche.per)}</span>
                </td>
                <td className="px-4 py-3 text-right tabular text-ivory">{n1(s.pbrMedian)}</td>
                <td className="px-4 py-3 text-right tabular text-ivory">
                  {n1(s.rendementMedian, ' %')}
                  {s.rendementRetenus > 0 && s.rendementRetenus < s.societes && (
                    <span className="block text-xs text-faint">sur {s.rendementRetenus} société{s.rendementRetenus > 1 ? 's' : ''}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                  {s.moinsChere && s.plusChere ? (
                    <>
                      <Link href={`/societes/${s.moinsChere.code}`} className={LIEN}>{s.moinsChere.code}</Link>
                      <span className="tabular text-ivory"> {n1(s.moinsChere.per)}</span>
                      <span className="text-faint">, </span>
                      <Link href={`/societes/${s.plusChere.code}`} className={LIEN}>{s.plusChere.code}</Link>
                      <span className="tabular text-ivory"> {n1(s.plusChere.per)}</span>
                    </>
                  ) : <span className="text-faint">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </PremiumPanel>

      <PremiumPanel className="space-y-2 p-4 text-xs leading-relaxed text-muted">
        <p>
          <strong className="font-medium text-ivory">PER</strong> : cours divisé par le bénéfice par action.{' '}
          <strong className="font-medium text-ivory">PBR</strong> : cours divisé par les capitaux propres par action.{' '}
          <strong className="font-medium text-ivory">Rendement</strong> : dividende par action divisé par le cours.
        </p>
        <p>
          Chaque ratio est calculé société par société (dernier exercice publié, cours
          {d.dateMarche ? ` de la séance du ${fmtDateCourte(d.dateMarche)}` : ''}) puis résumé par la{' '}
          <strong className="text-ivory">médiane</strong> du secteur, et non par la moyenne qu&apos;une seule valeur
          extrême suffirait à déformer. Un PER négatif (société en perte) ou invraisemblable est{' '}
          <strong className="text-ivory">écarté et compté</strong>, jamais corrigé : c&apos;est ce que dit la colonne
          « Retenues pour le PER ».
        </p>
        <p>
          {exploitables} société{exploitables > 1 ? 's' : ''} sur {d.societes.length} disposent d&apos;au moins un ratio
          exploitable.
          {d.sansDonnees.length > 0 && <> Sans aucune donnée à ce jour : <span className="tabular">{d.sansDonnees.join(', ')}</span>.</>}
          {' '}Le dividende retenu est celui d&apos;un détachement daté, seule valeur confirmée par un versement réel.
        </p>
        <p className="text-faint">
          Ces chiffres décrivent une valorisation à un instant donné. Ils ne constituent pas un conseil en investissement.
        </p>
      </PremiumPanel>
    </section>
  );
}
