import Link from 'next/link';
import { Clock, Lock } from 'lucide-react';

/**
 * Aperçu d'un niveau de l'Academy pour qui ne l'a pas encore acheté
 * (rendu serveur, aucune donnée personnelle). Montre la leçon demandée
 * (titre, sous-titre, résumé, plan des sections) et le sommaire du niveau ;
 * le contenu des sections, les données réelles et les quiz restent réservés.
 */

export interface LeconApercu {
  titre: string;
  module?: string | null;
  sous_titre?: string | null;
  resume: string;
  duree_min?: number | null;
  sections: { titre: string }[];
}

export default function ApercuCours({
  titre,
  intro,
  lecons,
  indexDemande,
  slug,
}: {
  titre: string;
  intro: string | null;
  lecons: LeconApercu[];
  indexDemande: number;
  slug: string;
}) {
  if (lecons.length === 0) return null;
  const i = Math.min(Math.max(indexDemande, 0), lecons.length - 1);
  const l = lecons[i]!;
  const modules = lecons.reduce<{ nom: string; lecons: { n: number; l: LeconApercu }[] }[]>((acc, lecon, n) => {
    const nom = lecon.module ?? 'Leçons';
    const dernier = acc[acc.length - 1];
    if (dernier && dernier.nom === nom) dernier.lecons.push({ n, l: lecon });
    else acc.push({ nom, lecons: [{ n, l: lecon }] });
    return acc;
  }, []);

  return (
    <section aria-labelledby="apercu-titre" className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6">
      <p className="text-sm text-muted">{titre}</p>
      <h1 id="apercu-titre" className="mt-1 font-display text-2xl text-ivory sm:text-3xl">
        {l.titre}
      </h1>
      {l.sous_titre && <p className="mt-2 text-base text-muted">{l.sous_titre}</p>}
      {l.duree_min != null && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted">
          <Clock aria-hidden className="h-4 w-4" />
          {l.duree_min} min de lecture
        </p>
      )}
      <p className="mt-4 leading-relaxed text-ivory/90">{l.resume}</p>

      <div className="mt-6 rounded-xl border border-border/60 bg-surface/60 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-ivory">Au programme de cette leçon</h2>
        <ol className="mt-3 space-y-2">
          {l.sections.map((s, k) => (
            <li key={k} className="flex items-start gap-2 text-sm text-muted">
              <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{s.titre}</span>
            </li>
          ))}
          <li className="flex items-start gap-2 text-sm text-muted">
            <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Quiz de cinq questions, avec corrigé</span>
          </li>
        </ol>
      </div>

      <details className="mt-6 rounded-xl border border-border/60 p-4 sm:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-ivory">
          Le sommaire du niveau : {lecons.length} leçons
        </summary>
        {intro && <p className="mt-3 text-sm leading-relaxed text-muted">{intro}</p>}
        <div className="mt-4 space-y-4">
          {modules.map((m) => (
            <div key={m.nom}>
              <h3 className="text-xs font-semibold text-ivory">{m.nom}</h3>
              <ul className="mt-2 space-y-1.5">
                {m.lecons.map(({ n, l: lecon }) => (
                  <li key={n}>
                    <Link
                      href={`/formations/academy/${slug}?lecon=${n + 1}`}
                      aria-current={n === i ? 'page' : undefined}
                      className={`text-sm ${n === i ? 'text-ivory' : 'text-muted hover:text-ivory'}`}
                    >
                      {lecon.titre}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
