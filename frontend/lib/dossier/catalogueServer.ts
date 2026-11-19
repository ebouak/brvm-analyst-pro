import 'server-only';
import { getServiceClient } from '@/lib/billing/serviceClient';
import {
  composerCatalogueDossiers,
  type CatalogueDossier,
  type CoursDossier,
  type InstrumentDossier,
  type PdfDossier,
} from './catalogue';

export async function chargerCatalogueDossiers(): Promise<CatalogueDossier[]> {
  const db = getServiceClient();
  const [{ data: instruments, error: errInstruments }, { data: cours, error: errCours }] = await Promise.all([
    db
      .from('brvm_instruments')
      .select('code, designation, secteur, type, actif')
      .eq('type', 'action')
      .eq('actif', true)
      .order('designation'),
    db
      .from('brvm_actions_daily')
      .select('code, date_marche, cours_jour, variation_pct')
      .order('date_marche', { ascending: false })
      .limit(2000),
  ]);
  if (errInstruments || errCours) {
    console.error('[dossiers/catalogue] données illisibles', {
      instruments: errInstruments?.code,
      cours: errCours?.code,
    });
    throw new Error('Catalogue des dossiers temporairement indisponible.');
  }

  const pdfs = await Promise.all(
    ((instruments ?? []) as InstrumentDossier[]).map(async (instrument): Promise<PdfDossier> => {
      const { data, error } = await db.storage.from('dossiers').list(instrument.code, { search: 'dernier.pdf' });
      if (error) {
        console.error('[dossiers/catalogue] stockage illisible', {
          code: instrument.code,
          message: error.message,
        });
        return { code: instrument.code, updated_at: null };
      }
      return {
        code: instrument.code,
        updated_at: data?.find((objet) => objet.name === 'dernier.pdf')?.updated_at ?? null,
      };
    }),
  );

  return composerCatalogueDossiers(
    (instruments ?? []) as InstrumentDossier[],
    (cours ?? []) as CoursDossier[],
    pdfs,
  );
}
