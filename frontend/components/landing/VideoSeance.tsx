import Link from 'next/link';
import type { VideoSeance as Data } from '@/lib/landing/videoSeance';

/**
 * Résumé vidéo de la séance (vertical), produit chaque soir par le worker
 * `video/`.
 *
 * Deux règles de véracité, visibles à l'écran :
 *  - la section porte la date de la séance filmée, jamais celle du jour ;
 *  - si cette date n'est pas la dernière séance connue du site, on le dit, au
 *    lieu de laisser croire que la vidéo est celle d'aujourd'hui.
 *
 * Pas de lecture automatique et aucun script : `<video controls>` suffit, donc
 * rien à gérer côté `prefers-reduced-motion`, et aucun traceur tiers — le
 * fichier est servi depuis notre propre stockage.
 */
export function VideoSeance({
  data,
  dateMarche,
}: {
  data: Data | null;
  /** Dernière séance connue du site (ISO), pour signaler un décalage. */
  dateMarche: string | null;
}) {
  if (!data) return null;

  const enRetard = !!dateMarche && data.seance < dateMarche;
  const md = data.capitaux_fcfa / 1e9;
  const nb = (x: number, d = 2) => x.toFixed(d).replace('.', ',');
  const secondes = Math.round(data.duree_s);

  const chiffres: { k: string; v: string; ton?: string }[] = [
    ...(data.composite
      ? [
          {
            k: 'BRVM Composite',
            v: `${data.composite.variation_pct >= 0 ? '+' : '−'}${nb(Math.abs(data.composite.variation_pct))} %`,
            ton: data.composite.variation_pct >= 0 ? 'text-up' : 'text-down',
          },
        ]
      : []),
    { k: 'Hausses', v: String(data.hausses), ton: 'text-up' },
    { k: 'Baisses', v: String(data.baisses), ton: 'text-down' },
    {
      k: `Capitaux${data.capitaux_estimes ? ' (est.)' : ''}`,
      v: `${data.capitaux_estimes ? '≈ ' : ''}${nb(md)} Md`,
    },
  ];

  return (
    <section aria-labelledby="video-seance-titre" className="mt-8 md:mt-12">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="video-seance-titre" className="overline text-gold-2">
          La séance en {secondes} secondes
        </h2>
        <span className="overline text-faint">
          Séance du {data.date_fr}
          {enRetard && ' · séance précédente'}
        </span>
      </div>

      {/* items-start : sans cela le panneau s'étire à la hauteur de la vidéo
          (461 px mesurés) et reste aux trois quarts vide — un cadre creux se
          lit comme une section cassée. Il épouse maintenant son contenu. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <video
          controls
          preload="metadata"
          playsInline
          poster={data.affiche ?? undefined}
          src={data.url}
          aria-label={`Résumé vidéo de la séance BRVM du ${data.date_fr}`}
          className="mx-auto w-full max-w-[260px] rounded-xl border border-border/60 bg-black"
        />

        <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-surface/60 p-4 sm:p-5">
          <div>
            <p className="text-sm leading-relaxed text-muted">
              Chaque soir, la séance est résumée en vidéo : indice, largeur du marché, capitaux
              échangés, et les sociétés qui ont porté les échanges.{' '}
              <span className="text-ivory">
                Les images et la voix sont composées des mêmes chiffres, lus une seule fois dans nos
                données de séance.
              </span>{' '}
              Aucun chiffre n’est saisi à la main.
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {chiffres.map((c) => (
                <div key={c.k} className="rounded-lg border border-border/50 bg-bg/40 px-3 py-2">
                  <dt className="truncate text-[10.5px] leading-tight text-muted">{c.k}</dt>
                  <dd className={`tabular mt-0.5 text-sm font-bold ${c.ton ?? 'text-ivory'}`}>
                    {c.v}
                  </dd>
                </div>
              ))}
            </dl>

            {/* La vidéo n'a pas de sous-titres : la transcription est le seul
                accès au contenu sans le son, et le seul texte indexable ici. */}
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-muted transition-colors hover:text-ivory">
                Lire la transcription
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-faint">{data.texte}</p>
            </details>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-gold-2 transition-colors hover:text-ivory"
          >
            Voir le détail de la séance <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
