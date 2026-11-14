import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { chargerReactions } from '@/lib/server/reactionsPublications';
import { libelleEvenement } from '@/lib/evenements/libelles';
import { libellePeriode } from '@/lib/evenements/periode';
import { periodeDuTitre, regrouperEvenements, type EvenementBrut } from '@/lib/evenements/regroupement';
import { constatEvenement } from '@/lib/evenements/reaction';
import { carte1080, pctCarte } from '@/lib/evenements/carte';
import { RESERVE_REACTION } from '@/lib/reactionPublication';
import brvmLogos from '@/lib/brvmLogos.json';

export const runtime = 'edge';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Carte de partage 1080 x 1080 d'un événement : société, constat, écart à l'indice sur 5 séances.
 * Lit les tables publiques (market_events, cours) avec la clé anonyme ; 404 si l'événement n'existe pas.
 * Aucune donnée personnelle.
 */
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID.test(id)) return NextResponse.json({ erreur: 'Événement introuvable.' }, { status: 404 });
  const sb = createPublicClient();
  const { data: ev } = await sb
    .from('market_events').select('id, event_date, title, event_type, instrument_code, source_url').eq('id', id).maybeSingle();
  if (!ev) return NextResponse.json({ erreur: 'Événement introuvable.' }, { status: 404 });
  const event = ev as EvenementBrut;

  let code = event.instrument_code;
  if (!code) {
    const { data: p } = await sb.from('market_event_instruments').select('instrument_code').eq('event_id', id).limit(1);
    code = (p?.[0]?.instrument_code as string | undefined) ?? null;
  }
  if (!code) return NextResponse.json({ erreur: 'Aucun titre rattaché à cet événement.' }, { status: 404 });

  // J0 = date de la première pièce de la même publication, comme dans la liste.
  const { data: memes } = await sb
    .from('market_events').select('id, event_date, title, event_type, instrument_code, source_url')
    .eq('instrument_code', code).eq('event_type', event.event_type).order('event_date', { ascending: true }).limit(500);
  const groupe = regrouperEvenements((memes ?? []) as EvenementBrut[]).find((g) => g.pieces.some((p) => p.id === id));
  const j0 = groupe?.date ?? event.event_date;

  const reactions = await chargerReactions(sb, [{ code, date: j0 }], 5).catch(() => null);
  const r = reactions?.get(`${code}|${j0}`);
  const mesuree = !!r && !r.enCours && r.ecartIndicePct != null;
  const ecart = mesuree ? (r!.ecartIndicePct as number) : null;

  const typeLibelle = libelleEvenement(event.event_type);
  const periodeLibelle = libellePeriode(periodeDuTitre(event.title));
  const date = new Date(`${j0}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const url = new URL(req.url);
  const chemin = (brvmLogos as Record<string, string>)[code];
  // next/og ne lit que PNG et JPEG : un logo GIF ou SVG retombe sur les initiales.
  const logo = chemin && /\.(png|jpe?g)$/i.test(chemin) ? `${url.origin}${chemin}` : null;

  return carte1080({
    code,
    contexte: `${typeLibelle}${periodeLibelle ? ` · ${periodeLibelle}` : ''} · ${date}`,
    constat: constatEvenement({
      code, typeLibelle, periodeLibelle, ecartIndicePct: ecart, enCours: !!r && r.enCours,
      seancesObservees: r?.seancesObservees ?? 0, horizon: 5,
    }).replaceAll('−', '-'),
    chiffre: ecart != null ? pctCarte(ecart) : r && r.enCours ? 'en cours' : 'n.d.',
    legende: 'Écart à l’indice BRVM Composite sur 5 séances',
    sens: ecart == null ? 'neutre' : ecart > 0 ? 'hausse' : ecart < 0 ? 'baisse' : 'neutre',
    logo,
    pied: `Source : BRVM. ${RESERVE_REACTION}`,
  });
}
