import type React from 'react';
import { fmtDateCourte } from '@/lib/format';
import { libelleSource, type ProfilSociete as Profil } from '@/lib/fiche/profilSociete';

const LIEN = 'rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

function Source({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={LIEN}>
      {libelleSource(url)}
    </a>
  );
}

/**
 * Profil de la société : ce qu'elle fait, qui la dirige, qui la détient.
 * Données retenues sur source officielle seulement (migration 0201) ; un bloc
 * sans donnée disparaît plutôt que d'afficher une information non vérifiée.
 */
export default function ProfilSociete({ profil }: { profil: Profil }) {
  const { presentation, metiers, determinants, dirigeants, actionnariat, siteWeb, verifieLe } = profil;
  const aDroite = dirigeants.length > 0 || actionnariat !== null;
  if (!presentation && !aDroite) return null;
  const pctMax = actionnariat ? actionnariat.lignes[0].pct : 0;

  return (
    <article aria-labelledby="profil-titre" className="rounded-card border border-border bg-surface p-5">
      <h3 id="profil-titre" className="text-base font-medium text-ivory">Profil de la société</h3>

      <div className={`mt-4 grid gap-8 ${aDroite ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}>
        <div className="min-w-0 space-y-5">
          {presentation && <p className="max-w-[65ch] text-sm leading-relaxed text-ivory/90 [text-wrap:pretty]">{presentation}</p>}

          {metiers.length > 0 && (
            <div>
              <h4 className="text-xs text-muted">Métiers</h4>
              <ul className="mt-2 space-y-1.5 text-sm text-ivory/90">
                {metiers.map((m) => <li key={m} className="flex gap-2"><span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-border-strong" />{m}</li>)}
              </ul>
            </div>
          )}

          {determinants.length > 0 && (
            <div>
              <h4 className="text-xs text-muted">Ce qui fait varier l&apos;activité</h4>
              <ul className="mt-2 space-y-1.5 text-sm text-muted">
                {determinants.map((d) => <li key={d} className="flex gap-2"><span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-border" />{d}</li>)}
              </ul>
            </div>
          )}
        </div>

        {aDroite && (
          <div className="min-w-0 space-y-6">
            {dirigeants.length > 0 && (
              <div>
                <h4 className="text-xs text-muted">Direction</h4>
                <dl className="mt-2 divide-y divide-border/60">
                  {dirigeants.map((d) => (
                    <div key={d.nom + d.fonction} className="py-2">
                      <dt className="text-xs text-muted">{d.fonction}</dt>
                      <dd className="text-sm text-ivory">{d.nom}</dd>
                      <dd className="text-xs text-faint">
                        {d.depuis && <>Depuis {d.depuis}, </>}source <Source url={d.source} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {actionnariat && (
              <div>
                <h4 className="text-xs text-muted">Actionnariat au {actionnariat.date}</h4>
                <ul className="mt-2 space-y-2.5">
                  {actionnariat.lignes.map((l, i) => (
                    <li key={l.nom}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 [overflow-wrap:break-word] text-ivory/90">{l.nom}</span>
                        <span className="tabular shrink-0 text-ivory">{l.pct.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-border/60" aria-hidden>
                        <div
                          className={`h-full rounded-full [width:var(--part)] ${i === 0 ? 'bg-accent' : 'bg-muted/50'}`}
                          style={{ '--part': `${((l.pct / pctMax) * 100).toFixed(0)}%` } as React.CSSProperties}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-faint">Source <Source url={actionnariat.source} /></p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-5 border-t border-border pt-3 text-xs text-faint">
        {aDroite
          ? <>Dirigeants et actionnariat repris seulement de sources officielles (BRVM, société), vérifiés le {fmtDateCourte(verifieLe)}.</>
          : <>Aucun dirigeant ni actionnariat confirmé par une source officielle au {fmtDateCourte(verifieLe)} : rien n&apos;est affiché plutôt qu&apos;une information non vérifiée.</>}
        {siteWeb && <> Site de la société : <a href={siteWeb} target="_blank" rel="noopener noreferrer" className={LIEN}>{libelleSource(siteWeb)}</a>.</>}
      </p>
    </article>
  );
}
