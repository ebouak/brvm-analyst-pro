import Link from 'next/link';
import { PremiumPanel, Eyebrow } from '@/components/ui/premium';
import { getDonneesSecteurs } from '@/lib/secteurs/server';
import { fmtDateFR } from '@/lib/format';

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
  return `${ecart > 0 ? '+' : ''}${Math.round(ecart)} % vs marché`;
}

export default async function ValorisationSecteurs() {
  const d = await getDonneesSecteurs();
  if (d.secteurs.length === 0) return null;

  const exploitables = d.societes.length - d.sansDonnees.length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Valorisation</Eyebrow>
          <h2 className="mt-1 font-display text-heading-sm text-ivory">À quel prix se paie chaque secteur</h2>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
          <div><dt className="inline">PER médian du marché </dt><dd className="tabular inline text-ivory">{n1(d.marche.per)}</dd></div>
          <div><dt className="inline">PBR </dt><dd className="tabular inline text-ivory">{n1(d.marche.pbr)}</dd></div>
          <div><dt className="inline">Rendement </dt><dd className="tabular inline text-ivory">{n1(d.marche.rendement, ' %')}</dd></div>
        </dl>
      </div>

      <PremiumPanel className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Médianes du PER, du PBR et du rendement du dividende par secteur, avec le nombre de sociétés retenues.
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-medium">Secteur</th>
              <th scope="col" className="px-4 py-3 font-medium">Retenues</th>
              <th scope="col" className="px-4 py-3 font-medium">PER médian</th>
              <th scope="col" className="px-4 py-3 font-medium">PBR médian</th>
              <th scope="col" className="px-4 py-3 font-medium">Rendement</th>
              <th scope="col" className="px-4 py-3 font-medium">Extrêmes (PER)</th>
            </tr>
          </thead>
          <tbody>
            {d.secteurs.map((s) => (
              <tr key={s.secteur} className="border-b border-border/60 last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-medium text-ivory">{s.secteur}</th>
                <td className="px-4 py-3 tabular text-muted">
                  {s.perRetenus} / {s.societes}
                  {s.perEcartes > 0 && <span className="block text-xs text-faint">{s.perEcartes} sans PER exploitable</span>}
                </td>
                <td className="px-4 py-3 tabular text-ivory">
                  {n1(s.perMedian)}
                  <span className="block text-xs text-faint">{situe(s.perMedian, d.marche.per)}</span>
                </td>
                <td className="px-4 py-3 tabular text-ivory">{n1(s.pbrMedian)}</td>
                <td className="px-4 py-3 tabular text-ivory">
                  {n1(s.rendementMedian, ' %')}
                  {s.rendementRetenus > 0 && s.rendementRetenus < s.societes && (
                    <span className="block text-xs text-faint">sur {s.rendementRetenus} société{s.rendementRetenus > 1 ? 's' : ''}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {s.moinsChere && s.plusChere ? (
                    <>
                      <Link href={`/societes/${s.moinsChere.code}`} className="text-accent-ink hover:underline">{s.moinsChere.code}</Link>
                      <span className="tabular"> {n1(s.moinsChere.per)}</span>
                      <span className="text-faint"> → </span>
                      <Link href={`/societes/${s.plusChere.code}`} className="text-accent-ink hover:underline">{s.plusChere.code}</Link>
                      <span className="tabular"> {n1(s.plusChere.per)}</span>
                    </>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PremiumPanel>

      <PremiumPanel className="space-y-2 p-4 text-xs text-muted">
        <p>
          Chaque ratio est calculé société par société — dernier exercice publié, cours
          {d.dateMarche ? ` de la séance du ${fmtDateFR(d.dateMarche)}` : ''} — puis résumé par la{' '}
          <strong className="text-ivory">médiane</strong> du secteur, et non par la moyenne qu&apos;une seule valeur
          extrême suffirait à déformer. Un PER négatif (société en perte) ou invraisemblable est{' '}
          <strong className="text-ivory">écarté et compté</strong>, jamais corrigé : c&apos;est ce que dit la colonne
          « retenues ».
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
