import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import { SGI_DIRECTORY, type Sgi } from './directory';
import { SGI_FRAIS_SEED } from './seed-data';
import type { SgiFrais, ConfianceNiveau, Frequence } from './types';

/**
 * Lectures Supabase des données SGI (annuaire + frais) avec repli sur les
 * fichiers TS (source du seed) si la table est absente/vide/en erreur —
 * jamais d'écran vide, et la page continue de fonctionner tant que la
 * migration 0063 n'est pas appliquée / seedée. Server-only : lecture via la
 * clé anon sous RLS (tables en lecture publique).
 */

interface SgiDirectoryRow {
  nom: string;
  pays: string | null;
  type: string | null;
  groupe: string | null;
  logo: string | null;
  depot_min: string | null;
  depot_min_source: string | null;
  site_web: string | null;
  fiche_brvm: string | null;
}

interface SgiFraisRow {
  sgi_nom: string;
  courtage_pct_min: number | null;
  courtage_pct_max: number | null;
  minimum_perception: number | null;
  droits_garde_pct_min: number | null;
  droits_garde_pct_max: number | null;
  droits_garde_frequence: string | null;
  droits_garde_minimum: number | null;
  tenue_compte_montant: number | null;
  tenue_compte_frequence: string | null;
  frais_virement: number | null;
  depot_minimum: number | null;
  gestion_sous_mandat_pct_min: number | null;
  gestion_sous_mandat_pct_max: number | null;
  confiance: string | null;
  source_url: string | null;
  source_label: string | null;
  verifie_le: string | null;
  notes: string | null;
}

function mapDirectory(r: SgiDirectoryRow): Sgi {
  return {
    nom: r.nom,
    pays: (r.pays ?? 'CI') as Sgi['pays'],
    type: (r.type as Sgi['type']) ?? 'Non déterminé',
    groupe: r.groupe ?? 'Non renseigné',
    logo: r.logo ?? undefined,
    depotMin: r.depot_min ?? 'Non renseigné',
    depotMinSource: (r.depot_min_source as Sgi['depotMinSource']) ?? 'inconnu',
    siteWeb: r.site_web ?? undefined,
    ficheBRVM: r.fiche_brvm ?? undefined,
  };
}

function mapFrais(r: SgiFraisRow): SgiFrais {
  return {
    sgiNom: r.sgi_nom,
    courtagePctMin: r.courtage_pct_min,
    courtagePctMax: r.courtage_pct_max,
    minimumPerception: r.minimum_perception,
    droitsGardePctMin: r.droits_garde_pct_min,
    droitsGardePctMax: r.droits_garde_pct_max,
    droitsGardeFrequence: (r.droits_garde_frequence as Frequence | null) ?? null,
    droitsGardeMinimum: r.droits_garde_minimum,
    tenueCompteMontant: r.tenue_compte_montant,
    tenueCompteFrequence: (r.tenue_compte_frequence as SgiFrais['tenueCompteFrequence']) ?? null,
    fraisVirement: r.frais_virement,
    depotMinimum: r.depot_minimum,
    gestionSousMandatPctMin: r.gestion_sous_mandat_pct_min,
    gestionSousMandatPctMax: r.gestion_sous_mandat_pct_max,
    confiance: (r.confiance as ConfianceNiveau) ?? 'saisie_utilisateur',
    sourceUrl: r.source_url,
    sourceLabel: r.source_label,
    verifieLe: r.verifie_le,
    notes: r.notes,
  };
}

export async function getSgiDirectory(): Promise<Sgi[]> {
  try {
    const sb = createPublicClient();
    const { data, error } = await sb
      .from('sgi_directory')
      .select('nom, pays, type, groupe, logo, depot_min, depot_min_source, site_web, fiche_brvm')
      .order('nom');
    if (error || !data || data.length === 0) return SGI_DIRECTORY;
    return (data as SgiDirectoryRow[]).map(mapDirectory);
  } catch {
    return SGI_DIRECTORY;
  }
}

export async function getSgiFrais(): Promise<SgiFrais[]> {
  try {
    const sb = createPublicClient();
    const { data, error } = await sb.from('sgi_frais').select('*').order('sgi_nom');
    if (error || !data || data.length === 0) return SGI_FRAIS_SEED;
    return (data as SgiFraisRow[]).map(mapFrais);
  } catch {
    return SGI_FRAIS_SEED;
  }
}
