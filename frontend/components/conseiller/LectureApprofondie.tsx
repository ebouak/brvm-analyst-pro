import Link from 'next/link';
import type { CleFamille, Tier } from '@/lib/conseiller/facteurs';
import { croisement, type TypePhrase } from '@/lib/conseiller/croisement';
import type { LectureCode } from '@/lib/conseiller/lectureApprofondie';
import { nombreFr, pctFr } from '@/lib/fiche/affichage';
import { fmtDateCourte } from '@/lib/format';

const ILLISIBLE = 'Donnée momentanément illisible';
const MARQUE: Record<TypePhrase, string> = { convergence: 'Concorde', divergence: 'Diverge', info: 'À noter' };

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{libelle}</dt>
      <dd className="tabular text-ivory">{valeur}</dd>
    </div>
  );
}

/** Lecture approfondie Premium : quatre volets, repliée par défaut (details/summary, sans JavaScript). */
export function LectureApprofondie({ lecture, tiers }: { lecture: LectureCode; tiers: Partial<Record<CleFamille, Tier | null>> }) {
  const { comptes, intermediaire, actualites } = lecture;
  const phrases = intermediaire.ok && actualites.ok
    ? croisement({
        tiers,
        periode: intermediaire.data?.libelle ?? null,
        variationResultatPct: intermediaire.data?.variationResultatPct ?? null,
        variationCaPct: intermediaire.data?.variationCaPct ?? null,
        nbActualites: actualites.data.total,
      })
    : null;

  return (
    <details className="mt-3 border-t border-border pt-3 text-sm">
      <summary className="cursor-pointer text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        Lecture approfondie
      </summary>
      <div className="mt-3 space-y-4">
        <section>
          <h4 className="font-medium text-ivory">Comptes</h4>
          {!comptes.ok ? <p className="mt-1 text-muted">{ILLISIBLE}</p> : comptes.data.exercice == null ? (
            <p className="mt-1 text-muted">Aucun compte annuel publié.</p>
          ) : (
            <dl className="mt-1 space-y-1">
              <Ligne libelle={`PER (exercice ${comptes.data.exercice})`} valeur={comptes.data.per != null ? `${nombreFr(comptes.data.per, 1)}x` : '—'} />
              <Ligne libelle="Cours / fonds propres" valeur={comptes.data.pb != null ? `${nombreFr(comptes.data.pb, 2)}x` : '—'} />
              <Ligne libelle="Rentabilité des fonds propres" valeur={comptes.data.roe != null ? pctFr(comptes.data.roe * 100, 1) : '—'} />
              <Ligne libelle="Dette / fonds propres" valeur={comptes.data.gearing != null ? `${nombreFr(comptes.data.gearing, 2)}x` : '—'} />
            </dl>
          )}
        </section>

        <section>
          <h4 className="font-medium text-ivory">Résultats intermédiaires</h4>
          {!intermediaire.ok ? <p className="mt-1 text-muted">{ILLISIBLE}</p> : intermediaire.data == null ? (
            <p className="mt-1 text-muted">Aucun résultat intermédiaire publié.</p>
          ) : !intermediaire.data.comparable ? (
            <p className="mt-1 text-muted">{intermediaire.data.libelle} : pas de période comparable.</p>
          ) : (
            <dl className="mt-1 space-y-1">
              <Ligne libelle={`Chiffre d'affaires, ${intermediaire.data.libelle} sur un an`} valeur={intermediaire.data.variationCaPct != null ? pctFr(intermediaire.data.variationCaPct, 1, true) : '—'} />
              <Ligne libelle={`Résultat net, ${intermediaire.data.libelle} sur un an`} valeur={intermediaire.data.variationResultatPct != null ? pctFr(intermediaire.data.variationResultatPct, 1, true) : '—'} />
            </dl>
          )}
        </section>

        <section>
          <h4 className="font-medium text-ivory">Actualité du moment</h4>
          {!actualites.ok ? <p className="mt-1 text-muted">{ILLISIBLE}</p> : actualites.data.derniers.length === 0 ? (
            <p className="mt-1 text-muted">Aucune actualité rattachée sur 30 jours</p>
          ) : (
            <ul className="mt-1 space-y-1.5">
              {actualites.data.derniers.map((a, i) => (
                <li key={i}>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-ivory underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{a.titre}</a>
                  ) : <span className="text-ivory">{a.titre}</span>}
                  <span className="block text-xs text-muted">{a.source} · <span className="tabular">{fmtDateCourte(a.date)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="font-medium text-ivory">Convergences et divergences</h4>
          {phrases == null ? <p className="mt-1 text-muted">{ILLISIBLE}</p> : (
            <ul className="mt-1 space-y-1.5">
              {phrases.map((p, i) => (
                <li key={i} className="text-ivory">
                  <span className="mr-2 rounded border border-border px-1.5 py-0.5 text-xs text-muted">{MARQUE[p.type]}</span>
                  <span className="tabular">{p.texte}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-faint">Lecture des données publiées, pas un conseil ni une décision.</p>
      </div>
    </details>
  );
}

/** Pour un utilisateur sans accès : aucune donnée Premium n'a été chargée. */
export function LectureApprofondieVerrouillee() {
  return (
    <p className="mt-3 border-t border-border pt-3 text-sm text-muted">
      Lecture approfondie réservée au Premium.{' '}
      <Link href="/pricing" className="text-accent-ink underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        Voir les offres
      </Link>
    </p>
  );
}
