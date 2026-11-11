import Link from 'next/link';
import { NB_SOCIETES_COTEES } from '@/lib/universe';
import type { Metadata } from 'next';

/**
 * 404 maison. Sans ce fichier, Next sert sa page par défaut — fond blanc,
 * « This page could not be found », en anglais, sans aucune sortie : un
 * visiteur qui suit un lien périmé n'a plus qu'à fermer l'onglet.
 *
 * On ne propose pas un plan du site : on propose les QUATRE portes qui
 * couvrent l'essentiel des arrivées par lien mort — une valeur, la cote, le
 * brief du jour, l'accueil.
 */
export const metadata: Metadata = {
  title: 'Page introuvable | WESTBOURSE',
  robots: { index: false, follow: true },
};

const PORTES = [
  { href: '/', titre: 'Accueil', detail: 'La séance en cours, la cote, les notes A–F.' },
  { href: '/societes', titre: 'Les sociétés', detail: `Les ${NB_SOCIETES_COTEES} valeurs suivies et leurs fiches.` },
  { href: '/brief', titre: 'Le brief du jour', detail: 'La séance résumée chaque soir.' },
  { href: '/actualites', titre: 'Actualités', detail: "L'actualité BRVM et UEMOA." },
  { href: '/formations', titre: 'Se former', detail: 'Les parcours pour apprendre à investir.' },
  { href: '/pricing', titre: 'Les offres', detail: 'Ce que comprend chaque formule.' },
];

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-5 py-16">
      <h1 className="font-display text-3xl text-ivory md:text-4xl [letter-spacing:-0.035em]">
        Cette page n&apos;existe pas.
      </h1>
      <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-muted">
        Le lien est peut-être périmé, ou l&apos;adresse comporte une faute. Rien n&apos;est perdu —
        voici par où reprendre.
      </p>

      {/* Le paramètre `q` n'existe pas sur /societes : lien, pas de formulaire
          qui ferait croire à une recherche. */}
      <p className="mt-6 text-sm text-muted">
        Vous cherchez une société&nbsp;?{' '}
        <Link href="/societes" className="font-semibold text-accent-ink underline underline-offset-2">
          Parcourir et rechercher parmi les {NB_SOCIETES_COTEES} valeurs
        </Link>
      </p>

      <ul className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-panel border border-border bg-border sm:grid-cols-2">
        {PORTES.map((p) => (
          <li key={p.href} className="bg-surface">
            <Link
              href={p.href}
              className="flex h-full flex-col gap-1 p-4 transition-colors hover:bg-elevated/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
            >
              <span className="font-display text-base leading-tight text-ivory">{p.titre}</span>
              <span className="text-[12px] leading-snug text-muted">{p.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
