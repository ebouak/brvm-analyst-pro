import { pdfFrais } from '@/lib/crm/jetonBonus';

export interface InstrumentDossier {
  code: string;
  designation: string;
  secteur: string | null;
  type: string;
  actif: boolean;
}

export interface CoursDossier {
  code: string;
  date_marche: string;
  cours_jour: number | null;
  variation_pct: number | null;
}

export interface PdfDossier {
  code: string;
  updated_at: string | null;
}

export interface CatalogueDossier {
  code: string;
  designation: string;
  secteur: string | null;
  dateMarche: string | null;
  dateDossier: string | null;
  cours: number | null;
  variationPct: number | null;
  achetable: boolean;
  statut: 'a_jour' | 'actualisation' | 'indisponible';
  prix: 1500;
}

export function composerCatalogueDossiers(
  instruments: readonly InstrumentDossier[],
  cours: readonly CoursDossier[],
  pdfs: readonly PdfDossier[],
  maintenant: Date = new Date(),
): CatalogueDossier[] {
  const derniersCours = new Map<string, CoursDossier>();
  for (const ligne of cours) {
    const precedente = derniersCours.get(ligne.code);
    if (!precedente || Date.parse(ligne.date_marche) > Date.parse(precedente.date_marche)) {
      derniersCours.set(ligne.code, ligne);
    }
  }
  const documents = new Map(pdfs.map((pdf) => [pdf.code, pdf.updated_at]));

  return instruments
    .filter((instrument) => instrument.type === 'action' && instrument.actif && instrument.designation.trim())
    .map((instrument): CatalogueDossier => {
      const quote = derniersCours.get(instrument.code);
      const dateDossier = documents.get(instrument.code) ?? null;
      const frais = pdfFrais(dateDossier, maintenant);
      const statut = frais ? 'a_jour' : dateDossier ? 'actualisation' : 'indisponible';
      return {
        code: instrument.code,
        designation: instrument.designation,
        secteur: instrument.secteur,
        dateMarche: quote?.date_marche ?? null,
        dateDossier,
        cours: quote?.cours_jour ?? null,
        variationPct: quote?.variation_pct ?? null,
        achetable: frais && Boolean(quote),
        statut,
        prix: 1500,
      };
    })
    .sort((a, b) => {
      if (a.achetable !== b.achetable) return a.achetable ? -1 : 1;
      const dateA = a.dateDossier ? Date.parse(a.dateDossier) : 0;
      const dateB = b.dateDossier ? Date.parse(b.dateDossier) : 0;
      if (dateA !== dateB) return dateB - dateA;
      return a.designation.localeCompare(b.designation, 'fr');
    });
}
