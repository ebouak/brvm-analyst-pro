/**
 * Runner CLI : backfill historique depuis GitHub brvm-data-public.
 *
 * Usage :
 *   tsx src/index.ts backfill                          # tous les codes disponibles
 *   tsx src/index.ts backfill SNTS ETIT BOAB           # codes spécifiques
 *   tsx src/index.ts backfill --from=2022-01-01        # filtrer depuis une date
 *   tsx src/index.ts backfill --dry-run                # afficher sans upsert
 */
import { logger } from '../logger.js';
import { listGithubCodes, fetchDailyCSV, upsertBackfillRows, ensureInstrument } from './github.js';

export interface BackfillOptions {
  codes?: string[];      // si vide → tous les codes GitHub
  fromDate?: string;     // YYYY-MM-DD — ignorer les lignes antérieures
  dryRun?: boolean;
}

export async function runBackfill(opts: BackfillOptions = {}): Promise<void> {
  const { fromDate, dryRun = false } = opts;

  logger.info({ fromDate, dryRun }, 'Démarrage backfill GitHub brvm-data-public');

  // Résoudre la liste des codes
  let codes = opts.codes ?? [];
  if (codes.length === 0) {
    logger.info('Récupération de la liste des codes disponibles sur GitHub…');
    codes = await listGithubCodes();
    logger.info({ count: codes.length }, 'Codes trouvés');
  }

  let totalRows = 0;
  let successCodes = 0;
  let errorCodes = 0;

  for (const code of codes) {
    try {
      logger.info({ code }, 'Backfill…');

      if (!dryRun) await ensureInstrument(code);

      let rows = await fetchDailyCSV(code);

      if (fromDate) {
        rows = rows.filter((r) => r.date_marche >= fromDate);
      }

      if (rows.length === 0) {
        logger.info({ code }, 'Aucune ligne — ignoré');
        continue;
      }

      if (dryRun) {
        logger.info({ code, rows: rows.length, first: rows[0]?.date_marche, last: rows[rows.length - 1]?.date_marche }, '[DRY-RUN] serait inséré');
      } else {
        const inserted = await upsertBackfillRows(rows);
        logger.info({ code, inserted, first: rows[0]?.date_marche, last: rows[rows.length - 1]?.date_marche }, 'OK');
        totalRows += inserted;
      }

      successCodes++;

      // Pause légère pour ne pas spammer GitHub
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      logger.error({ code, err: String(err) }, 'Erreur backfill');
      errorCodes++;
    }
  }

  logger.info(
    { successCodes, errorCodes, totalRows, dryRun },
    dryRun ? 'Backfill simulé terminé' : 'Backfill terminé',
  );
}
