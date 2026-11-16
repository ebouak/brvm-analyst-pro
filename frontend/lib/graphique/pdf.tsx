// Graphique avancé : export PDF (graphique + tableau des cours).
//
// Généré dans le navigateur avec @react-pdf/renderer (déjà employé par
// l'export d'analyse) plutôt que par l'impression du navigateur : le fichier
// obtenu est identique quel que soit le navigateur, le tableau se pagine seul
// (en-tête répété) et l'image est celle du graphique tel qu'il est affiché.
// Polices standard (Helvetica) : les espaces insécables sont remplacées.

import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import type { Cellule, TableauExport } from './exports';
import { sansInsecable } from './format';

const s = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 40, paddingHorizontal: 32, fontFamily: 'Helvetica', fontSize: 8, color: '#111' },
  titre: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  mention: { fontSize: 7.5, color: '#444', marginBottom: 1.5 },
  image: { marginTop: 10, marginBottom: 12, width: '100%', objectFit: 'contain', maxHeight: 300 },
  ligne: { flexDirection: 'row', borderBottomWidth: 0.4, borderBottomColor: '#ddd', paddingVertical: 2 },
  entete: { flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: '#555', paddingVertical: 3, fontFamily: 'Helvetica-Bold' },
  cellDate: { width: '12%' },
  cell: { width: '11%', textAlign: 'right' },
  cellLarge: { width: '15.5%', textAlign: 'right' },
  pied: { position: 'absolute', bottom: 18, left: 32, right: 32, fontSize: 7, color: '#777', flexDirection: 'row', justifyContent: 'space-between' },
});

function texte(c: Cellule): string {
  if (c == null) return '';
  if (typeof c === 'string') return c;
  return sansInsecable(c.toLocaleString('fr-FR', { maximumFractionDigits: 2 }));
}

function style(i: number) {
  if (i === 0) return s.cellDate;
  return i >= 6 ? s.cellLarge : s.cell;
}

function DocumentCours({ t, image }: { t: TableauExport; image: string | null }) {
  return (
    <Document title={t.titre} author="WESTBOURSE" creator="WESTBOURSE">
      <Page size="A4" style={s.page}>
        <Text style={s.titre}>{sansInsecable(t.titre)}</Text>
        {t.mentions.map((m) => (
          <Text key={m} style={s.mention}>
            {sansInsecable(m)}
          </Text>
        ))}
        {image ? <Image src={image} style={s.image} /> : null}
        <View style={s.entete} fixed>
          {t.colonnes.map((c, i) => (
            <Text key={c} style={style(i)}>
              {c}
            </Text>
          ))}
        </View>
        {t.lignes.map((row, k) => (
          <View key={k} style={s.ligne} wrap={false}>
            {row.map((c, i) => (
              <Text key={i} style={style(i)}>
                {texte(c)}
              </Text>
            ))}
          </View>
        ))}
        <View style={s.pied} fixed>
          <Text>WESTBOURSE · cours BRVM · information, pas un conseil en investissement</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function versPdf(t: TableauExport, image: string | null): Promise<Blob> {
  return pdf(<DocumentCours t={t} image={image} />).toBlob();
}
