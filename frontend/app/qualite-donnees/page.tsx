import type { Metadata } from 'next';
import Link from 'next/link';
import PublicShell from '@/components/public/PublicShell';
import { createPublicClient } from '@/lib/supabase/public';
import { controleBoc } from '@/lib/boc/charger';
import { resumer, concordance, SEUIL_ECART, type ControleValeur, type Concordance } from '@/lib/boc/ecarts';
import { fmtNumber } from '@/lib/format';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Qualité des données · contrôle quotidien contre le Bulletin officiel BRVM',
  description:
    'Chaque séance, WESTBOURSE compare ses PER et rendements au Bulletin Officiel de la Cote de la BRVM : taux de concordance, écarts ouverts et valeurs suspendues, publiés tels quels.',
  alternates: { canonical: '/qualite-donnees' },
};

/**
 * Transparence : le résultat BRUT du contrôle quotidien contre le Bulletin
 * officiel, écarts compris. Montrer ce qui ne concorde pas est le but : une
 * page qui n'afficherait que les bons chiffres ne prouverait rien.
 * Pas de loading.tsx (règle anti-soft-404).
 */
export default async function Page() {
  let controles: ControleValeur[] | null = null;
  try {
    controles = await controleBoc(createPublicClient());
  } catch {
    controles = null;
  }

  return (
    <PublicShell>
      <header className="mb-8 border-b border-border pb-4">
        <h1 className="font-display text-3xl text-ivory md:text-4xl">Qualité des données</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Nos ratios sont calculés à partir des états financiers publiés par les sociétés. Chaque séance, nous les
          recoupons avec le <span className="text-ivory">Bulletin Officiel de la Cote</span> publié par la BRVM, au même
          cours, et nous publions le résultat tel quel, écarts compris.
        </p>
      </header>

      {controles === null ? (
        <p className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">
          Le contrôle n&apos;a pas pu être lu pour le moment. Nous ne publions pas de résultat que nous ne pouvons pas vérifier.
        </p>
      ) : controles.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">Le premier contrôle n&apos;a pas encore été publié.</p>
      ) : (
        <Resultats controles={controles} />
      )}

      <section className="mt-8 space-y-2 text-sm text-muted">
        <h2 className="font-display text-lg text-ivory">Méthode</h2>
        <p>
          Le PER et le rendement du dividende du site sont recalculés au <span className="text-ivory">cours de référence du
          bulletin</span> : un écart ne peut donc venir que du bénéfice ou du dividende retenu, pas d&apos;un décalage de
          cours. Au-delà de {fmtNumber(SEUIL_ECART * 100, 0)} % d&apos;écart relatif, la valeur est listée ci-dessous.
        </p>
        <p>
          Un écart n&apos;est pas forcément une erreur de notre part : le bulletin peut retenir un autre exercice ou un
          résultat consolidé différent (part du groupe). Nous le vérifions sur les états financiers avant toute
          correction, et nous ne corrigeons jamais un chiffre sans source.
        </p>
        <p>
          Voir aussi la <Link href="/methodologie" className="text-accent-ink hover:underline">méthodologie</Link> et les{' '}
          <Link href="/operations-titres" className="text-accent-ink hover:underline">opérations sur titres</Link>.
        </p>
      </section>
    </PublicShell>
  );
}

function Taux({ titre, c }: { titre: string; c: Concordance }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{titre}</p>
      <p className="tabular mt-1 text-3xl text-ivory">{c.taux != null ? `${fmtNumber(c.taux * 100, 0)} %` : '—'}</p>
      <p className="tabular text-xs text-faint">
        {c.concordantes} concordants sur {c.comparees} comparables
      </p>
    </div>
  );
}

function Resultats({ controles }: { controles: ControleValeur[] }) {
  const r = resumer(controles);
  const per = concordance(controles, 'per');
  const rdt = concordance(controles, 'rendement');
  const ouverts = controles.filter((c) => c.per.etat === 'ecart' || c.rendement.etat === 'ecart');
  const v = (x: number | null, u: string) => (x == null ? '—' : `${fmtNumber(x, 2)}${u}`);
  const date = r.dateSeance ? r.dateSeance.split('-').reverse().join('/') : '—';

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Bulletin de la séance du <span className="tabular text-ivory">{date}</span>, {r.valeurs} valeurs.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Taux titre="PER concordants" c={per} />
        <Taux titre="Rendements concordants" c={rdt} />
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">Cotations suspendues</p>
          <p className="tabular mt-1 text-3xl text-ivory">{r.suspendues.length}</p>
          <p className="text-xs text-faint">{r.suspendues.length ? r.suspendues.join(', ') : 'aucune'}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-2 font-display text-lg text-ivory">Écarts ouverts ({ouverts.length})</h2>
        {ouverts.length === 0 ? (
          <p className="text-sm text-muted">Aucun écart au-delà du seuil sur cette séance.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="px-3 py-2 font-normal">Valeur</th>
                  <th className="px-3 py-2 text-right font-normal">PER WESTBOURSE</th>
                  <th className="px-3 py-2 text-right font-normal">PER BOC</th>
                  <th className="px-3 py-2 text-right font-normal">Rendement WESTBOURSE</th>
                  <th className="px-3 py-2 text-right font-normal">Rendement BOC</th>
                </tr>
              </thead>
              <tbody>
                {ouverts.map((c) => (
                  <tr key={c.code} className="border-t border-border/60">
                    <td className="px-3 py-2"><Link href={`/societes/${c.code}`} className="tabular text-ivory hover:underline">{c.code}</Link></td>
                    <td className={`tabular px-3 py-2 text-right ${c.per.etat === 'ecart' ? 'text-warn' : 'text-ivory'}`}>{v(c.per.site, '×')}</td>
                    <td className="tabular px-3 py-2 text-right text-ivory">{v(c.per.boc, '×')}</td>
                    <td className={`tabular px-3 py-2 text-right ${c.rendement.etat === 'ecart' ? 'text-warn' : 'text-ivory'}`}>{v(c.rendement.site, ' %')}</td>
                    <td className="tabular px-3 py-2 text-right text-ivory">{v(c.rendement.boc, ' %')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {r.perManquants.length > 0 && (
          <p className="mt-2 text-xs text-faint">
            PER publié par la BRVM mais pas encore calculé chez nous (comptes non disponibles) : {r.perManquants.join(', ')}.
            La fiche société affiche alors le PER du bulletin, sourcé comme tel.
          </p>
        )}
      </section>
    </div>
  );
}
