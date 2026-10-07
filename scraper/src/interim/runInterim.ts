/**
 * Comptes intermédiaires (T1, S1, T3) — extraction depuis les rapports
 * d'activités publiés, vers income_statements / balance_sheets.
 *
 * La DÉCISION vit dans des modules purs et testés : `periode.ts` (quelle
 * période, quel libellé) et `extraction.ts` (prompt, garde-fous). Ici : lire
 * les publications, le PDF (OCR Mistral en repli si le PDF est scanné),
 * appeler le LLM, écrire.
 *
 * RÈGLES D'ÉCRITURE
 *   - `type_periode` ≠ 'annuel' : un intermédiaire n'écrase JAMAIS un exercice
 *     annuel, et `fundamentals` (clé code, year) n'est PAS touchée.
 *   - La colonne de la période courante est écrite ; la colonne comparative
 *     (même période, année précédente) ne l'est que si la ligne n'existe pas
 *     encore — elle ne remplace jamais les chiffres du rapport d'origine.
 *   - Une période marquée 'verifie' dans provenance_exercice n'est jamais réécrite.
 *   - IDEMPOTENCE : une publication déjà tracée dans provenance_exercice est
 *     sautée ; relancer le job ne rappelle pas le LLM. Une extraction REJETÉE
 *     n'est pas tracée : elle sera retentée au passage suivant.
 *
 * `--mock` : n'appelle ni PDF ni LLM, n'écrit rien ; liste ce qui serait traité.
 */
import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { resolveApiKeyForScraper } from '../hebdo/apiKey.js';
import { FOURNISSEURS_LLM } from '../sante/runSanteLlm.js';
import { codePeriode, typePeriode, type PeriodeInterim } from './periode.js';
import { choisirPublications, lignesInterim, type PubInterim } from './selection.js';
import { lireAvecGemini } from './gemini.js';
import { construireAlias, documentEtranger } from '../publications/emetteur.js';

async function resoudreCleGemini(): Promise<string | null> {
  return resolveApiKeyForScraper('gemini');
}
import {
  promptSysteme,
  promptUtilisateur,
  schemaExtraction,
  verifierExtraction,
  type Extraction,
  type Famille,
} from './extraction.js';

const log = logger.child({ module: 'interim' });

export interface InterimResult {
  candidats: number;
  ecrits: number;
  rejetes: number;
  echecs: number;
}

/** Texte extrait par pdfjs (vide pour un PDF scanné). */
async function texteDuPdf(url: string): Promise<string> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`PDF HTTP ${r.status}`);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await r.arrayBuffer()), useSystemFonts: true }).promise;
  let texte = '';
  for (let i = 1; i <= Math.min(doc.numPages, 12); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    texte += c.items.map((x) => ('str' in x ? x.str : '')).join(' ') + '\n';
  }
  return texte;
}

const pause = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/**
 * OCR Mistral (même voie que l'import annuel), pour les PDF scannés ET pour
 * les PDF mixtes dont le tableau chiffré est une image (lettre des CAC en
 * texte, tableau en image : vu chez PALC et CIEC).
 * Le compte Mistral est sur un palier gratuit qui répond 429 aux appels
 * rapprochés : jusqu'à 4 tentatives espacées de 20, 40 puis 60 s.
 */
async function texteOcr(url: string): Promise<string | null> {
  const cle = await resolveApiKeyForScraper('mistral');
  if (!cle) return null;
  for (let essai = 0; essai < 4; essai++) {
    if (essai > 0) await pause(20_000 * essai);
    const o = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cle}` },
      body: JSON.stringify({ model: 'mistral-ocr-latest', document: { type: 'document_url', document_url: url } }),
      signal: AbortSignal.timeout(90_000),
    });
    if (o.status === 429) continue;
    if (!o.ok) throw new Error(`OCR HTTP ${o.status}`);
    const j = (await o.json()) as { pages?: { markdown?: string }[] };
    return (j.pages ?? []).map((p) => p.markdown ?? '').join('\n');
  }
  throw new Error('OCR HTTP 429 (après 4 tentatives)');
}

function jsonTolerant(brut: string): unknown {
  try {
    return JSON.parse(brut);
  } catch {
    const a = brut.indexOf('{');
    const b = brut.lastIndexOf('}');
    try {
      return a >= 0 && b > a ? JSON.parse(brut.slice(a, b + 1)) : null;
    } catch {
      return null;
    }
  }
}

/** Cascade DeepSeek → Mistral → xAI (liste unique : sante/runSanteLlm.ts). */
async function appelerLlm(systeme: string, utilisateur: string): Promise<{ extraction: Extraction; modele: string } | null> {
  for (const f of FOURNISSEURS_LLM) {
    const cle = await resolveApiKeyForScraper(f.fournisseur);
    if (!cle) continue;
    try {
      const r = await fetch(f.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cle}` },
        body: JSON.stringify({
          model: f.modele,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systeme },
            { role: 'user', content: utilisateur },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!r.ok) {
        log.warn({ fournisseur: f.fournisseur, statut: r.status }, 'fournisseur LLM indisponible');
        continue;
      }
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
      const parse = schemaExtraction.safeParse(jsonTolerant(j.choices?.[0]?.message?.content ?? ''));
      if (parse.success) return { extraction: parse.data, modele: f.modele };
      log.warn({ fournisseur: f.fournisseur }, 'réponse LLM hors schéma');
    } catch (e) {
      log.warn({ fournisseur: f.fournisseur, err: (e as Error).name }, 'appel LLM échoué');
    }
  }
  return null;
}

export async function runInterim({ mock = false, codes = [] as string[] } = {}): Promise<InterimResult> {
  const sb = getSupabase();
  const anneeMin = new Date().getUTCFullYear() - 1;

  let q = sb
    .from('publications')
    .select('id, code, libelle, date_publication, source_url')
    .or('libelle.ilike.*trimestre*,libelle.ilike.*semestre*')
    .gte('date_publication', `${anneeMin}-01-01`);
  if (codes.length) q = q.in('code', codes);
  const { data: pubs, error } = await q;
  if (error) throw new Error(`lecture publications : ${error.message}`);

  // Un document dont le titre nomme une AUTRE société n'est jamais lu pour
  // celle-ci : CFAC portait les trimestres 2024-2025 de Tractafric (2026-10-07).
  const { data: insAlias } = await sb.from('brvm_instruments').select('code, designation').eq('type', 'action');
  const alias = construireAlias((insAlias ?? []) as { code: string; designation: string | null }[]);
  const codesConnus = new Set((insAlias ?? []).map((i) => i.code as string));
  const lisibles = ((pubs ?? []) as PubInterim[]).filter((p) => {
    // Titre OU fichier : un PDF lié par erreur à la mauvaise annonce reste étranger.
    const autre = documentEtranger(p.code, p.libelle, p.source_url, alias, codesConnus);
    if (autre) log.warn({ code: p.code, emetteur: autre, libelle: p.libelle }, "publication d'une autre société — écartée");
    return !autre;
  });
  const cibles = choisirPublications(lisibles, anneeMin);

  // Déjà traitées : une provenance porte l'identifiant de la publication.
  const deja = new Set<string>();
  if (cibles.length) {
    const { data, error: e } = await sb.from('provenance_exercice').select('publication_id').in('publication_id', cibles.map((c) => c.id));
    if (e) throw new Error(`lecture provenance_exercice : ${e.message}`);
    for (const r of data ?? []) deja.add(r.publication_id as string);
  }
  const aTraiter = cibles.filter((c) => !deja.has(c.id));

  const { data: instr } = await sb.from('brvm_instruments').select('code, famille_comptable').eq('type', 'action');
  const famille = new Map((instr ?? []).map((i) => [i.code as string, ((i.famille_comptable as string) ?? 'general') as Famille]));
  // Clé Gemini : GEMINI_API_KEY, sinon table api_keys (provider 'gemini').
  // Absente → la chaîne texte (DeepSeek…) prend tout, comme avant.
  const cleGemini = mock ? null : await resoudreCleGemini();

  let ecrits = 0, rejetes = 0, echecs = 0;
  for (const pub of aTraiter) {
    const etiquette = `${pub.code} ${codePeriode(pub.periode)}`;
    if (mock) {
      log.info({ publication: pub.id }, `[mock] ${etiquette} — ${pub.libelle}`);
      continue;
    }
    try {
      const fam = famille.get(pub.code) ?? 'general';
      const { data: ref } = await sb
        .from('income_statements')
        .select('revenu_total, resultat_net')
        .eq('code', pub.code)
        .eq('type_periode', 'annuel')
        .eq('periode', String(pub.periode.annee - 1))
        .maybeSingle();
      const reference = (ref as { revenu_total: number | null; resultat_net: number | null } | null) ?? null;

      // 1) Gemini lit le PDF TEL QUEL (texte + images des pages) : scans et
      //    tableaux en image compris. 2) Repli : texte pdfjs → DeepSeek…
      //    3) Dernier recours : OCR Mistral (palier gratuit, souvent 429).
      let ocr = false;
      let texte = '';
      let r: Awaited<ReturnType<typeof appelerLlm>> = null;
      if (cleGemini) {
        try {
          const g = await lireAvecGemini(
            pub.source_url,
            promptSysteme(fam),
            `Société BRVM : ${pub.code}. Publication : ${pub.libelle}. Le PDF est joint (il peut être scanné). Réponds uniquement par le JSON demandé.`,
            cleGemini,
          );
          if (g && g.extraction.periodes.length > 0) r = { extraction: g.extraction, modele: `gemini:${g.modele}` };
        } catch (e) {
          log.warn({ etiquette, err: (e as Error).message.slice(0, 120) }, 'Gemini indisponible — repli sur la chaîne texte');
        }
      }
      if (!r) texte = await texteDuPdf(pub.source_url);
      if (!r && texte.trim().length >= 400) {
        r = await appelerLlm(promptSysteme(fam), promptUtilisateur(pub.code, pub.libelle, texte));
      }
      if (!r || r.extraction.periodes.length === 0) {
        const t = await texteOcr(pub.source_url);
        if (t && t.trim().length >= 200) {
          ocr = true;
          texte = t;
          r = await appelerLlm(promptSysteme(fam), promptUtilisateur(pub.code, pub.libelle, texte));
        }
      }
      if (!r) {
        if (texte.trim().length < 200) {
          rejetes++;
          log.warn({ etiquette }, 'texte illisible (ni pdfjs ni OCR)');
        } else {
          echecs++;
          log.error({ etiquette }, 'aucun fournisseur LLM n’a répondu');
        }
        continue;
      }

      const verdict = verifierExtraction(r.extraction, pub.periode, reference);
      if (!verdict.ok) {
        rejetes++;
        log.warn({ etiquette, motifs: verdict.motifs }, 'extraction REJETÉE');
        continue;
      }

      for (const col of r.extraction.periodes) {
        const periode: PeriodeInterim = { annee: col.annee, code: pub.periode.code };
        const cp = codePeriode(periode);
        const comparatif = col.annee !== pub.periode.annee;
        const { data: prov } = await sb.from('provenance_exercice').select('confiance').eq('code', pub.code).eq('periode', cp);
        if ((prov ?? []).some((p) => p.confiance === 'verifie')) continue;
        if (comparatif) {
          const { data: existe } = await sb
            .from('income_statements')
            .select('id')
            .eq('code', pub.code)
            .eq('periode', cp)
            .eq('type_periode', typePeriode(periode.code))
            .maybeSingle();
          if (existe) continue; // jamais écraser le rapport d'origine par un comparatif
        }

        const { income, balance } = lignesInterim(pub.code, periode, col);
        const e1 = await sb.from('income_statements').upsert(income, { onConflict: 'code,periode,type_periode' });
        if (e1.error) throw new Error(`income_statements : ${e1.error.message}`);
        const tables = ['income_statements'];
        if (balance) {
          const e2 = await sb.from('balance_sheets').upsert(balance, { onConflict: 'code,periode,type_periode' });
          if (e2.error) throw new Error(`balance_sheets : ${e2.error.message}`);
          tables.push('balance_sheets');
        }
        const e3 = await sb.from('provenance_exercice').upsert(
          tables.map((table_cible) => ({
            code: pub.code,
            periode: cp,
            table_cible,
            publication_id: pub.id,
            extrait_le: new Date().toISOString(),
            extracteur: `${r.modele}${ocr ? '+ocr-mistral' : ''}${comparatif ? ' (comparatif)' : ''}`,
            confiance: 'extrait',
          })),
          { onConflict: 'code,periode,table_cible' },
        );
        if (e3.error) log.error({ etiquette: `${pub.code} ${cp}`, err: e3.error.message }, 'provenance non écrite');
        ecrits++;
        log.info({ etiquette: `${pub.code} ${cp}`, comparatif }, 'écrit');
      }
    } catch (e) {
      echecs++;
      log.error({ etiquette, err: (e as Error).message.slice(0, 200) }, 'échec');
    }
  }

  log.info({ candidats: aTraiter.length, ecrits, rejetes, echecs, mock }, 'comptes intermédiaires');
  return { candidats: aTraiter.length, ecrits, rejetes, echecs };
}
