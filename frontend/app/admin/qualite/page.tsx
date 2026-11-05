import Link from 'next/link';
import { Suspense } from 'react';
import { requirePermission } from '@/lib/server/rbac';
import { SectionHeader, PremiumPanel, MetricCard, EmptyStatePremium } from '@/components/ui/premium';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { chargerTableau, ENVIRONNEMENTS, FILTRES_VERDICT, PAR_PAGE, type RunLigne } from '@/lib/qa/lecture';
import { compareVersions, resultatsAnciens, verdictRun, LIBELLE_VERDICT } from '@/lib/qa/verdict';
import { Alerte, Commit, Pagination, VerdictBadge, fmtDate, fmtDuree } from '@/components/admin/qa/elements';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Qualité & Tests — Administration' };

type Params = { page?: string; env?: string; verdict?: string; module?: string };

/**
 * Tableau de bord des tests e2e (lecture seule, V1 : aucun déclenchement ici).
 * Pas de loading.tsx : le chargement passe par <Suspense> DANS la page — un
 * loading.tsx au-dessus des pages de détail, qui appellent notFound(), ferait
 * répondre 200 sur un identifiant inconnu (règle soft-404 de CLAUDE.md).
 */
export default async function Page({ searchParams }: { searchParams: Params }) {
  await requirePermission('qa.read');
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <SectionHeader
        title="Qualité & Tests"
        subtitle="Résultats des tests de bout en bout (Playwright) publiés par la CI. Lecture seule : les exécutions se lancent depuis GitHub Actions."
      />
      <div className="gold-rule" />
      <Suspense fallback={<LoadingSkeleton />}>
        <Contenu params={searchParams} />
      </Suspense>
    </div>
  );
}

function lienAvec(params: Params, changement: Partial<Params>): string {
  const p = new URLSearchParams();
  const fusion = { ...params, ...changement };
  for (const [k, v] of Object.entries(fusion)) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `/admin/qualite?${qs}` : '/admin/qualite';
}

async function Contenu({ params }: { params: Params }) {
  const page = Math.max(1, Number(params.page) || 1);
  let donnees: Awaited<ReturnType<typeof chargerTableau>>;
  try {
    donnees = await chargerTableau({ page, environnement: params.env, verdict: params.verdict, module: params.module });
  } catch {
    return (
      <Alerte ton="erreur" titre="Lecture des résultats impossible">
        La base n&apos;a pas répondu. Aucune conclusion ne peut être tirée sur l&apos;état des tests tant que cette page ne charge pas.
      </Alerte>
    );
  }

  const { derniere, runs, total, modules } = donnees;
  if (!derniere) {
    return (
      <EmptyStatePremium
        icon="◇"
        title="Aucune exécution enregistrée"
        hint="Aucun test n'a encore été importé : rien n'est validé. La première exécution apparaîtra ici après le prochain passage de la CI (chaque nuit à 03:00 UTC, ou lancement manuel du workflow « Tests e2e » sur GitHub)."
      />
    );
  }

  const filtre = Boolean(params.env || params.verdict || params.module);
  return (
    <>
      <DerniereExecution run={derniere} />

      <PremiumPanel className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3 text-sm" aria-label="Filtrer l'historique">
          <Choix nom="env" libelle="Environnement" valeur={params.env} options={ENVIRONNEMENTS.map((e) => [e, e])} />
          <Choix nom="verdict" libelle="Statut" valeur={params.verdict} options={FILTRES_VERDICT.map((v) => [v, LIBELLE_VERDICT[v]])} />
          <Choix nom="module" libelle="Module" valeur={params.module} options={modules.map((m) => [m, m])} />
          <button type="submit" className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-accent hover:bg-accent/20">
            Filtrer
          </button>
          {filtre && (
            <Link href="/admin/qualite" className="px-2 py-1.5 text-xs text-muted hover:text-ivory">
              Réinitialiser
            </Link>
          )}
        </form>
      </PremiumPanel>

      {runs.length === 0 ? (
        <EmptyStatePremium title="Aucune exécution ne correspond à ces filtres" hint="Élargissez la recherche ou réinitialisez les filtres." />
      ) : (
        <PremiumPanel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <caption className="sr-only">Historique des exécutions de tests</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-faint">
                <th scope="col" className="px-4 py-3 font-medium">Début</th>
                <th scope="col" className="px-4 py-3 font-medium">Verdict</th>
                <th scope="col" className="px-4 py-3 font-medium">Env.</th>
                <th scope="col" className="px-4 py-3 font-medium">Version testée</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Réussis</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Échoués</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Intermittents</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Ignorés</th>
                <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Détail</span></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-border/40 last:border-0">
                  <td className="tabular whitespace-nowrap px-4 py-2.5 text-muted">{fmtDate(r.debut_at)}</td>
                  <td className="px-4 py-2.5"><VerdictBadge verdict={verdictRun(r, new Date())} /></td>
                  <td className="px-4 py-2.5 text-muted">{r.environnement}</td>
                  <td className="px-4 py-2.5"><Commit sha={r.commit_sha} /> <span className="text-xs text-faint">{r.branche}</span></td>
                  <td className="tabular px-4 py-2.5 text-right text-up">{r.nb_reussis}</td>
                  <td className={`tabular px-4 py-2.5 text-right ${r.nb_echoues ? 'text-down font-semibold' : 'text-faint'}`}>{r.nb_echoues}</td>
                  <td className={`tabular px-4 py-2.5 text-right ${r.nb_intermittents ? 'text-warn' : 'text-faint'}`}>{r.nb_intermittents}</td>
                  <td className="tabular px-4 py-2.5 text-right text-faint">{r.nb_ignores}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/admin/qualite/${r.id}${params.module ? `?module=${encodeURIComponent(params.module)}` : ''}`} className="text-xs text-accent hover:underline">
                      Détail →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </PremiumPanel>
      )}

      <Pagination page={page} total={total} parPage={PAR_PAGE} lien={(p) => lienAvec(params, { page: String(p) })} />
    </>
  );
}

function Choix({ nom, libelle, valeur, options }: { nom: string; libelle: string; valeur?: string; options: Array<[string, string]> }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {libelle}
      <select name={nom} defaultValue={valeur ?? ''} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-ivory">
        <option value="">Tous</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function DerniereExecution({ run }: { run: RunLigne }) {
  const maintenant = new Date();
  const verdict = verdictRun(run, maintenant);
  const deployee = process.env.VERCEL_GIT_COMMIT_SHA;
  const versions = compareVersions(run.commit_sha, deployee);
  const ancien = resultatsAnciens(run.fin_at ?? run.debut_at, maintenant);
  const executes = run.nb_reussis + run.nb_echoues + run.nb_intermittents;

  return (
    <section aria-labelledby="derniere" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="derniere" className="font-display text-lg text-ivory">Dernière exécution</h2>
        <VerdictBadge verdict={verdict} />
        <Link href={`/admin/qualite/${run.id}`} className="text-xs text-accent hover:underline">Voir le détail →</Link>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
        <div><dt className="text-xs text-faint">Version testée</dt><dd><Commit sha={run.commit_sha} /> <span className="text-xs text-faint">{run.branche}</span></dd></div>
        <div><dt className="text-xs text-faint">Environnement</dt><dd className="text-ivory">{run.environnement}</dd></div>
        <div><dt className="text-xs text-faint">Début</dt><dd className="tabular text-ivory">{fmtDate(run.debut_at)}</dd></div>
        <div><dt className="text-xs text-faint">Durée</dt><dd className="tabular text-ivory">{fmtDuree(run.duree_ms)}</dd></div>
      </dl>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Réussis" value={String(run.nb_reussis)} accent="emerald" />
        <MetricCard label="Échoués" value={String(run.nb_echoues)} accent={run.nb_echoues ? 'gold' : 'neutral'} />
        <MetricCard label="Intermittents" value={String(run.nb_intermittents)} accent="neutral" />
        <MetricCard label="Ignorés" value={String(run.nb_ignores)} accent="neutral" />
      </div>

      {verdict === 'en_cours' && (
        <Alerte ton="info" titre="Exécution en cours">Les compteurs ci-dessus se rempliront à la fin du passage de la CI.</Alerte>
      )}
      {verdict === 'incomplet' && (
        <Alerte ton="attention" titre="Exécution incomplète">
          La CI a déclaré le début mais aucune fin n&apos;est arrivée : le runner s&apos;est probablement arrêté. Aucun résultat n&apos;est à retenir.
        </Alerte>
      )}
      {(verdict === 'erreur_infra' || verdict === 'interrompu') && run.motif && (
        <Alerte ton="erreur" titre={LIBELLE_VERDICT[verdict]}><span className="whitespace-pre-wrap">{run.motif}</span></Alerte>
      )}
      {verdict === 'aucun_test' && (
        <Alerte ton="attention" titre="Aucun test exécuté">
          {run.nb_ignores > 0
            ? `Les ${run.nb_ignores} scénarios ont été ignorés (identifiants de test absents ?). Rien n'est validé.`
            : "Le rapport ne contient aucun scénario. Rien n'est validé."}
        </Alerte>
      )}
      {ancien && (
        <Alerte ton="attention" titre="Résultats anciens">
          Cette exécution date de plus de 7 jours : elle ne dit rien des changements publiés depuis.
        </Alerte>
      )}
      {versions === 'differente' && (
        <Alerte ton="attention" titre="La version en ligne n'est pas celle qui a été testée">
          En ligne : <Commit sha={deployee!} />. Testée : <Commit sha={run.commit_sha} />.
          {executes > 0 ? ' Ces résultats portent sur la version testée seulement.' : ''}
        </Alerte>
      )}
      {versions === 'inconnue' && (
        <p className="text-xs text-faint">Version en ligne inconnue ici (variable VERCEL_GIT_COMMIT_SHA absente) : comparaison impossible.</p>
      )}
      {versions === 'identique' && <p className="text-xs text-faint">La version en ligne est celle qui a été testée.</p>}
    </section>
  );
}
