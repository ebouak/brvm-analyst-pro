import type { CronJob } from '@/lib/admin/cronHealth';
import { isBroken } from '@/lib/admin/cronHealth';

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/**
 * Tâches planifiées (pg_cron) — la moitié du système que le monitoring ne voyait pas.
 *
 * Les workers GitHub Actions écrivent dans `scraper_runs` ; les tâches pg_cron
 * n'écrivaient nulle part. Un job pouvait donc échouer toutes les 15 minutes
 * pendant des semaines sans qu'aucun écran ne le montre — c'est arrivé (672 fois).
 */
export function CronHealthPanel({ jobs }: { jobs: CronJob[] }) {
  if (jobs.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-ivory">Tâches planifiées (base de données)</h2>
        <p className="mt-2 text-xs text-muted">
          Aucune donnée. La lecture nécessite la migration 0095 (<code>get_cron_health</code>).
        </p>
      </section>
    );
  }

  const broken = jobs.filter(isBroken);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ivory">Tâches planifiées (base de données)</h2>
        {broken.length === 0 ? (
          <span className="rounded-full border border-up/30 bg-up/10 px-2 py-0.5 text-[10px] font-semibold text-up">
            {jobs.length} tâche{jobs.length > 1 ? 's' : ''} · aucune en panne
          </span>
        ) : (
          <span className="rounded-full border border-down/30 bg-down/10 px-2 py-0.5 text-[10px] font-semibold text-down">
            {broken.length} en panne
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted">
              <th className="py-2 pr-3 font-medium">Tâche</th>
              <th className="py-2 pr-3 font-medium">Fréquence</th>
              <th className="py-2 pr-3 text-right font-medium">24 h</th>
              <th className="py-2 pr-3 text-right font-medium">Échecs</th>
              <th className="py-2 pr-3 font-medium">Dernière</th>
              <th className="py-2 font-medium">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {jobs.map((j) => {
              const ko = isBroken(j);
              return (
                <tr key={j.jobname} className={ko ? 'bg-down/5' : undefined}>
                  <td className="py-2 pr-3 font-medium text-ivory">{j.jobname}</td>
                  <td className="tabular py-2 pr-3 text-faint">{j.schedule}</td>
                  <td className="tabular py-2 pr-3 text-right text-muted">{j.runs_24h}</td>
                  <td
                    className={`tabular py-2 pr-3 text-right ${j.failures_24h > 0 ? 'font-semibold text-down' : 'text-muted'}`}
                  >
                    {j.failures_24h}
                  </td>
                  <td className="tabular py-2 pr-3 text-faint">{fmt(j.last_run)}</td>
                  <td className="py-2">
                    {!j.active ? (
                      <span className="text-faint">Désactivée</span>
                    ) : ko ? (
                      <span className="font-semibold text-down">✖ En échec</span>
                    ) : (
                      <span className="text-up">✓ OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Le message d'erreur brut : sans lui, « en échec » n'aide personne à
          comprendre POURQUOI, et le job reste cassé. */}
      {broken.map((j) => (
        <div key={j.jobname} className="rounded-lg border border-down/40 bg-down/5 p-3">
          <p className="text-xs font-semibold text-down">{j.jobname}</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-[11px] text-muted">
            {j.last_error ?? 'Aucun message d’erreur enregistré.'}
          </pre>
        </div>
      ))}
    </section>
  );
}
