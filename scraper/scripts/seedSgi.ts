/**
 * Seed one-off des tables SGI (annuaire + frais) depuis les fichiers TS du
 * frontend — SOURCE UNIQUE DE VÉRITÉ actuelle. Idempotent (upsert sur la clé
 * naturelle `nom` / `sgi_nom`). À lancer une fois après application de la
 * migration 0063, pour bootstrapper les tables avant la bascule des lectures
 * frontend vers Supabase.
 *
 *   cd scraper && npx tsx scripts/seedSgi.ts
 *
 * N'INVENTE RIEN : reprise exacte des données déjà en code (pas de transcription
 * manuelle — import direct des modules TS, dépourvus de dépendances runtime).
 * Placé hors de src/ pour ne pas entrer dans le build tsc du scraper.
 */
import { SGI_DIRECTORY } from '../../frontend/lib/sgi-frais/directory.js';
import { SGI_FRAIS_SEED } from '../../frontend/lib/sgi-frais/seed-data.js';
import { getSupabase } from '../src/persistence/supabase.js';
import { logger } from '../src/logger.js';

async function main() {
  const sb = getSupabase();

  const directoryRows = SGI_DIRECTORY.map((s) => ({
    nom: s.nom,
    pays: s.pays,
    type: s.type,
    groupe: s.groupe,
    logo: s.logo ?? null,
    depot_min: s.depotMin,
    depot_min_source: s.depotMinSource,
    site_web: s.siteWeb ?? null,
    fiche_brvm: s.ficheBRVM ?? null,
    telephone: null,
    email: null,
    source: 'manuel' as const,
    verifie_le: null,
  }));

  const fraisRows = SGI_FRAIS_SEED.map((f) => ({
    sgi_nom: f.sgiNom,
    courtage_pct_min: f.courtagePctMin,
    courtage_pct_max: f.courtagePctMax,
    minimum_perception: f.minimumPerception,
    droits_garde_pct_min: f.droitsGardePctMin,
    droits_garde_pct_max: f.droitsGardePctMax,
    droits_garde_frequence: f.droitsGardeFrequence,
    droits_garde_minimum: f.droitsGardeMinimum,
    tenue_compte_montant: f.tenueCompteMontant,
    tenue_compte_frequence: f.tenueCompteFrequence,
    frais_virement: f.fraisVirement,
    depot_minimum: f.depotMinimum,
    gestion_sous_mandat_pct_min: f.gestionSousMandatPctMin,
    gestion_sous_mandat_pct_max: f.gestionSousMandatPctMax,
    confiance: f.confiance,
    source_url: f.sourceUrl,
    source_label: f.sourceLabel,
    verifie_le: f.verifieLe,
    notes: f.notes,
  }));

  const { error: dirErr } = await sb
    .from('sgi_directory')
    .upsert(directoryRows, { onConflict: 'nom' });
  if (dirErr) throw new Error(`Upsert sgi_directory: ${dirErr.message}`);

  const { error: fraisErr } = await sb
    .from('sgi_frais')
    .upsert(fraisRows, { onConflict: 'sgi_nom' });
  if (fraisErr) throw new Error(`Upsert sgi_frais: ${fraisErr.message}`);

  logger.info(
    { annuaire: directoryRows.length, frais: fraisRows.length },
    'Seed SGI terminé (annuaire + frais)',
  );
}

main().catch((e) => {
  logger.error({ err: (e as Error).message }, 'Seed SGI échoué');
  process.exit(1);
});
