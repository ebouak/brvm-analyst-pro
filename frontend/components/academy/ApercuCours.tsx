import Link from 'next/link';
import { BookOpen, Calculator, CheckCircle2, Clock, Database, Lock } from 'lucide-react';
import { badgeEnsemble, type Nouveaute } from '@/lib/academy/nouveaute';
import { formatDuree } from '@/lib/academy/capsules';
import BadgeNouveaute from './BadgeNouveaute';

/**
 * Aperçu d'un niveau de l'Academy pour qui ne l'a pas encore acheté
 * (rendu serveur, aucune donnée personnelle). Montre la leçon demandée
 * (titre, sous-titre, résumé, plan des sections) et le sommaire du niveau par
 * modules accordéon ; le contenu des sections, les données réelles et les quiz
 * restent réservés.
 */

export interface LeconApercu {
  titre: string;
  module?: string | null;
  sous_titre?: string | null;
  resume: string;
  duree_min?: number | null;
  quizCount?: number;
  simCount?: number;
  hasRealData?: boolean;
  sections: { titre: string }[];
  /** Badge « Nouveau » / « Mis à jour » (lib/academy/nouveaute.ts). */
  nouveaute?: Nouveaute | null;
}

export default function ApercuCours({
  titre,
  intro,
  lecons,
  indexDemande,
  slug,
  offertes = [],
  invitationCompte = null,
}: {
  titre: string;
  intro: string | null;
  lecons: LeconApercu[];
  indexDemande: number;
  slug: string;
  /** Index des leçons offertes (lib/academy/leconsOffertes.ts), signalées dans le programme. */
  offertes?: number[];
  /** Leçon offerte avec un compte, vue sans session : chemin de retour après inscription. */
  invitationCompte?: string | null;
}) {
  if (lecons.length === 0) return null;
  const i = Math.min(Math.max(indexDemande, 0), lecons.length - 1);
  const l = lecons[i]!;
  const modules = lecons.reduce<{ nom: string; lecons: { n: number; l: LeconApercu }[] }[]>((acc, lecon, n) => {
    const nom = lecon.module ?? 'Programme complet';
    const dernier = acc[acc.length - 1];
    if (dernier && dernier.nom === nom) dernier.lecons.push({ n, l: lecon });
    else acc.push({ nom, lecons: [{ n, l: lecon }] });
    return acc;
  }, []);

  const totalMinutes = lecons.reduce((s, x) => s + (x.duree_min ?? 0), 0);
  const totalSims = lecons.reduce((s, x) => s + (x.simCount ?? 0), 0);
  const totalQuiz = lecons.reduce((s, x) => s + (x.quizCount ?? 0), 0);
  const quizLecon = l.quizCount ?? 0;

  return (
    <section aria-labelledby="apercu-titre" className="mx-auto w-full max-w-4xl space-y-6 px-4 pt-8 sm:px-6">
      {/* En-tête de parcours + capsules récapitulatives */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-ink">{titre}</p>
        <h1 id="apercu-titre" className="mt-1.5 font-display text-2xl font-medium text-ivory sm:text-3xl">
          {l.titre}
        </h1>
        {l.sous_titre && <p className="mt-2 text-base text-muted">{l.sous_titre}</p>}

        {/* Capsules de la leçon demandée */}
        <div className="mt-4 flex flex-wrap gap-2">
          {l.duree_min != null && l.duree_min > 0 && (
            <span className="tabular inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated/60 px-3 py-1 text-xs font-medium text-ivory">
              <Clock aria-hidden className="h-3.5 w-3.5 text-accent-ink" />
              {l.duree_min} min de lecture
            </span>
          )}
          {(l.simCount ?? 0) > 0 && (
            <span className="tabular inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated/60 px-3 py-1 text-xs font-medium text-ivory">
              <Calculator aria-hidden className="h-3.5 w-3.5 text-accent-ink" />
              {l.simCount} simulateur{l.simCount! > 1 ? 's' : ''} interactif{l.simCount! > 1 ? 's' : ''}
            </span>
          )}
          {quizLecon > 0 && (
            <span className="tabular inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated/60 px-3 py-1 text-xs font-medium text-ivory">
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5 text-up" />
              Quiz · {quizLecon} question{quizLecon > 1 ? 's' : ''}
            </span>
          )}
          {l.hasRealData && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated/60 px-3 py-1 text-xs font-medium text-ivory">
              <Database aria-hidden className="h-3.5 w-3.5 text-accent-ink" />
              Données réelles BRVM
            </span>
          )}
        </div>

        <p className="mt-4 leading-relaxed text-ivory/90">{l.resume}</p>
      </div>

      {invitationCompte && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-up/35 bg-up/10 p-5">
          <div className="min-w-0 max-w-xl">
            <p className="text-sm font-semibold text-up">Cette leçon est offerte</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Créez un compte gratuit, sans carte bancaire, pour la lire en entier : tout ce que le programme
              ci-dessous annonce s’ouvre.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href={`/signup?next=${encodeURIComponent(invitationCompte)}`}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition hover:bg-gold-2"
            >
              Créer mon compte gratuit
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(invitationCompte)}`}
              className="rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-ivory transition hover:border-accent/40"
            >
              J’ai déjà un compte
            </Link>
          </div>
        </div>
      )}

      {/* Plan de la leçon demandée */}
      <div className="rounded-2xl border border-border/70 bg-surface/70 p-5">
        <h2 className="text-sm font-semibold text-ivory">Au programme de cette leçon</h2>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {l.sections.map((s, k) => (
            <li key={k} className="flex items-start gap-2 rounded-lg border border-border/50 bg-bg/50 px-3 py-2 text-sm text-muted">
              <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
              <span>{s.titre}</span>
            </li>
          ))}
          {quizLecon > 0 && (
            <li className="flex items-start gap-2 rounded-lg border border-border/50 bg-bg/50 px-3 py-2 text-sm text-muted">
              <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
              <span>
                Quiz de {quizLecon} question{quizLecon > 1 ? 's' : ''}, avec corrigé détaillé
              </span>
            </li>
          )}
        </ol>
      </div>

      {/* Sommaire du cours par modules en accordéon */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg text-ivory">Programme complet du parcours</h2>
          <p className="tabular flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <BookOpen size={13} aria-hidden />
              {modules.length} module{modules.length > 1 ? 's' : ''} · {lecons.length} leçons
            </span>
            {totalMinutes > 0 && <span>· {formatDuree(totalMinutes)}</span>}
            {totalSims > 0 && <span>· {totalSims} simulateurs</span>}
            {totalQuiz > 0 && <span>· {totalQuiz} questions de quiz</span>}
          </p>
        </div>

        {intro && <p className="text-sm leading-relaxed text-muted">{intro}</p>}

        <div className="space-y-2.5">
          {modules.map((m) => {
            const contientActive = m.lecons.some(({ n }) => n === i);
            const b = badgeEnsemble(m.lecons.map(({ l: x }) => x), new Date());
            const modMin = m.lecons.reduce((s, x) => s + (x.l.duree_min ?? 0), 0);
            return (
              <details
                key={m.nom}
                open={contientActive}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ivory">
                    <span>{m.nom}</span>
                    {b && <BadgeNouveaute badge={b} />}
                  </span>
                  <span className="tabular shrink-0 text-xs text-faint">
                    {m.lecons.length} leçon{m.lecons.length > 1 ? 's' : ''}
                    {modMin > 0 ? ` · ${formatDuree(modMin)}` : ''}
                  </span>
                </summary>
                <ul className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
                  {m.lecons.map(({ n, l: lecon }) => {
                    const active = n === i;
                    return (
                      <li key={n}>
                        <Link
                          href={`/formations/academy/${slug}?lecon=${n + 1}`}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition ${
                            active
                              ? 'bg-accent/10 font-medium text-ivory'
                              : 'text-muted hover:bg-elevated/50 hover:text-ivory'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0 truncate">{lecon.titre}</span>
                            {offertes.includes(n) && (
                              <span className="shrink-0 rounded-full bg-up/15 px-2 py-0.5 text-[11px] font-semibold text-up">
                                Offerte
                              </span>
                            )}
                          </span>
                          <span className="tabular shrink-0 text-xs text-faint">
                            {lecon.duree_min ? `${lecon.duree_min} min` : ''}
                            {lecon.quizCount ? ` · ${lecon.quizCount} Q` : ''}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
