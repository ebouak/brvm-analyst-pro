/**
 * Corrige le rattachement des publications dont le TITRE nomme une autre
 * société que le code enregistré — même règle que le collecteur
 * (publications/emetteur.ts), appliquée au stock.
 *
 * Constat du 2026-10-07 : la page BDFIN de CFAO Motors CI liste les documents
 * de Tractafric Motors CI, et une trentaine de documents isolés étaient rangés
 * chez un voisin (ETI chez ECOC, AGL chez SNTS, BIIC chez BICC…).
 *
 * Pour chaque publication contredite par son titre :
 *   * une copie existe déjà sous le bon code (même URL) → la copie fautive est
 *     SUPPRIMÉE ;
 *   * sinon → elle est RATTACHÉE au bon code (code et dedupe_hash recalculés) ;
 *   * elle est référencée par un passeport de donnée → elle est SAUTÉE : des
 *     comptes en ont été extraits pour la mauvaise société, leur sort se
 *     décide d'abord (le lien serait perdu par la suppression).
 * L'événement de marché du document est réaligné sur le bon code (sa clé ne
 * contient pas le code : pas de doublon possible).
 *
 * Un titre qui ne nomme aucun émetteur n'est jamais touché. À BLANC par
 * défaut : écrire exige DRY_RUN=false.
 */

import { getSupabase } from '../persistence/supabase.js';
import { logger } from '../logger.js';
import { dedupeHash } from './repository.js';
import { construireAlias, emetteurDuDocument } from './emetteur.js';

const log = logger.child({ module: 'publications-rattachement' });

interface Pub { id: string; code: string; libelle: string; date_publication: string; source_url: string | null; dedupe_hash: string }

export interface Correction {
  id: string;
  code: string;
  vers: string;
  action: 'supprimer' | 'rattacher' | 'sauter (passeport)' | 'à vérifier';
  libelle: string;
  date: string;
}

export async function runRattachement(opts: { dryRun: boolean }): Promise<{
  corrections: Correction[];
  evenements: number;
  /** Titre et fichier désignent deux sociétés : signalé, jamais déplacé. */
  conflits: { id: string; code: string; titre: string; fichier: string; libelle: string }[];
}> {
  const sb = getSupabase();
  const pubs: Pub[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('publications')
      .select('id,code,libelle,date_publication,source_url,dedupe_hash').range(from, from + 999);
    if (error) throw new Error(`publications : ${error.message}`);
    pubs.push(...(data as Pub[]));
    if (data!.length < 1000) break;
  }
  const { data: ins, error: e1 } = await sb.from('brvm_instruments').select('code,designation').eq('type', 'action');
  if (e1) throw new Error(`brvm_instruments : ${e1.message}`);
  const alias = construireAlias((ins ?? []) as { code: string; designation: string | null }[]);
  const codesConnus = new Set((ins ?? []).map((i) => i.code as string));
  const parHash = new Set(pubs.map((p) => p.dedupe_hash));

  // Sociétés auxquelles chaque document (URL) est rattaché.
  const codesParUrl = new Map<string, Set<string>>();
  for (const p of pubs) if (p.source_url) (codesParUrl.get(p.source_url) ?? codesParUrl.set(p.source_url, new Set()).get(p.source_url)!).add(p.code);
  // Émetteur attendu : titre et fichier d'accord ; en cas de désaccord, rien
  // n'est conclu (conflit signalé). Le fichier seul ne tranche que pour un
  // document partagé entre plusieurs sociétés dont le titre ne nomme personne.
  const conflits: { id: string; code: string; titre: string; fichier: string; libelle: string }[] = [];
  const fichierDe = new Map<string, string | null>();
  const attendu = (p: Pub): string | null => {
    const groupe = p.source_url ? codesParUrl.get(p.source_url) ?? null : null;
    const r = emetteurDuDocument(p.libelle, p.source_url, alias, codesConnus, groupe);
    fichierDe.set(p.id, r.fichier);
    if (r.conflit && r.titre !== p.code) conflits.push({ id: p.id, code: p.code, titre: r.titre!, fichier: r.fichier!, libelle: p.libelle });
    return r.code;
  };
  const contredites = pubs
    .map((p) => ({ p, vers: attendu(p) }))
    .filter((x): x is { p: Pub; vers: string } => x.vers != null && x.vers !== x.p.code && codesConnus.has(x.vers));

  const references = new Set<string>();
  const ids = contredites.map((x) => x.p.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb.from('provenance_exercice').select('publication_id').in('publication_id', ids.slice(i, i + 200));
    if (error) throw new Error(`provenance_exercice : ${error.message}`);
    for (const r of data ?? []) references.add(r.publication_id as string);
  }

  const corrections: Correction[] = [];
  for (const { p, vers } of contredites) {
    const base = { id: p.id, code: p.code, vers, libelle: p.libelle, date: p.date_publication };
    if (references.has(p.id)) { corrections.push({ ...base, action: 'sauter (passeport)' }); continue; }
    // Le titre seul ne suffit pas : lus le 2026-10-07, trois PDF titrés pour une
    // autre société étaient bien ceux de la ligne (« … : ETIT » = Ecobank CI ;
    // « Notation - BOA CI » = Onatel ; « … TOTAL SN » = CIE). On n'agit que si
    // le NOM DU FICHIER désigne lui aussi la société cible.
    if (fichierDe.get(p.id) !== vers) { corrections.push({ ...base, action: 'à vérifier' }); continue; }
    const nouveauHash = dedupeHash(vers, p.date_publication, p.libelle);
    const copie = pubs.some((q) => q.id !== p.id && q.code === vers && (q.source_url === p.source_url || q.dedupe_hash === nouveauHash));
    const action: Correction['action'] = copie || parHash.has(nouveauHash) ? 'supprimer' : 'rattacher';
    corrections.push({ ...base, action });
    if (opts.dryRun) continue;
    if (action === 'supprimer') {
      const { error } = await sb.from('publications').delete().eq('id', p.id);
      if (error) throw new Error(`suppression ${p.id} : ${error.message}`);
    } else {
      const { error } = await sb.from('publications').update({ code: vers, dedupe_hash: nouveauHash }).eq('id', p.id);
      if (error) throw new Error(`rattachement ${p.id} : ${error.message}`);
      parHash.add(nouveauHash);
    }
  }

  // Événements de marché : un par document ; on l'aligne sur le bon code.
  let evenements = 0;
  const parUrl = new Map<string, string>();
  for (const c of corrections) {
    if (c.action === 'sauter (passeport)') continue;
    const url = pubs.find((p) => p.id === c.id)?.source_url;
    if (url) parUrl.set(url, c.vers);
  }
  const urls = [...parUrl.keys()];
  // Paquets de 15 : les URL BDFIN sont longues, un filtre `in` de 100 dépasse
  // la longueur d'adresse acceptée (« fetch failed » constaté).
  for (let i = 0; i < urls.length; i += 15) {
    const { data, error } = await sb.from('market_events').select('id,instrument_code,source_url').in('source_url', urls.slice(i, i + 15));
    if (error) throw new Error(`market_events : ${error.message}`);
    for (const ev of data ?? []) {
      const vers = parUrl.get(ev.source_url as string);
      if (!vers || ev.instrument_code === vers) continue;
      evenements++;
      if (opts.dryRun) continue;
      const { error: e2 } = await sb.from('market_events').update({ instrument_code: vers }).eq('id', ev.id);
      if (e2) throw new Error(`événement ${ev.id} : ${e2.message}`);
    }
  }

  log.info({
    dryRun: opts.dryRun,
    supprimer: corrections.filter((c) => c.action === 'supprimer').length,
    rattacher: corrections.filter((c) => c.action === 'rattacher').length,
    sauter: corrections.filter((c) => c.action === 'sauter (passeport)').length,
    evenements,
  }, 'rattachement des publications');
  return { corrections, evenements, conflits };
}
