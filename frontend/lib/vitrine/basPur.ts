/**
 * Calculs purs du bas de la page d'accueil (PR 3, spec 2026-11-12 §3.12 à §3.15) :
 * provenance, exemples de canaux, prix des offres, visibilité du bandeau flottant.
 * Aucun accès réseau ni base : tout est testé dans basPur.test.ts.
 */
import { lireCommande, rendreCommande } from '@/lib/whatsapp/commandes';
import { fmtNumber } from '@/lib/format';
import { pctTexte } from './seance';

// ── Provenance ─────────────────────────────────────────────────────────

/** « 17:04 UTC » et « 11/11/2026 » d'un horodatage ISO, ou null s'il est illisible. */
export function horodatageUtc(iso: string | null): { heure: string; date: string } | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    heure: `${p(t.getUTCHours())}:${p(t.getUTCMinutes())} UTC`,
    date: `${p(t.getUTCDate())}/${p(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}`,
  };
}

/** « il y a 12 min », « il y a 3 h », « il y a 2 jours » ; jamais une précision qu'on n'a pas. */
export function depuis(minutes: number | null): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes < 60) return `il y a ${Math.round(minutes)} min`;
  const h = Math.round(minutes / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} jours`;
}

// ── WhatsApp : échange produit par le vrai code des commandes ──────────

export interface LigneSeance { code: string; cours_jour: number | null; variation_pct: number | null; volume: number | null; valeur_echangee: number | null }
export interface EchangeWhatsapp { question: string; reponse: string[] }

/* Pictogrammes retirés à l'affichage (la charte n'en admet aucun sur le site). */
const PICTO = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu;

/**
 * Ce que l'abonné lit, débarrassé du balisage WhatsApp (*gras*, _italique_), des
 * pictogrammes, des liens et du pied d'incitation. La mention « pas un conseil »
 * est gardée : elle fait partie de la réponse réelle.
 */
export function lignesReponse(texte: string): string[] {
  const lignes = texte.split('\n');
  const fin = lignes.findIndex((l) => l.includes('Information de marché'));
  const corps = fin >= 0 ? lignes.slice(0, fin + 1) : lignes;
  return corps
    .map((l) => l.replace(PICTO, '').replace(/[*_]/g, '').replace(/\s{2,}/g, ' ').trim())
    .filter((l) => l && !/https?:\/\//.test(l) && !/^Tapez aussi/.test(l));
}

/**
 * Deux échanges d'exemple (COURS d'une valeur, PALMARES), mis en forme par
 * `rendreCommande` à partir des lignes de la séance, avec la même structure que
 * les retours des outils `cours_valeur` et `palmares_seance`. null sans séance.
 */
export function exemplesWhatsapp(
  lignes: LigneSeance[],
  seance: string | null,
  code: string | null,
  noms: Record<string, string | null>,
): EchangeWhatsapp[] {
  if (!seance || lignes.length === 0) return [];
  const out: EchangeWhatsapp[] = [];
  const cible = lignes.find((l) => l.code === code) ?? null;
  if (cible) {
    const question = `COURS ${cible.code}`;
    const cmd = lireCommande(question);
    if (cmd) {
      const res = {
        code: cible.code, societe: noms[cible.code] ?? null, seance,
        cours: cible.cours_jour, variation_pct: cible.variation_pct, volume: cible.volume, valeur_echangee: cible.valeur_echangee,
      };
      out.push({ question, reponse: lignesReponse(rendreCommande(cmd, res, {})) });
    }
  }
  const avecVar = lignes.filter((l) => l.variation_pct != null);
  const cmdP = lireCommande('PALMARES');
  if (cmdP && avecVar.length > 0) {
    const classement = [...avecVar].sort((a, b) => Number(b.variation_pct) - Number(a.variation_pct)).slice(0, 5)
      .map((l) => ({ code: l.code, cours: l.cours_jour, variation_pct: l.variation_pct, volume: l.volume }));
    const res = { seance, critere: 'plus fortes hausses', valeurs_cotees: avecVar.length, classement };
    out.push({ question: 'PALMARES', reponse: lignesReponse(rendreCommande(cmdP, res, {})) });
  }
  return out;
}

// ── Telegram : le brief, bulle par bulle ───────────────────────────────

/**
 * Lignes de chiffres du brief publié (scraper/src/brief/compose.ts) : sans le
 * titre, sans les titres d'actualité (texte tiers), sans le lien final.
 */
export function lignesBrief(contenu: string, max = 5): string[] {
  return contenu
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^BRVM\s+[—-]\s+Note de conjoncture/i.test(l) && !l.startsWith('·') && !/^Note complète/i.test(l) && !/https?:\/\//.test(l))
    .slice(0, max);
}

export interface FaitsSeance {
  indice: number | null;
  variation: number | null;
  hausses: number;
  baisses: number;
  stables: number;
  meilleure: { code: string; variation: number } | null;
  pire: { code: string; variation: number } | null;
  capitaux: number | null;
}

/** Repli sans brief publié : lignes factuelles composées depuis la séance, sans adjectif. */
export function lignesSeance(f: FaitsSeance): string[] {
  const l: string[] = [];
  if (f.indice != null) l.push(`BRVM Composite : ${fmtNumber(f.indice, 2)} points${f.variation != null ? ` (${pctTexte(f.variation)})` : ''}.`);
  if (f.hausses + f.baisses + f.stables > 0) l.push(`${f.hausses} en hausse, ${f.baisses} en baisse, ${f.stables} sans changement.`);
  if (f.meilleure) l.push(`${f.meilleure.code}, plus forte hausse : ${pctTexte(f.meilleure.variation)}.`);
  if (f.pire) l.push(`${f.pire.code}, plus forte baisse : ${pctTexte(f.pire.variation)}.`);
  if (f.capitaux != null && f.capitaux > 0) l.push(`Capitaux échangés : ${montantCourt(f.capitaux)} FCFA.`);
  return l;
}

/** 2 550 000 000 → « 2,55 Md » ; 12 400 000 → « 12,40 M » (charte §7, deux décimales). */
export function montantCourt(v: number): string {
  if (Math.abs(v) >= 1e9) return `${fmtNumber(v / 1e9, 2)} Md`;
  if (Math.abs(v) >= 1e6) return `${fmtNumber(v / 1e6, 2)} M`;
  return fmtNumber(v, 0);
}

// ── Offres ─────────────────────────────────────────────────────────────

export interface PlanPrix { code: string; monthly: number; yearly: number }

/** Prix affichés d'une offre lue dans subscription_plans, ou null si l'offre manque. */
export function prixOffre(p: PlanPrix | undefined | null): { mensuel: string; annuel: string | null } | null {
  if (!p || !Number.isFinite(p.monthly)) return null;
  if (p.monthly === 0) return { mensuel: '0 FCFA', annuel: null };
  return { mensuel: `${fmtNumber(p.monthly, 0)} FCFA`, annuel: p.yearly > 0 ? `${fmtNumber(p.yearly, 0)} FCFA` : null };
}

// ── Bandeau flottant ───────────────────────────────────────────────────

/**
 * Le bandeau ne s'affiche qu'à un visiteur anonyme (session vérifiée), qui ne l'a
 * pas fermé, une fois le champ d'inscription de l'ouverture passé AU-DESSUS de
 * l'écran, et tant que le bloc final n'est pas en vue.
 */
export function bandeauVisible(o: { session: 'inconnu' | 'anonyme' | 'connecte'; ferme: boolean; heroDepasse: boolean; finEnVue: boolean }): boolean {
  return o.session === 'anonyme' && !o.ferme && o.heroDepasse && !o.finEnVue;
}
