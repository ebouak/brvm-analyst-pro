import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, EmptyStatePremium } from '@/components/ui/premium';
import { chargerRun } from '@/lib/qa/lecture';
import { verdictRun, LIBELLE_VERDICT } from '@/lib/qa/verdict';
import { Alerte, Commit, LienArtefact, StatutFinal, VerdictBadge, fmtDate, fmtDuree } from '@/components/admin/qa/elements';

export const dynamic = 'force-dynamic';
export const metadata = { title: "Exécution de tests — Administration" };

const STATUTS = [
  ['echoue', 'Échoués'],
  ['intermittent', 'Intermittents'],
  ['reussi', 'Réussis'],
  ['ignore', 'Ignorés'],
] as const;

export default async function Page({ params, searchParams }: { params: { run: string }; searchParams: { module?: string; statut?: string } }) {
  await requirePermission('qa.read');

  let donnees: Awaited<ReturnType<typeof chargerRun>>;
  try {
    donnees = await chargerRun(params.run, searchParams);
  } catch {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Alerte ton="erreur" titre="Lecture de l'exécution impossible">La base n&apos;a pas répondu.</Alerte>
      </div>
    );
  }
  if (!donnees) notFound();
  const { run, resultats, modules, rapport } = donnees;
  const verdict = verdictRun(run, new Date());

  const lien = (changement: { module?: string; statut?: string }) => {
    const p = new URLSearchParams();
    const f = { ...searchParams, ...changement };
    if (f.module) p.set('module', f.module);
    if (f.statut) p.set('statut', f.statut);
    const qs = p.toString();
    return `/admin/qualite/${run.id}${qs ? `?${qs}` : ''}`;
  };
  const puce = (libelle: string, href: string, actif: boolean) => (
    <Link
      key={href + libelle}
      href={href}
      aria-current={actif ? 'true' : undefined}
      className={`rounded-lg border px-3 py-1.5 text-xs ${actif ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-muted hover:text-ivory'}`}
    >
      {libelle}
    </Link>
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <Link href="/admin/qualite" className="text-xs text-muted hover:text-ivory">← Qualité & Tests</Link>
      <SectionHeader title={`Passage du ${fmtDate(run.debut_at)}`} subtitle={LIBELLE_VERDICT[verdict]} />
      <div className="gold-rule" />

      <PremiumPanel className="p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
          <div><dt className="text-xs text-faint">Verdict</dt><dd className="mt-0.5"><VerdictBadge verdict={verdict} /></dd></div>
          <div><dt className="text-xs text-faint">Version testée</dt><dd><Commit sha={run.commit_sha} /> <span className="text-xs text-faint">{run.branche}</span></dd></div>
          <div><dt className="text-xs text-faint">Environnement</dt><dd className="text-ivory">{run.environnement}</dd></div>
          <div><dt className="text-xs text-faint">Durée</dt><dd className="tabular text-ivory">{fmtDuree(run.duree_ms)}</dd></div>
          <div><dt className="text-xs text-faint">Exécution CI</dt><dd>{run.ci_url ? <a href={run.ci_url} target="_blank" rel="noopener noreferrer" className="tabular text-accent hover:underline">#{run.ci_run_id} (tentative {run.ci_tentative})</a> : <span className="tabular">#{run.ci_run_id}</span>}</dd></div>
          <div><dt className="text-xs text-faint">Playwright</dt><dd className="tabular text-muted">{run.playwright_version ?? '—'}</dd></div>
          <div><dt className="text-xs text-faint">Fin</dt><dd className="tabular text-muted">{fmtDate(run.fin_at)}</dd></div>
          <div><dt className="text-xs text-faint">Rapport complet</dt><dd>{rapport ? <LienArtefact a={rapport} /> : <span className="text-faint">Rapport indisponible</span>}</dd></div>
        </dl>
      </PremiumPanel>

      {run.motif && <Alerte ton="erreur" titre="Motif"><span className="whitespace-pre-wrap">{run.motif}</span></Alerte>}

      <div className="flex flex-wrap items-center gap-2">
        {puce('Tous les statuts', lien({ statut: undefined }), !searchParams.statut)}
        {STATUTS.map(([v, l]) => puce(l, lien({ statut: v }), searchParams.statut === v))}
      </div>
      {modules.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {puce('Tous les modules', lien({ module: undefined }), !searchParams.module)}
          {modules.map((m) => puce(m, lien({ module: m }), searchParams.module === m))}
        </div>
      )}

      {resultats.length === 0 ? (
        <EmptyStatePremium
          title={searchParams.module || searchParams.statut ? 'Aucun scénario pour ces filtres' : 'Aucun scénario dans cette exécution'}
          hint={run.statut === 'en_cours' ? 'Les résultats arriveront à la fin du passage.' : run.statut === 'erreur_infra' ? "Les tests n'ont pas pu s'exécuter : voir le motif ci-dessus." : undefined}
        />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <caption className="sr-only">Scénarios de l&apos;exécution</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-faint">
                <th scope="col" className="px-4 py-3 font-medium">Statut</th>
                <th scope="col" className="px-4 py-3 font-medium">Module</th>
                <th scope="col" className="px-4 py-3 font-medium">Scénario</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Tentatives</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Durée</th>
              </tr>
            </thead>
            <tbody>
              {resultats.map((r) => (
                <tr key={r.id} className={`border-b border-border/40 last:border-0 ${r.statut_final === 'echoue' ? 'bg-down/[0.04]' : ''}`}>
                  <td className="px-4 py-2.5"><StatutFinal statut={r.statut_final} /></td>
                  <td className="px-4 py-2.5 text-muted">{r.module}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/qualite/scenario/${r.id}`} className="text-ivory hover:text-accent">{r.titre}</Link>
                    <div className="text-xs text-faint">{r.fichier}{r.projet ? ` · ${r.projet}` : ''}</div>
                  </td>
                  <td className="tabular px-4 py-2.5 text-right text-muted">{r.nb_tentatives}</td>
                  <td className="tabular px-4 py-2.5 text-right text-muted">{fmtDuree(r.duree_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}
    </div>
  );
}
