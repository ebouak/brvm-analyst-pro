'use client';

import { useMemo, useState } from 'react';
import { PAYS, type Sgi } from '@/lib/sgi-frais/directory';
import type { SgiFrais } from '@/lib/sgi-frais/types';
import { CONFIANCE_LABEL, CONFIANCE_BADGE_CLASS, lienDecision } from '@/lib/sgi-frais/types';
import { scorerSgi, type ProfilInvestisseur, type SgiMatch } from '@/lib/sgi-frais/moteur';
import Link from 'next/link';
import { drapeau, slugSgi } from '@/lib/sgi-frais/identite';
import { ORDRES_MAX, lienAvecScenario, type Scenario } from '@/lib/sgi-frais/scenario';

type Priorite = ProfilInvestisseur['priorite'];

/** Pays de résidence proposés : UEMOA entière, Guinée-Bissau comprise, même
 * sans SGI qui y ait son siège (le marché régional lui est ouvert). */
const RESIDENCES: { code: string; nom: string }[] = [
  ...Object.entries(PAYS).map(([code, p]) => ({ code, nom: p.nom })),
  { code: 'GW', nom: 'Guinée-Bissau' },
];

/** Scénario du comparateur tiré du profil : capital investi sur un an, ordres
 * répartis en achats et ventes, plafonnés à ORDRES_MAX chacun. */
function scenarioDuProfil(p: ProfilInvestisseur): { scenario: Scenario; plafonne: boolean } {
  const achats = Math.ceil(p.ordresParAn / 2);
  const ventes = Math.floor(p.ordresParAn / 2);
  return {
    scenario: { montant: p.capital, dureeAns: 1, nbAchats: Math.min(achats, ORDRES_MAX), nbVentes: Math.min(ventes, ORDRES_MAX), montantParOrdre: null },
    plafonne: achats > ORDRES_MAX || ventes > ORDRES_MAX,
  };
}

/**
 * Moteur de choix SGI — questionnaire en 5 étapes puis classement scoré
 * TRANSPARENT (chaque point justifié, données manquantes affichées comme
 * telles). Différenciateur : personnalisé sur les barèmes réels homologués
 * AMF-UMOA collectés, pas un annuaire statique.
 */

const CAPITAUX = [
  { label: '< 250 000 FCFA', value: 150_000 },
  { label: '250 000 – 1 M', value: 600_000 },
  { label: '1 M – 5 M', value: 2_500_000 },
  { label: '> 5 M', value: 10_000_000 },
];

const FREQUENCES = [
  { label: 'Occasionnel (1-2 ordres/an)', value: 2 },
  { label: 'Régulier (~1 ordre/mois)', value: 12 },
  { label: 'Actif (1+ ordre/semaine)', value: 48 },
];

const MEDALS = ['1ᵉʳ', '2ᵉ', '3ᵉ'];

const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export default function SgiMatchmaker({ directory, frais }: { directory: Sgi[]; frais: SgiFrais[] }) {
  const [step, setStep] = useState(0);
  const [pays, setPays] = useState<string | null>(null);
  const [capital, setCapital] = useState<number | null>(null);
  const [ordres, setOrdres] = useState<number | null>(null);
  const [autonomie, setAutonomie] = useState<ProfilInvestisseur['autonomie'] | null>(null);
  const [priorites, setPriorites] = useState<Priorite[]>([]);
  const [valide, setValide] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const priorite = valide && priorites.length ? priorites[0]! : null;

  const profil: ProfilInvestisseur | null =
    pays && capital != null && ordres != null && autonomie && priorite
      ? { pays, capital, ordresParAn: ordres, autonomie, priorite, priorites }
      : null;

  const matches: SgiMatch[] = useMemo(
    () => (profil ? scorerSgi(directory, frais, profil) : []),
    [profil, directory, frais],
  );

  const reset = () => {
    setStep(0); setPays(null); setCapital(null); setOrdres(null);
    setAutonomie(null); setPriorites([]); setValide(false); setShowAll(false);
  };

  const QUESTIONS: { titre: string; contenu: React.ReactNode }[] = [
    {
      titre: 'Où résidez-vous ?',
      contenu: (
        <div className="flex flex-wrap gap-2">
          {RESIDENCES.map(({ code, nom }) => (
            <button
              key={code} type="button"
              onClick={() => { setPays(code); setStep(1); }}
              aria-pressed={pays === code}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm transition-all hover:border-accent/50 hover:bg-accent/10 active:scale-95 ${
                pays === code ? 'border-accent/60 bg-accent/15 text-ivory' : 'border-border bg-surface/40 text-ivory'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={drapeau(code)} alt="" width={18} height={12} className="h-3 w-[18px] rounded-[2px]" />
              {nom}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setPays('DIASPORA'); setStep(1); }}
            className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent transition-all hover:bg-accent/20 active:scale-95"
          >
            Diaspora (hors UEMOA)
          </button>
          <p className="mt-1 w-full text-[12px] leading-relaxed text-faint">
            Aucune SGI n’a son siège en Guinée-Bissau : celles des autres pays de l’UEMOA vous sont ouvertes, le marché étant régional.
          </p>
        </div>
      ),
    },
    {
      titre: 'Quel capital de départ ?',
      contenu: (
        <div className="flex flex-wrap gap-2">
          {CAPITAUX.map((c) => (
            <button
              key={c.value} type="button"
              onClick={() => { setCapital(c.value); setStep(2); }}
              className="rounded-full border border-border bg-surface/40 px-4 py-2.5 tabular text-sm text-ivory transition-all hover:border-accent/50 hover:bg-accent/10 active:scale-95"
            >
              {c.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      titre: 'À quelle fréquence comptez-vous trader ?',
      contenu: (
        <div className="flex flex-wrap gap-2">
          {FREQUENCES.map((f) => (
            <button
              key={f.value} type="button"
              onClick={() => { setOrdres(f.value); setStep(3); }}
              className="rounded-full border border-border bg-surface/40 px-4 py-2.5 text-sm text-ivory transition-all hover:border-accent/50 hover:bg-accent/10 active:scale-95"
            >
              {f.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      titre: 'Comment voulez-vous passer vos ordres ?',
      contenu: (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setAutonomie('en_ligne'); setStep(4); }}
            className="rounded-full border border-border bg-surface/40 px-4 py-2.5 text-sm text-ivory transition-all hover:border-accent/50 hover:bg-accent/10 active:scale-95"
          >
            En ligne, en autonomie
          </button>
          <button
            type="button"
            onClick={() => { setAutonomie('accompagne'); setStep(4); }}
            className="rounded-full border border-border bg-surface/40 px-4 py-2.5 text-sm text-ivory transition-all hover:border-accent/50 hover:bg-accent/10 active:scale-95"
          >
            Accompagné par un conseiller
          </button>
        </div>
      ),
    },
    {
      titre: 'Ce qui compte pour vous (un ou plusieurs choix) ?',
      contenu: (
        <div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Vos priorités">
            {([
              ['cout', 'Les frais les plus bas'],
              ['solidite', 'Un adossement bancaire solide'],
              ['proximite', 'La proximité géographique'],
              ['equilibre', 'Un bon équilibre de tout'],
            ] as const).map(([val, label]) => {
              const actif = priorites.includes(val);
              return (
                <button
                  key={val} type="button"
                  aria-pressed={actif}
                  onClick={() => setPriorites((p) => (actif ? p.filter((x) => x !== val) : [...p, val]))}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm transition-all hover:border-accent/50 active:scale-95 ${
                    actif ? 'border-accent/60 bg-accent/15 text-ivory' : 'border-border bg-surface/40 text-ivory hover:bg-accent/10'
                  }`}
                >
                  <span aria-hidden className={`grid h-4 w-4 place-items-center rounded border text-[10px] ${actif ? 'border-accent bg-accent text-bg' : 'border-border'}`}>
                    {actif ? '✓' : ''}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={priorites.length === 0}
            onClick={() => setValide(true)}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-accent px-5 text-sm font-semibold text-bg transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Voir mon classement →
          </button>
          {priorites.length > 1 && (
            <p className="mt-2 text-[12px] text-faint">Plusieurs choix : le score fait la moyenne de leurs pondérations.</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <section id="moteur-sgi" className="scroll-mt-24 rounded-panel border border-accent/25 bg-accent/[0.04] p-6 md:p-8">
      <p className="overline mb-2 text-gold-2">Étape 1 · Moteur de choix (exclusif)</p>
      <h2 className="mb-1 font-display text-2xl text-ivory [letter-spacing:-0.03em]">
        Quelle SGI est faite pour vous ?
      </h2>
      <p className="mb-6 max-w-[62ch] text-sm leading-relaxed text-muted">
        5 questions, et le moteur classe les {directory.length} SGI selon VOTRE profil : sur la base
        des barèmes réels ({frais.filter((f) => f.confiance === 'homologue_crepmf').length} grilles
        homologuées AMF-UMOA en base). Chaque point du score est justifié, rien n&apos;est inventé.
      </p>

      {!profil ? (
        <div>
          {/* Barre de progression */}
          <div className="mb-5 flex items-center gap-2">
            {QUESTIONS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? 'bg-accent' : i === step ? 'bg-accent/50' : 'bg-border'}`}
              />
            ))}
            <span className="ml-2 font-mono text-[11px] text-faint">{step + 1}/5</span>
          </div>
          <p className="mb-4 font-display text-lg text-ivory">{QUESTIONS[step].titre}</p>
          {QUESTIONS[step].contenu}
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="mt-4 text-xs text-muted underline-offset-4 hover:text-ivory hover:underline"
            >
              ← Question précédente
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* Podium top 3 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {matches.slice(0, 3).map((m, i) => (
              <article
                key={m.sgi.nom}
                className={`rounded-panel border p-5 ${i === 0 ? 'border-accent/50 bg-accent/[0.07] shadow-gold' : 'border-border bg-surface/40'}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-2xl" aria-hidden>{MEDALS[i]}</span>
                  <span className={`tabular rounded-full px-2.5 py-1 font-mono text-[11px] font-bold ${i === 0 ? 'bg-accent text-[#03222b]' : 'bg-elevated text-muted'}`}>
                    {m.score}/100
                  </span>
                </div>
                <h3 className="font-display text-lg leading-tight text-ivory">{m.sgi.nom}</h3>
                <p className="mt-0.5 text-[11px] text-muted">{PAYS[m.sgi.pays]?.nom} · {m.sgi.type}</p>

                {m.coutAnnuel != null && (
                  <p className="tabular mt-2 text-sm font-bold text-up">
                    ≈ {fmtFcfa(m.coutAnnuel)}/an
                    <span className="ml-1 font-normal text-faint">({m.coutPct?.toFixed(2)} % du capital)</span>
                  </p>
                )}
                {m.frais && (
                  <span className={`mt-2 inline-block rounded-md border px-2 py-0.5 text-[10px] ${CONFIANCE_BADGE_CLASS[m.frais.confiance]}`}>
                    {CONFIANCE_LABEL[m.frais.confiance]}
                  </span>
                )}
                {m.alerteDepotMin && (
                  <p className="mt-2 text-[11px] text-warn">Capital sous le dépôt minimum exigé</p>
                )}

                {/* Justification par critère */}
                <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {m.criteres.map((c) => (
                    <li key={c.cle} className="text-[11px] leading-snug">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-muted">{c.label}</span>
                        <span className="tabular font-mono text-faint">{Math.round(c.points)}/{c.max}</span>
                      </span>
                      <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-border">
                        <span
                          className="block h-full rounded-full bg-accent/70"
                          style={{ width: `${c.max > 0 ? (c.points / c.max) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="text-faint">{c.detail}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 text-[11px]">
                  <Link href={`/comparateur-sgi/annuaire/${slugSgi(m.sgi)}`} className="font-semibold text-accent hover:underline">
                    Fiche de la SGI →
                  </Link>
                  {m.sgi.telephone && (
                    <a href={`tel:${m.sgi.telephone.replace(/\s/g, '')}`} className="text-accent hover:underline">Tél. {m.sgi.telephone}</a>
                  )}
                  {m.sgi.siteWeb && (
                    <a href={m.sgi.siteWeb} target="_blank" rel="nofollow noopener" className="text-accent hover:underline">Site ↗</a>
                  )}
                  {m.sgi.ficheBRVM && (
                    <a href={m.sgi.ficheBRVM} target="_blank" rel="nofollow noopener" className="text-accent hover:underline">Fiche BRVM ↗</a>
                  )}
                  {lienDecision(m.frais) && (
                    <a href={lienDecision(m.frais)!} target="_blank" rel="noopener" className="text-accent hover:underline">Barème officiel (PDF) ↗</a>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Reste du classement */}
          {matches.length > 3 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="text-xs text-muted underline-offset-4 hover:text-ivory hover:underline"
              >
                {showAll ? 'Masquer' : `Voir le classement complet (${matches.length} SGI)`}
              </button>
              {showAll && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-2 pr-3 font-mono text-[10px] uppercase tracking-wider text-faint">#</th>
                        <th className="py-2 pr-3 font-mono text-[10px] uppercase tracking-wider text-faint">SGI</th>
                        <th className="py-2 pr-3 text-right font-mono text-[10px] uppercase tracking-wider text-faint">Score</th>
                        <th className="hidden py-2 text-right font-mono text-[10px] uppercase tracking-wider text-faint sm:table-cell">Coût/an estimé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.slice(3).map((m, i) => (
                        <tr key={m.sgi.nom} className="border-b border-border/50 last:border-0">
                          <td className="tabular py-2 pr-3 text-xs text-faint">{i + 4}</td>
                          <td className="py-2 pr-3 text-ivory">
                            {m.sgi.nom}
                            <span className="ml-2 text-[10px] text-faint">{PAYS[m.sgi.pays]?.nom}</span>
                          </td>
                          <td className="tabular py-2 pr-3 text-right font-mono text-xs text-muted">{m.score}</td>
                          <td className="tabular hidden py-2 text-right text-xs text-muted sm:table-cell">
                            {m.coutAnnuel != null ? fmtFcfa(m.coutAnnuel) : 'barème non publié'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {(() => {
            // Les liens gardent le profil : capital et rythme d'ordres suivent.
            const { scenario, plafonne } = scenarioDuProfil(profil);
            const podium = matches.slice(0, 3).map((m) => slugSgi(m.sgi)).join(',');
            return (
              <div className="mt-5 border-t border-border pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={lienAvecScenario('/comparateur-sgi/comparer', scenario, { sgi: podium })}
                    className="inline-flex min-h-[44px] items-center rounded-full bg-accent px-5 text-sm font-semibold text-bg transition hover:brightness-110 active:scale-95"
                  >
                    Comparer ce podium côte à côte →
                  </Link>
                  <Link
                    href={lienAvecScenario('/comparateur-sgi/simuler', scenario)}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-border px-5 text-sm font-semibold text-ivory transition-colors hover:border-accent/40 hover:text-accent"
                  >
                    Détailler mes frais poste par poste
                  </Link>
                  <button
                    type="button"
                    onClick={() => setValide(false)}
                    className="inline-flex min-h-[44px] items-center rounded-full px-3 text-xs text-muted transition-colors hover:text-ivory"
                  >
                    Modifier mes priorités
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex min-h-[44px] items-center rounded-full px-3 text-xs text-muted transition-colors hover:text-ivory"
                  >
                    ↺ Refaire le test
                  </button>
                </div>
                {plafonne && (
                  <p className="mt-2 text-[11px] text-faint">
                    Le comparateur et le simulateur vont jusqu’à {ORDRES_MAX} achats et {ORDRES_MAX} ventes par an : votre rythme y est ramené à ce maximum.
                  </p>
                )}
              </div>
            );
          })()}

          <p className="mt-4 text-[10px] leading-relaxed text-faint">
            Classement indicatif dérivé des barèmes publiés (bornes maximales, prudence) et de votre
            profil déclaré, pas une recommandation d&apos;investissement. Confirmez toujours les
            conditions auprès de la SGI avant d&apos;ouvrir un compte.
          </p>
        </div>
      )}
    </section>
  );
}
