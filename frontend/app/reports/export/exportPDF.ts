// Déclenche la génération et le téléchargement du PDF côté client.
// Importation dynamique de @react-pdf/renderer pour éviter un bundle SSR.
import type { ReportData } from '../ReportView';

export async function exportReportPDF(data: ReportData): Promise<void> {
  const [{ pdf }, { ReportPDF }, React] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./ReportPDF'),
    import('react'),
  ]);

  const generatedAt = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const element = React.createElement(ReportPDF, { data, generatedAt });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(element as any).toBlob();

  const from = data.dateFrom.replace(/-/g, '');
  const to = data.dateTo.replace(/-/g, '');
  const filename = `rapport-brvm-${from}-${to}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
