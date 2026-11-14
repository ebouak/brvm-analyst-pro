import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { carte1080, pctCarte } from '@/lib/evenements/carte';
import brvmLogos from '@/lib/brvmLogos.json';

export const runtime = 'edge';

/**
 * Carte de partage 1080 x 1080 d'un Dossier valeur : société, dernier cours connu, variation de la séance,
 * position dans la plage 52 semaines quand elle est connue. Données de marché publiques uniquement
 * (aucun contenu du dossier, réservé aux abonnés, aucune donnée personnelle). 404 si la société n'existe pas.
 * Nouvelle route isolée : ne touche ni la page du Dossier ni la route /pdf.
 */
export async function GET(req: Request, props: { params: Promise<{ code: string }> }) {
  const code = (await props.params).code.toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(code)) return NextResponse.json({ erreur: 'Code invalide.' }, { status: 400 });
  const sb = createPublicClient();
  const { data: instr } = await sb.from('brvm_instruments').select('code, designation, secteur').eq('code', code).eq('type', 'action').maybeSingle();
  if (!instr) return NextResponse.json({ erreur: 'Société introuvable.' }, { status: 404 });

  const { data: l } = await sb
    .from('brvm_actions_daily')
    .select('date_marche, cours_jour, variation_pct, cours_haut_52s, cours_bas_52s')
    .eq('code', code).not('cours_jour', 'is', null).order('date_marche', { ascending: false }).limit(1).maybeSingle();

  const cours = (l?.cours_jour as number | null | undefined) ?? null;
  const variation = (l?.variation_pct as number | null | undefined) ?? null;
  const haut = (l?.cours_haut_52s as number | null | undefined) ?? null;
  const bas = (l?.cours_bas_52s as number | null | undefined) ?? null;
  const position = cours != null && haut != null && bas != null && haut > bas ? Math.round(((cours - bas) / (haut - bas)) * 100) : null;
  const date = l?.date_marche
    ? new Date(`${l.date_marche as string}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : null;

  const constat = [
    (instr.designation as string | null) ?? code,
    variation != null ? `Variation de la séance : ${pctCarte(variation)}.` : null,
    position != null ? `Cours à ${position} % de sa plage des 52 dernières semaines.` : null,
  ].filter(Boolean).join(' ');

  const url = new URL(req.url);
  const chemin = (brvmLogos as Record<string, string>)[code];
  const logo = chemin && /\.(png|jpe?g)$/i.test(chemin) ? `${url.origin}${chemin}` : null;

  return carte1080({
    code,
    contexte: `Dossier valeur${instr.secteur ? ` · ${instr.secteur as string}` : ''}`,
    constat,
    chiffre: cours != null ? `${Math.round(cours).toLocaleString('fr-FR').replace(/[   ]/g, ' ')} F` : 'n.d.',
    legende: date ? `Dernier cours connu, séance du ${date}` : 'Aucun cours disponible',
    sens: variation == null ? 'neutre' : variation > 0 ? 'hausse' : variation < 0 ? 'baisse' : 'neutre',
    logo,
    pied: 'Source : BRVM',
  });
}
