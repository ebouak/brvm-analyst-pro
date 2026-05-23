// Template PDF A4 pour l'export rapport.
// Rendu exclusivement côté client via @react-pdf/renderer (jamais SSR).
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { ReportData } from '../ReportView';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a2e',
    padding: 40,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottom: '1pt solid #e0e0e0',
    paddingBottom: 8,
  },
  brand: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#00875a' },
  meta: { fontSize: 8, color: '#666666', textAlign: 'right' },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: '#1a1a2e',
  },
  row: { flexDirection: 'row', borderBottom: '0.5pt solid #eeeeee', paddingVertical: 3 },
  cell: { flex: 1, fontSize: 9 },
  cellBold: { flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  up: { color: '#00875a' },
  down: { color: '#c62828' },
  muted: { color: '#666666' },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: '1pt solid #cccccc',
    paddingBottom: 3,
    marginBottom: 2,
  },
  tableHeaderCell: { flex: 1, fontSize: 8, color: '#888888', fontFamily: 'Helvetica-Bold' },
});

function sign(v: number) {
  return v >= 0 ? '+' : '';
}

interface Props {
  data: ReportData;
  generatedAt: string;
}

export function ReportPDF({ data, generatedAt }: Props) {
  const withVar = data.marketRows.filter((r) => r.variation_pct != null);
  const avgVar = withVar.length
    ? withVar.reduce((s, r) => s + (r.variation_pct ?? 0), 0) / withVar.length
    : null;

  const sorted = [...data.marketRows]
    .filter((r) => r.variation_pct != null)
    .sort((a, b) => (b.variation_pct ?? 0) - (a.variation_pct ?? 0));
  const top3 = sorted.slice(0, 3);
  const bot3 = sorted.slice(-3).reverse();

  const actionable = data.signals.filter((s) => s.signal !== 'HOLD');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.brand}>BRVM Analyst Pro</Text>
          <View>
            <Text style={styles.meta}>
              Période : {data.dateFrom} → {data.dateTo}
            </Text>
            <Text style={styles.meta}>Généré le {generatedAt}</Text>
          </View>
        </View>

        {/* Résumé exécutif */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Résumé exécutif</Text>
          {avgVar != null && (
            <Text>
              Variation moyenne marché :{' '}
              <Text style={avgVar >= 0 ? styles.up : styles.down}>
                {sign(avgVar)}{avgVar.toFixed(2)} %
              </Text>
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...styles.muted, fontSize: 8, marginBottom: 3 }}>Top 3 hausses</Text>
              {top3.map((r) => (
                <View key={r.code} style={styles.row}>
                  <Text style={styles.cellBold}>{r.code}</Text>
                  <Text style={{ ...styles.cell, ...styles.up }}>
                    +{(r.variation_pct ?? 0).toFixed(2)} %
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...styles.muted, fontSize: 8, marginBottom: 3 }}>Top 3 baisses</Text>
              {bot3.map((r) => (
                <View key={r.code} style={styles.row}>
                  <Text style={styles.cellBold}>{r.code}</Text>
                  <Text style={{ ...styles.cell, ...styles.down }}>
                    {(r.variation_pct ?? 0).toFixed(2)} %
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Événements */}
        {data.events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Événements ({data.events.length})
            </Text>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>Date</Text>
              <Text style={styles.tableHeaderCell}>Type</Text>
              <Text style={{ ...styles.tableHeaderCell, flex: 3 }}>Titre</Text>
              <Text style={styles.tableHeaderCell}>Code</Text>
            </View>
            {data.events.slice(0, 20).map((e) => (
              <View key={e.id} style={styles.row}>
                <Text style={styles.cell}>{e.event_date}</Text>
                <Text style={styles.cell}>{e.event_type}</Text>
                <Text style={{ ...styles.cell, flex: 3 }}>{e.title}</Text>
                <Text style={styles.cell}>{e.instrument_code ?? '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Signaux */}
        {actionable.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Signaux BUY/SELL ({actionable.length})
            </Text>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>Date</Text>
              <Text style={styles.tableHeaderCell}>Code</Text>
              <Text style={styles.tableHeaderCell}>Signal</Text>
              <Text style={styles.tableHeaderCell}>Score</Text>
            </View>
            {actionable.slice(0, 30).map((s, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.cell}>{s.date_marche}</Text>
                <Text style={styles.cellBold}>{s.code}</Text>
                <Text
                  style={{
                    ...styles.cell,
                    ...(s.signal === 'BUY' ? styles.up : styles.down),
                  }}
                >
                  {s.signal}
                </Text>
                <Text style={styles.cell}>{s.score_total.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Statistiques */}
        {data.statRows.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statistiques par titre</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>Code</Text>
              <Text style={styles.tableHeaderCell}>Rdt période</Text>
              <Text style={styles.tableHeaderCell}>Vol. 20j</Text>
              <Text style={styles.tableHeaderCell}>Vol. moy.</Text>
            </View>
            {data.statRows.map((r) => {
              const first = r.closes.find((c) => c > 0) ?? null;
              const last = r.closes.length > 0 ? r.closes[r.closes.length - 1] ?? null : null;
              const perf = first && last ? ((last - first) / first) * 100 : null;
              return (
                <View key={r.code} style={styles.row}>
                  <Text style={styles.cellBold}>{r.code}</Text>
                  <Text
                    style={{
                      ...styles.cell,
                      ...(perf == null ? {} : perf >= 0 ? styles.up : styles.down),
                    }}
                  >
                    {perf != null ? `${sign(perf)}${perf.toFixed(2)} %` : '—'}
                  </Text>
                  <Text style={styles.cell}>—</Text>
                  <Text style={styles.cell}>
                    {r.volumes.filter((v): v is number => v != null).length > 0
                      ? Math.round(
                          r.volumes.filter((v): v is number => v != null).reduce((a, b) => a + b, 0) /
                            r.volumes.filter((v): v is number => v != null).length,
                        ).toLocaleString('fr-FR')
                      : '—'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Page>
    </Document>
  );
}
