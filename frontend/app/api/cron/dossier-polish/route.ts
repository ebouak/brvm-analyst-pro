// GET /api/cron/dossier-polish?code=NEIC
//
// Polit la prose du dossier valeur d'UNE société et l'enregistre dans
// dossier_narratifs — après validation stricte (liste blanche de chiffres,
// aucune affirmation causale, mêmes titres). Sans ?code : renvoie la liste des
// codes à traiter, pour que l'appelant (workflow GitHub) boucle dessus. Un code
// par appel, délibérément : 48 sociétés × 5-15 s de modèle dépassent la durée
// d'une fonction, et un lot qui échoue à mi-course laisserait la moitié des
// dossiers sans prose sans que le journal le dise.
//
// Auth : bearer CRON_SECRET (convention Vercel Cron). PAS de secret en query
// string — il finirait dans les journaux d'accès.
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getServiceClient } from '@/lib/billing/serviceClient';
import { resolveApiKey } from '@/lib/server/apiKeys';
import { buildDossier } from '@/lib/dossier/build';
import { construireNarratif } from '@/lib/dossier/narratif';
import { construireSquelette, validerProse, type SectionProse, type Squelette } from '@/lib/dossier/prose';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function autorise(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secret || !bearer) return false;
  const a = Buffer.from(secret, 'utf8');
  const b = Buffer.from(bearer, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

const ORDRE = [
  { provider: 'deepseek' as const, url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  { provider: 'mistral' as const, url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' },
];

/**
 * Même contrat que scraper/src/hebdo/polish.ts : reformuler, sans rien
 * ajouter. Ici la liste blanche est presque vide par construction — la prose
 * du dossier ne porte pas de chiffre — donc la consigne est plus simple encore :
 * aucun nombre, sauf ceux déjà présents.
 */
async function polir(sq: Squelette): Promise<{ sections: SectionProse[]; provider: string } | null> {
  const brut = sq.sections.map((s) => `## ${s.titre}\n${s.texte}`).join('\n\n');
  const prompt =
    `Reformule ce commentaire d'analyse boursière en français, fluide et professionnel, pour un porteur de titres qui débute.\n` +
    `RÈGLES ABSOLUES :\n` +
    `- N'ajoute AUCUN fait, AUCUNE prévision, AUCUN conseil.\n` +
    `- N'écris AUCUN nombre, à l'exception de ceux déjà présents dans le texte (${sq.chiffres.join(', ') || 'aucun'}). Les chiffres sont dans les panneaux du rapport, pas dans ce texte.\n` +
    `- N'affirme JAMAIS qu'un fait explique un mouvement de cours (pas de « à cause de », « en raison de », « suite à », « grâce à », « porté par », « dû à »).\n` +
    `- Conserve exactement les titres de section (lignes commençant par ##), dans le même ordre.\n` +
    `- Phrases courtes. Aucun jargon non expliqué.\n\n${brut}`;

  for (const p of ORDRE) {
    const key = await resolveApiKey(p.provider);
    if (!key) continue;
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: p.model, messages: [{ role: 'user', content: prompt }], temperature: 0.3 }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const out = json.choices?.[0]?.message?.content ?? '';
      if (!out) continue;

      const blocs = out.split(/^##\s+/m).map((b) => b.trim()).filter(Boolean);
      const candidate = blocs.map((b) => {
        const nl = b.indexOf('\n');
        return { titre: nl >= 0 ? b.slice(0, nl).trim() : b.trim(), texte: nl >= 0 ? b.slice(nl + 1).trim() : '' };
      });
      const valides = validerProse(candidate, sq);
      if (!valides) continue; // rejeté : chiffre étranger, causalité, ou structure — on tente le suivant
      return { sections: valides, provider: p.provider };
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(req: Request) {
  if (!autorise(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });

  const admin = getServiceClient();
  const code = new URL(req.url).searchParams.get('code')?.toUpperCase().trim();

  if (!code) {
    /* Les valeurs cotées à la DERNIÈRE SÉANCE — pas `brvm_instruments.type`,
       qui n'étiquette « action » que 22 lignes sur 47 valeurs réellement
       cotées. Une liste fausse ici priverait la moitié des dossiers de prose
       en silence. */
    const { data: derniere } = await admin
      .from('brvm_actions_daily').select('date_marche').order('date_marche', { ascending: false }).limit(1).maybeSingle();
    if (!derniere?.date_marche) return NextResponse.json({ codes: [] });
    const { data } = await admin
      .from('brvm_actions_daily').select('code').eq('date_marche', derniere.date_marche).order('code');
    const codes = Array.from(new Set((data ?? []).map((r: { code: string }) => r.code)));
    return NextResponse.json({ date_marche: derniere.date_marche, codes });
  }

  const dossier = await buildDossier(admin, code);
  if (!dossier) return NextResponse.json({ code, error: 'Instrument inconnu.' }, { status: 404 });

  const sq = construireSquelette(dossier, construireNarratif(dossier));
  const genere_le = new Date().toISOString().slice(0, 10);

  /* Déjà à jour pour ce squelette ? On ne repaie pas le modèle pour rien. */
  const { data: existante } = await admin
    .from('dossier_narratifs')
    .select('genere_le, empreinte')
    .eq('code', code)
    .order('genere_le', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existante?.empreinte === sq.empreinte) {
    return NextResponse.json({ code, statut: 'inchangé', genere_le: existante.genere_le });
  }

  const poli = await polir(sq);
  if (!poli) {
    /* Rien n'est écrit : la page rend le squelette, ce qui est exact. */
    return NextResponse.json({ code, statut: 'squelette', raison: 'aucune sortie de modèle acceptée' });
  }

  const { error } = await admin.from('dossier_narratifs').upsert(
    { code, genere_le, sections: poli.sections, empreinte: sq.empreinte, chiffres: sq.chiffres, provider: poli.provider },
    { onConflict: 'code,genere_le' },
  );
  if (error) return NextResponse.json({ code, error: error.message }, { status: 500 });

  return NextResponse.json({ code, statut: 'polie', provider: poli.provider, genere_le });
}
