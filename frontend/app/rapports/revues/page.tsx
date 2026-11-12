import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ViewTabs from '@/components/ViewTabs';
import { REPORT_TABS } from '@/lib/reportTabs';
import { fmtDateCourte } from '@/lib/format';
import { periodeDuTitre } from '@/lib/evenements/regroupement';
import { libellePeriode } from '@/lib/evenements/periode';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revues de résultats' };

interface Pub { code: string; date_publication: string; libelle: string | null }

/**
 * Bibliothèque des Revues de résultats, triée par date de la dernière publication
 * de comptes ou de rapport d'activité de chaque société (table `publications`).
 */
export default async function RevuesPage() {
  const sb = createClient();
  const depuis = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: instr }, { data: pubs }] = await Promise.all([
    sb.from('brvm_instruments').select('code, designation').eq('type', 'action'),
    sb.from('publications').select('code, date_publication, libelle')
      .in('type_publication', ['etats_financiers', 'rapport'])
      .gte('date_publication', depuis)
      .order('date_publication', { ascending: false })
      .limit(1000),
  ]);
  const noms = new Map(((instr ?? []) as { code: string; designation: string | null }[]).map((i) => [i.code, i.designation]));
  const derniere = new Map<string, Pub>();
  for (const p of (pubs ?? []) as Pub[]) if (noms.has(p.code) && !derniere.has(p.code)) derniere.set(p.code, p);
  const lignes = [...derniere.values()];
  const sansPublication = [...noms.keys()].filter((c) => !derniere.has(c)).sort();

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-6">
      <div>
        <h1 className="font-display text-2xl text-ivory">Revues de résultats</h1>
        <p className="mt-1 text-sm text-muted">Que disent les derniers comptes ? Les sociétés par date de leur dernière publication.</p>
      </div>
      <ViewTabs tabs={REPORT_TABS} current="/rapports/revues" />

      {lignes.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-8 text-center text-sm text-muted">Aucune publication de résultats sur les treize derniers mois.</p>
      ) : (
        <div className="relative overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Publiée le</th>
                <th className="px-3 py-2 text-left font-medium">Société</th>
                <th className="px-3 py-2 text-left font-medium">Période couverte</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((p) => (
                <tr key={p.code} className="border-b border-border/40">
                  <td className="tabular whitespace-nowrap px-3 py-2 text-muted">{fmtDateCourte(p.date_publication)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/actions/${p.code}/revue`} className="font-semibold text-ivory hover:text-accent-ink">{noms.get(p.code) ?? p.code}</Link>
                    <span className="ml-2 text-xs text-muted">{p.code}</span>
                  </td>
                  <td className="px-3 py-2 text-muted">{libellePeriode(periodeDuTitre(p.libelle ?? '')) ?? 'non précisée'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sansPublication.length > 0 && (
        <p className="text-xs text-muted">
          Sans publication de résultats en base sur la période : {sansPublication.join(', ')}.
        </p>
      )}
    </div>
  );
}
