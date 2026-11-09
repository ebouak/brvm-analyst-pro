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
function Paire({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-1.5">
      <dt className="text-xs text-muted">{libelle}</dt>
      <dd className="min-w-0 [overflow-wrap:break-word] text-sm text-ivory/90">{children}</dd>
    </div>
  );
}

/**
 * `points` : constats calculés par la page depuis NOS comptes et dividendes
 * (lib/fiche/pointsCles) ; vide si l'accès aux fondamentaux est verrouillé.
 */
export default function ProfilSociete({ profil, points = [] }: { profil: Profil; points?: string[] }) {
  const { presentation, historique, identite, metiers, determinants, dirigeants, actionnariat, siteWeb, verifieLe } = profil;
  const aDroite = dirigeants.length > 0 || actionnariat !== null || identite !== null;
  const aOfficiel = dirigeants.length > 0 || actionnariat !== null;
  if (!presentation && !historique && !aDroite && points.length === 0) return null;
  const pctMax = actionnariat ? actionnariat.lignes[0].pct : 0;
  const dateLongue = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <article aria-labelledby="profil-titre" className="rounded-card border border-border bg-surface p-5">
      <h3 id="profil-titre" className="text-base font-medium text-ivory">Profil de la société</h3>

      <div className={`mt-4 grid gap-8 ${aDroite ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''}`}>
        <div className="min-w-0 space-y-5">
          {presentation && <p className="max-w-[65ch] text-sm leading-relaxed text-ivory/90 [text-wrap:pretty]">{presentation}</p>}

          {historique && (
            <div>
              <h4 className="text-xs text-muted">Historique</h4>
              <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-ivory/90 [text-wrap:pretty]">{historique}</p>
            </div>
          )}

          {points.length > 0 && (
            <div>
              <h4 className="text-xs text-muted">Points clés</h4>
              <ul className="mt-2 space-y-1.5 text-sm text-ivory/90">
                {points.map((p) => <li key={p} className="tabular-nums flex gap-2"><span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-accent" />{p}</li>)}
              </ul>
              <p className="mt-1.5 text-xs text-faint">Calculés à partir des comptes et des dividendes affichés sur cette fiche.</p>
            </div>
          )}

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

            {identite && (
              <div>
                <h4 className="text-xs text-muted">Identité</h4>
                <dl className="mt-1 divide-y divide-border/60">
                  {identite.raisonSociale && <Paire libelle="Raison sociale">{identite.raisonSociale}</Paire>}
                  {identite.isin && <Paire libelle="Code ISIN"><span className="tabular">{identite.isin}</span></Paire>}
                  {identite.introduction && <Paire libelle="Cotée depuis le">{dateLongue(identite.introduction)}</Paire>}
                  {identite.capital && (
                    <Paire libelle="Capital social">
                      <span className="tabular">{identite.capital.montant.toLocaleString('fr-FR')} FCFA</span>
                      <span className="block text-xs text-faint">nominal de {identite.capital.nominal.toLocaleString('fr-FR')} FCFA par action</span>
                    </Paire>
                  )}
                  {identite.siege && <Paire libelle="Siège">{identite.siege}</Paire>}
                  {identite.fractionnements.length > 0 && (
                    <Paire libelle="Fractionnements">
                      <ul className="space-y-1">
                        {identite.fractionnements.map((f) => <li key={f.date}>{dateLongue(f.date)} : {f.parite}</li>)}
                      </ul>
                    </Paire>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-5 border-t border-border pt-3 text-xs text-faint">
        {aOfficiel
          ? <>Dirigeants et actionnariat repris seulement de sources officielles (BRVM, société), vérifiés le {fmtDateCourte(verifieLe)}.</>
          : <>Aucun dirigeant ni actionnariat confirmé par une source officielle au {fmtDateCourte(verifieLe)} : rien n&apos;est affiché plutôt qu&apos;une information non vérifiée.</>}
        {identite && <> Identité : fiche de la société sur le site de la BRVM ; le capital n&apos;est affiché que s&apos;il concorde avec le nombre d&apos;actions en circulation.</>}
        {siteWeb && <> Site de la société : <a href={siteWeb} target="_blank" rel="noopener noreferrer" className={LIEN}>{libelleSource(siteWeb)}</a>.</>}
      </p>
    </article>
  );
}
