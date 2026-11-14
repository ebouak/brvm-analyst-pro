import Link from 'next/link';
import { ExternalLink, ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fmtDateCourte, fmtPctSigne } from '@/lib/format';
import { libelleEvenement } from '@/lib/evenements/libelles';
import { libellePeriode } from '@/lib/evenements/periode';
import { periodeDuTitre, regrouperEvenements, type EvenementBrut } from '@/lib/evenements/regroupement';
import { affichageReaction, cleReaction, constatEvenement, medianeReactions } from '@/lib/evenements/reaction';
import { fenetreCourbe, tableauHorizons } from '@/lib/evenements/courbe';
import { chargerSeriesEvenement, lireEvenements, reactionsCachees } from '@/lib/server/evenementsDonnees';
import { RESERVE_REACTION } from '@/lib/reactionPublication';
import { detachementsDansFenetre, eventStudy } from '@/lib/eventStudy';
import CourbeEvenement from '@/components/evenements/CourbeEvenement';
import ReactionCellule from '@/components/evenements/ReactionCellule';
import LogoSociete from '@/components/evenements/LogoSociete';

export const dynamic = 'force-dynamic';

const FENETRE = 5;

const couleurSigne = (v: number | null) => (v == null ? 'text-muted' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-muted');
const pct = (v: number | null) => (v == null ? '—' : fmtPctSigne(v, 2));

export default async function EventReportPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createClient();

  const { data: ev } = await supabase
    .from('market_events')
    .select('id, event_date, title, event_type, instrument_code, source_url, summary')
    .eq('id', params.id)
    .maybeSingle();

  if (!ev) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <Link href="/dashboard/reports/events" className="text-xs text-accent-ink">← Événements</Link>
        <div className="mt-4 rounded-card border border-border bg-surface p-8 text-center text-sm text-muted">Événement introuvable.</div>
      </div>
    );
  }
  const event = ev as EvenementBrut & { summary: string | null };

  const { data: pivot } = await supabase.from('market_event_instruments').select('instrument_code').eq('event_id', event.id);
  const codes = [...new Set([...(event.instrument_code ? [event.instrument_code] : []), ...((pivot ?? []) as { instrument_code: string }[]).map((p) => p.instrument_code)])];
  const code = codes[0] ?? null;
  const autres = codes.slice(1);

  // Autres documents de la même publication : J0 = date de la première pièce, comme dans la liste.
  const periode = periodeDuTitre(event.title);
  const memeType = code ? await lireEvenements(supabase, { type: event.event_type, code }) : [];
  const groupes = regrouperEvenements(memeType);
  const groupe = groupes.find((g) => g.pieces.some((p) => p.id === event.id)) ?? null;
  const pieces = groupe?.pieces ?? [];
  const j0Date = groupe?.date ?? event.event_date;

  // Historique : les publications du MÊME type de cette société, hors celle-ci.
  const historique = groupes.filter((g) => g !== groupe);

  // Une seule demande groupée (mise en cache) : la publication, les autres titres rattachés, l'historique.
  const demandes = [
    ...(code ? [{ code, date: j0Date }] : []),
    ...autres.map((c) => ({ code: c, date: j0Date })),
    ...(code ? historique.map((h) => ({ code, date: h.date })) : []),
  ];
  const reactions = await reactionsCachees(demandes);
  const reaction = code && reactions ? reactions[cleReaction(code, j0Date)] : undefined;

  let courbe = null;
  let horizons: ReturnType<typeof tableauHorizons> = [];
  let detachements: string[] = [];
  let seancesObservees = 0;
  if (code) {
    try {
      const series = await chargerSeriesEvenement(supabase, code, j0Date);
      courbe = fenetreCourbe(series.titre, series.indice, j0Date);
      horizons = tableauHorizons(series.titre, series.indice, j0Date);
      const etude = eventStudy(series.titre, series.titre.map(() => null), series.indice, j0Date, FENETRE);
      seancesObservees = etude.seancesObservees;
      const { data: divs } = await supabase.from('dividends').select('ex_date').eq('code', code).gt('montant', 0);
      detachements = detachementsDansFenetre(
        series.titre,
        etude,
        ((divs ?? []) as { ex_date: string | null }[]).map((d) => d.ex_date).filter((d): d is string => !!d),
      );
    } catch (e) {
      console.error('[evenements] séries indisponibles', e);
    }
  }

  const typeLibelle = libelleEvenement(event.event_type);
  const periodeLibelle = libellePeriode(periode);
  const constat = code
    ? constatEvenement({
        code, typeLibelle, periodeLibelle,
        ecartIndicePct: reaction?.ecartIndicePct ?? null,
        enCours: reaction ? reaction.enCours : false,
        seancesObservees: reaction?.seancesObservees ?? seancesObservees,
        horizon: FENETRE,
      })
    : event.title;
  const grand = affichageReaction(reaction);
  const sourcePrincipale = groupe?.pieces.find((p) => p.id === event.id)?.source_url ?? event.source_url ?? null;
  const histoLignes = historique.map((h) => ({ h, r: reactions?.[cleReaction(code ?? '', h.date)] }));
  const med = medianeReactions(histoLignes.flatMap(({ r }) => (r ? [{ ecartIndicePct: r.ecartIndicePct, enCours: r.enCours }] : [])));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-6">
      <Link href="/dashboard/reports/events" className="text-xs text-accent-ink">← Événements</Link>

      <article className="space-y-6 rounded-card border border-border bg-surface p-5 md:p-8">
        <header className="space-y-2">
          <p className="flex items-center gap-2 text-xs text-muted">
            {code && <LogoSociete code={code} taille={22} />}
            <span>{code ?? 'BRVM'} · {typeLibelle}{periodeLibelle ? ` · ${periodeLibelle}` : ''} · publié le {fmtDateCourte(j0Date)}</span>
          </p>
          <h1 className="font-display text-xl leading-snug text-ivory md:text-2xl">{constat}</h1>
          <p className="text-sm text-muted">{event.title}</p>
        </header>

        {code && (
          <section aria-label="Écart à l’indice" className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              {grand.genre === 'mesuree' ? (
                <p className={`tabular font-display text-5xl leading-none md:text-6xl ${couleurSigne(grand.valeur)}`}>{grand.texte}</p>
              ) : (
                <p className="font-display text-3xl leading-none text-muted md:text-4xl">{grand.genre === 'en_cours' ? 'en cours' : 'non disponible'}</p>
              )}
              <p className="mt-2 text-sm text-muted">Écart du titre au BRVM Composite sur {FENETRE} séances</p>
            </div>
            {grand.genre === 'en_cours' && (
              <p className="max-w-sm text-xs text-warn">
                La fenêtre n&apos;est pas close ({reaction?.seancesObservees ?? seancesObservees} séance{(reaction?.seancesObservees ?? seancesObservees) > 1 ? 's' : ''} sur {FENETRE}) : la mesure sera définitive après {FENETRE} séances cotées.
              </p>
            )}
          </section>
        )}

        {event.summary && <p className="text-sm text-muted">{event.summary}</p>}

        {code && courbe && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ivory">Cours de {code} de J−10 à J+10</h2>
            <CourbeEvenement courbe={courbe} code={code} />
          </section>
        )}
        {code && !courbe && (
          <p className="text-sm text-muted">Aucune séance cotée à partir de la date de publication : la courbe n&apos;est pas disponible.</p>
        )}

        {code && horizons.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ivory">Réaction par horizon</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs text-muted">
                  <tr>
                    <th className="py-1.5 pr-3 text-left font-medium">Horizon</th>
                    <th className="px-3 py-1.5 text-right font-medium">{code}</th>
                    <th className="px-3 py-1.5 text-right font-medium">BRVM Composite</th>
                    <th className="py-1.5 pl-3 text-right font-medium">Écart</th>
                  </tr>
                </thead>
                <tbody>
                  {horizons.map((l) => (
                    <tr key={l.horizon} className="border-b border-border/40">
                      <td className="tabular py-1.5 pr-3">J+{l.horizon}</td>
                      <td className={`tabular px-3 py-1.5 text-right ${couleurSigne(l.titre)}`}>{l.titre == null ? 'non atteint' : pct(l.titre)}</td>
                      <td className={`tabular px-3 py-1.5 text-right ${couleurSigne(l.indice)}`}>{l.titre == null ? '—' : pct(l.indice)}</td>
                      <td className={`tabular py-1.5 pl-3 text-right ${couleurSigne(l.ecart)}`}>{l.titre == null ? '—' : l.ecart == null ? 'non disponible' : pct(l.ecart)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {detachements.length > 0 && (
          <p className="text-xs text-warn">
            Dividende détaché le {detachements.map(fmtDateCourte).join(' et le ')}, dans la fenêtre : les cours ne sont pas
            ajustés du dividende, la baisse mécanique du détachement pèse sur la mesure.
          </p>
        )}

        {autres.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ivory">Autres titres rattachés</h2>
            <ul className="space-y-1.5 text-sm">
              {autres.map((c) => (
                <li key={c} className="flex items-center gap-3">
                  <LogoSociete code={c} taille={20} />
                  <span className="tabular w-14 text-ivory">{c}</span>
                  <ReactionCellule reaction={reactions?.[cleReaction(c, j0Date)]} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ivory">Source officielle</h2>
          {pieces.length > 1 ? (
            <ul className="space-y-1 text-sm">
              {pieces.map((p) => (
                <li key={p.id} className="flex flex-wrap gap-x-2">
                  <span className="tabular text-muted">{fmtDateCourte(p.date)}</span>
                  {p.source_url
                    ? <a href={p.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-ink underline">{p.titre}<ExternalLink aria-hidden className="h-3 w-3" /></a>
                    : <span>{p.titre}</span>}
                </li>
              ))}
            </ul>
          ) : sourcePrincipale ? (
            <a href={sourcePrincipale} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-accent-ink underline">
              Document publié<ExternalLink aria-hidden className="h-3.5 w-3.5" />
            </a>
          ) : (
            <p className="text-sm text-muted">Aucun lien de publication enregistré pour cet événement.</p>
          )}
        </section>

        {code && (
          <section>
            <h2 className="mb-1 text-sm font-semibold text-ivory">Historique : réaction du titre à ses publications du même type</h2>
            {historique.length === 0 ? (
              <p className="text-sm text-muted">Aucune autre publication de type « {typeLibelle.toLowerCase()} » enregistrée pour {code}.</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted">
                  {med.mediane != null
                    ? `Médiane des ${med.nMesurees} réactions mesurées : ${fmtPctSigne(med.mediane, 2)} d’écart à l’indice.`
                    : `Médiane non calculée : moins de 3 réactions mesurées (${med.nMesurees}).`}
                </p>
                <ul className="divide-y divide-border/40 text-sm">
                  {histoLignes.slice(0, 15).map(({ h, r }) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="min-w-0">
                        <span className="tabular mr-2 text-muted">{fmtDateCourte(h.date)}</span>
                        <Link href={`/dashboard/reports/events/${h.id}`} className="hover:text-accent-ink">{libellePeriode(h.periode) ?? h.titre}</Link>
                      </span>
                      <ReactionCellule reaction={r} />
                    </li>
                  ))}
                </ul>
                {historique.length > 15 && <p className="mt-1 text-xs text-muted">{historique.length - 15} publications plus anciennes non listées.</p>}
              </>
            )}
          </section>
        )}

        <footer className="space-y-2 border-t border-border pt-4 text-xs text-muted">
          <p>
            Écart au BRVM Composite = rendement du titre moins rendement de l&apos;indice sur la fenêtre qui suit la publication. {RESERVE_REACTION}
          </p>
          {code && (
            <a href={`/api/evenements/${event.id}/carte`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-accent-ink underline underline-offset-2">
              <ImageIcon aria-hidden className="h-3.5 w-3.5" />Carte à partager (image 1080 × 1080)
            </a>
          )}
        </footer>
      </article>
    </div>
  );
}
