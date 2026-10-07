/**
 * Lecture d'un PDF par Google Gemini (API officielle, clé AI Studio) — le PDF
 * est envoyé TEL QUEL (inlineData application/pdf) : texte ET images des
 * pages sont lus en un appel. Résout les deux cas qui bloquaient l'OCR
 * Mistral en palier gratuit : les PDF scannés (SPHC, groupe BOA) et les PDF
 * mixtes dont le tableau chiffré est une image (PALC, CIEC).
 *
 * Banc d'essai du 2026-10-05 (via une passerelle tierce, même consigne) :
 * SGBC S1 2026 lu 4/4 exact, SPHC S1 2026 (scanné) lu de façon cohérente avec
 * son T1. La passerelle a été écartée : ses « modèles » étaient une seule
 * étiquette ; ici on appelle Google directement et on enregistre le NOM DU
 * MODÈLE RENVOYÉ PAR GOOGLE dans la provenance.
 *
 * Le modèle n'est PAS codé en dur : GEMINI_MODEL s'il est posé, sinon le
 * meilleur « flash » stable que GET /v1beta/models déclare au moment de
 * l'appel (les noms se périment sans préavis — leçon du 2026-09-26).
 *
 * Fonctions pures (choisirModeleFlash, corpsRequete, texteReponse) testées
 * dans tests/interim.test.ts.
 */
import { schemaExtraction, type Extraction } from './extraction.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';
/** Limite des données en ligne de l'API (20 Mo par requête), marge comprise. */
const PDF_MAX_OCTETS = 18 * 1024 * 1024;
/**
 * Au-delà, le PDF passe par l'API de fichiers (plafond 2 Go). Avant le
 * 2026-10-07, un PDF trop lourd renvoyait simplement null, que l'appelant
 * prenait pour une lecture vide : les rapports annuels BOA de 49 Mo passaient
 * pour « lus sans valeur » alors qu'ils n'avaient jamais été envoyés.
 */
const FICHIER_MAX_OCTETS = 2 * 1024 * 1024 * 1024;
const UPLOAD = 'https://generativelanguage.googleapis.com/upload/v1beta/files';

export interface ModeleListe {
  name: string;
  supportedGenerationMethods?: string[];
}

/** Version numérique d'un nom de modèle : « models/gemini-3.7-flash » → [3, 7]. */
function version(nom: string): number[] {
  const m = /gemini-(\d+)(?:\.(\d+))?/.exec(nom);
  return m ? [Number(m[1]), Number(m[2] ?? 0)] : [0, 0];
}

/**
 * Le meilleur modèle « flash » STABLE capable de generateContent. Écarte les
 * variantes spécialisées (lite, image, tts, live, audio) et expérimentales
 * (preview, exp) : une extraction de chiffres veut un modèle stable.
 */
export function choisirModeleFlash(modeles: ModeleListe[]): string | null {
  const candidats = modeles
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /gemini-[\d.]+-flash/.test(n))
    .filter((n) => !/lite|image|tts|live|audio|preview|exp|thinking/.test(n));
  candidats.sort((a, b) => {
    const [a1 = 0, a2 = 0] = version(a);
    const [b1 = 0, b2 = 0] = version(b);
    return b1 - a1 || b2 - a2 || a.length - b.length; // à version égale, le nom le plus court (alias stable)
  });
  return candidats[0] ?? null;
}

/** `pdf` : contenu base64 (envoi direct) ou URI d'un fichier déposé (gros PDF). */
export function corpsRequete(systeme: string, consigne: string, pdf: string | { fileUri: string }) {
  const piece = typeof pdf === 'string'
    ? { inlineData: { mimeType: 'application/pdf', data: pdf } }
    : { fileData: { mimeType: 'application/pdf', fileUri: pdf.fileUri } };
  return {
    systemInstruction: { parts: [{ text: systeme }] },
    contents: [
      {
        role: 'user',
        parts: [piece, { text: consigne }],
      },
    ],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  };
}

export interface ReponseGemini {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  modelVersion?: string;
  promptFeedback?: { blockReason?: string };
}

/** Texte de la réponse (hors parties « pensée »), ou null si vide / bloquée. */
export function texteReponse(j: ReponseGemini): string | null {
  const parts = j.candidates?.[0]?.content?.parts ?? [];
  const t = parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  return t.trim() ? t : null;
}

interface FichierGemini { name: string; uri: string; state?: string }

/** Dépose un PDF dans l'API de fichiers (envoi en deux temps) et attend qu'il soit prêt. */
async function deposer(octets: Buffer, nom: string, cle: string): Promise<FichierGemini> {
  const debut = await fetch(UPLOAD, {
    method: 'POST',
    headers: {
      'x-goog-api-key': cle,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(octets.length),
      'X-Goog-Upload-Header-Content-Type': 'application/pdf',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: nom.slice(0, 120) } }),
    signal: AbortSignal.timeout(30_000),
  });
  const urlEnvoi = debut.headers.get('x-goog-upload-url');
  if (!debut.ok || !urlEnvoi) throw new Error(`Gemini dépôt HTTP ${debut.status}`);
  const envoi = await fetch(urlEnvoi, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
    body: octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer,
    signal: AbortSignal.timeout(300_000),
  });
  if (!envoi.ok) throw new Error(`Gemini envoi HTTP ${envoi.status}`);
  let f = ((await envoi.json()) as { file?: FichierGemini }).file;
  if (!f) throw new Error('Gemini envoi : réponse sans fichier');
  for (let i = 0; i < 60 && f.state === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 2_000));
    const g = await fetch(`${API}/${f.name}`, { headers: { 'x-goog-api-key': cle }, signal: AbortSignal.timeout(20_000) });
    f = (await g.json()) as FichierGemini;
  }
  if (f.state && f.state !== 'ACTIVE') throw new Error(`fichier Gemini non exploitable : ${f.state}`);
  return f;
}

let modeleResolu: string | null | undefined;

async function resoudreModele(cle: string): Promise<string | null> {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (modeleResolu !== undefined) return modeleResolu;
  const r = await fetch(`${API}/models?pageSize=200`, {
    headers: { 'x-goog-api-key': cle, 'user-agent': 'westbourse-scraper/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`Gemini /models HTTP ${r.status}`);
  const j = (await r.json()) as { models?: ModeleListe[] };
  modeleResolu = choisirModeleFlash(j.models ?? []);
  return modeleResolu;
}

/**
 * Lit un PDF et renvoie l'extraction validée par le schéma, avec le nom du
 * modèle effectivement servi. null si le PDF est trop lourd ou la réponse
 * vide ; lève sur une erreur HTTP (l'appelant retombe sur la chaîne texte).
 */
/**
 * Envoie un PDF à Gemini et renvoie l'objet JSON de la réponse (non validé)
 * avec le nom du modèle servi. null si le PDF est trop lourd ou la réponse
 * vide ; lève sur une erreur HTTP. Partagé par les intermédiaires et le
 * complément des annuels (scraper/src/annuel/).
 */
export async function jsonDepuisPdf(
  urlPdf: string,
  systeme: string,
  consigne: string,
  cle: string,
): Promise<{ brut: unknown; modele: string } | null> {
  const modele = await resoudreModele(cle);
  if (!modele) throw new Error('aucun modèle Gemini flash disponible');

  const pdf = await fetch(urlPdf, { signal: AbortSignal.timeout(60_000) });
  if (!pdf.ok) throw new Error(`PDF HTTP ${pdf.status}`);
  const octets = Buffer.from(await pdf.arrayBuffer());
  if (octets.length > FICHIER_MAX_OCTETS) return null;
  const gros = octets.length > PDF_MAX_OCTETS;
  const fichier = gros ? await deposer(octets, decodeURIComponent(urlPdf.split('/').pop() ?? 'document.pdf'), cle) : null;

  let j: ReponseGemini;
  try {
    const r = await fetch(`${API}/models/${encodeURIComponent(modele)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': cle, 'content-type': 'application/json', 'user-agent': 'westbourse-scraper/1.0' },
      body: JSON.stringify(corpsRequete(systeme, consigne, fichier ? { fileUri: fichier.uri } : octets.toString('base64'))),
      signal: AbortSignal.timeout(gros ? 300_000 : 180_000),
    });
    if (!r.ok) throw new Error(`Gemini HTTP ${r.status}`);
    j = (await r.json()) as ReponseGemini;
  } finally {
    // Gemini efface seul les fichiers sous 48 h ; on n'attend pas.
    if (fichier) void fetch(`${API}/${fichier.name}`, { method: 'DELETE', headers: { 'x-goog-api-key': cle } }).catch(() => undefined);
  }
  const texte = texteReponse(j);
  if (!texte) return null;
  return { brut: jsonTolerant(texte), modele: j.modelVersion ?? modele };
}

function jsonTolerant(texte: string): unknown {
  try {
    return JSON.parse(texte);
  } catch {
    const a = texte.indexOf('{');
    const b = texte.lastIndexOf('}');
    try {
      return a >= 0 && b > a ? JSON.parse(texte.slice(a, b + 1)) : null;
    } catch {
      return null;
    }
  }
}

export async function lireAvecGemini(
  urlPdf: string,
  systeme: string,
  consigne: string,
  cle: string,
): Promise<{ extraction: Extraction; modele: string } | null> {
  const r = await jsonDepuisPdf(urlPdf, systeme, consigne, cle);
  if (!r) return null;
  const parse = schemaExtraction.safeParse(r.brut);
  if (!parse.success) return null;
  return { extraction: parse.data, modele: r.modele };
}
