import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, EmptyStatePremium } from '@/components/ui/premium';
import { chargerResultat } from '@/lib/qa/lecture';
import { Alerte, Commit, LienArtefact, StatutFinal, fmtDate, fmtDuree, libelleTentative } from '@/components/admin/qa/elements';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Scénario de test — Administration' };

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requirePermission('qa.read');

  let donnees: Awaited<ReturnType<typeof chargerResultat>>;
  try {
    donnees = await chargerResultat(params.id);
  } catch {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Alerte ton="erreur" titre="Lecture du scénario impossible">La base n&apos;a pas répondu.</Alerte>
      </div>
    );
  }
  if (!donnees) notFound();
  const { resultat, run, tentatives, historique } = donnees;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <Link href={`/admin/qualite/${run.id}`} className="text-xs text-muted hover:text-ivory">← Exécution du {fmtDate(run.debut_at)}</Link>
      <SectionHeader kicker={`Module ${resultat.module}`} title={resultat.titre} subtitle={`${resultat.fichier}${resultat.projet ? ` · ${resultat.projet}` : ''}`} />
      <div className="gold-rule" />

      <PremiumPanel className="p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
          <div><dt className="text-xs text-faint">Statut final</dt><dd><StatutFinal statut={resultat.statut_final} /></dd></div>
          <div><dt className="text-xs text-faint">Tentatives</dt><dd className="tabular text-ivory">{resultat.nb_tentatives}</dd></div>
          <div><dt className="text-xs text-faint">Durée cumulée</dt><dd className="tabular text-ivory">{fmtDuree(resultat.duree_ms)}</dd></div>
          <div><dt className="text-xs text-faint">Version testée</dt><dd><Commit sha={run.commit_sha} /></dd></div>
        </dl>
        {resultat.statut_final === 'intermittent' && (
          <p className="mt-3 text-xs text-warn">
            Intermittent : échec puis réussite à la relance. Le scénario est passé, mais son instabilité est à corriger.
          </p>
        )}
      </PremiumPanel>

      <section aria-labelledby="tentatives" className="space-y-3">
        <h2 id="tentatives" className="font-display text-lg text-ivory">Tentatives</h2>
        {tentatives.length === 0 ? (
          <EmptyStatePremium title="Aucune tentative enregistrée" hint="Le scénario a été ignoré sans être lancé." />
        ) : (
          tentatives.map((t) => (
            <PremiumPanel key={t.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-ivory">
                  {t.numero === 0 ? 'Premier essai' : `Relance n° ${t.numero}`} — {libelleTentative(t.statut)}
                </span>
                <span className="tabular text-xs text-muted">{fmtDate(t.debut_at)} · {fmtDuree(t.duree_ms)}</span>
              </div>
              {t.erreur ? (
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg p-3 text-xs text-muted">{t.erreur}</pre>
              ) : t.statut !== 'passed' && t.statut !== 'skipped' ? (
                <p className="text-xs text-faint">Aucun message d&apos;erreur transmis par Playwright.</p>
              ) : null}
              {t.qa_artefacts.length > 0 && (
                <ul className="flex flex-wrap gap-4 text-xs">
                  {t.qa_artefacts.map((a) => <li key={a.id}><LienArtefact a={a} /></li>)}
                </ul>
              )}
            </PremiumPanel>
          ))
        )}
        <p className="text-xs text-faint">
          Les erreurs sont nettoyées avant stockage : jetons, clés, cookies, paramètres sensibles et adresses e-mail sont masqués.
        </p>
      </section>

      {historique.length > 1 && (
        <section aria-labelledby="historique" className="space-y-3">
          <h2 id="historique" className="font-display text-lg text-ivory">Ce scénario sur les dernières exécutions</h2>
          <PremiumPanel className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <caption className="sr-only">Historique du scénario</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                  <th scope="col" className="px-4 py-3 font-medium">Exécution</th>
                  <th scope="col" className="px-4 py-3 font-medium">Version</th>
                  <th scope="col" className="px-4 py-3 font-medium">Env.</th>
                  <th scope="col" className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {historique.map((h) => (
                  <tr key={h.id} className={`border-b border-border/40 last:border-0 ${h.id === resultat.id ? 'bg-accent/[0.05]' : ''}`}>
                    <td className="tabular px-4 py-2.5">
                      <Link href={`/admin/qualite/scenario/${h.id}`} className="text-muted hover:text-ivory">{fmtDate(h.qa_runs!.debut_at)}</Link>
                    </td>
                    <td className="px-4 py-2.5"><Commit sha={h.qa_runs!.commit_sha} /></td>
                    <td className="px-4 py-2.5 text-muted">{h.qa_runs!.environnement}</td>
                    <td className="px-4 py-2.5"><StatutFinal statut={h.statut_final} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PremiumPanel>
        </section>
      )}
    </div>
  );
}
