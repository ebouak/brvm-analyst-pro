'use client';

import { useMemo, useState } from 'react';
import { PAYS, type Sgi } from '@/lib/sgi-frais/directory';
import type { SgiFrais } from '@/lib/sgi-frais/types';
import { CONFIANCE_LABEL, CONFIANCE_BADGE_CLASS } from '@/lib/sgi-frais/types';
import { scorerSgi, type ProfilInvestisseur, type SgiMatch } from '@/lib/sgi-frais/moteur';

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

const MEDALS = ['🥇', '🥈', '🥉'];

const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

export default function SgiMatchmaker({ directory, frais }: { directory: Sgi[]; frais: SgiFrais[] }) {
  const [step, setStep] = useState(0);
  const [pays, setPays] = useState<string | null>(null);
  const [capital, setCapital] = useState<number | null>(null);
  const [ordres, setOrdres] = useState<number | null>(null);
  const [autonomie, setAutonomie] = useState<ProfilInvestisseur['autonomie'] | null>(null);
  const [priorite, setPriorite] = useState<ProfilInvestisseur['priorite'] | null>(null);
  const [showAll, setShowAll] = useState(false);

  const profil: ProfilInvestisseur | null =
    pays && capital != null && ordres != null && autonomie && priorite
      ? { pays, capital, ordresParAn: ordres, autonomie, priorite }
      : null;

  const matches: SgiMatch[] = useMemo(
    () => (profil ? scorerSgi(directory, frais, profil) : []),
    [profil, directory, frais],
  );

  const reset = () => {
    setStep(0); setPays(null); setCapital(null); setOrdres(null);
    setAutonomie(null); setPriorite(null); setShowAll(false);
  };

  const QUESTIONS: { titre: string; contenu: React.ReactNode }[] = [
    {
      titre: 'Où résidez-vous ?',
      contenu: (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PAYS) as (keyof typeof PAYS)[]).map((code) => (
            <button
              key={code} type="button"
              onClick={() => { setPays(code); setStep(1); }}
              className="rounded-full border border-border bg-surface/40 px-4 py-2.5 text-sm text-ivory transition-all hover:border-accent/50 hover:bg-accent/10 active:scale-95"
            >
              {PAYS[code].nom}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setPays('DIASPORA'); setStep(1); }}
            className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent transition-all hover:bg-accent/20 active:scale-95"
          >
            🌍 Diaspora (hors UEMOA)
          </button>
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
            💻 En ligne, en autonomie
          </button>
          <button
            type="button"
            onClick={() => { setAutonomie('accompagne'); setStep(4); }}
            className="rounded-full border border-border bg-surface/40 px-4 py-2.5 text-sm text-ivory transition-all hover:border-accent/50 hover:bg-accent/10 active:scale-95"
          >
            🤝 Accompagné par un conseiller
          </button>
        </div>
      ),
    },
    {
      titre: 'Votre priorité n°1 ?',
      contenu: (
        <div className="flex flex-wrap gap-2">
          {([
            ['cout', '💰 Les frais les plus bas'],
            ['solidite', '🏛 Un adossement bancaire solide'],
            ['proximite', '📍 La proximité géographique'],
            ['equilibre', '⚖️ Un bon équilibre de tout'],
          ] as const).map(([val, label]) => (
            <button
              key={val} type="button"
              onClick={() => { setPriorite(val); setStep(5); }}
              className="rounded-full border border-border bg-surface/40 px-4 py-2.5 text-sm text-ivory transition-all hover:border-accent/50 hover:bg-accent/10 active:scale-95"
            >
              {label}
            </button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <section id="moteur-sgi" className="scroll-mt-24 rounded-panel border border-accent/25 bg-accent/[0.04] p-6 md:p-8">
      <p className="overline mb-2 text-gold-2">Étape 1 · Moteur de choix — exclusif</p>
      <h3 className="mb-1 font-display text-2xl text-ivory [letter-spacing:-0.03em]">
        Quelle SGI est faite pour vous ?
      </h3>
      <p className="mb-6 max-w-[62ch] text-sm leading-relaxed text-muted">
        5 questions, et le moteur classe les {directory.length} SGI selon VOTRE profil — sur la base
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
                <h4 className="font-display text-lg leading-tight text-ivory">{m.sgi.nom}</h4>
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
                  <p className="mt-2 text-[11px] text-warn">⚠ Capital sous le dépôt minimum exigé</p>
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
                  {m.sgi.telephone && (
                    <a href={`tel:${m.sgi.telephone.replace(/\s/g, '')}`} className="text-accent hover:underline">📞 {m.sgi.telephone}</a>
                  )}
                  {m.sgi.siteWeb && (
                    <a href={m.sgi.siteWeb} target="_blank" rel="nofollow noopener" className="text-accent hover:underline">Site ↗</a>
                  )}
                  {m.sgi.ficheBRVM && (
                    <a href={m.sgi.ficheBRVM} target="_blank" rel="nofollow noopener" className="text-accent hover:underline">Fiche BRVM ↗</a>
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

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <a
              href="#calculateur-cout"
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-obsidian shadow-gold-sm transition hover:bg-gold-2"
            >
              Étape 2 : chiffrer précisément avec le calculateur →
            </a>
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-border px-4 py-2 text-xs text-muted transition-colors hover:text-ivory"
            >
              ↺ Refaire le test
            </button>
          </div>

          <p className="mt-4 text-[10px] leading-relaxed text-faint">
            Classement indicatif dérivé des barèmes publiés (bornes maximales, prudence) et de votre
            profil déclaré — pas une recommandation d&apos;investissement. Confirmez toujours les
            conditions auprès de la SGI avant d&apos;ouvrir un compte.
          </p>
        </div>
      )}
    </section>
  );
}
