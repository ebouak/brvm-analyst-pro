import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { AnalyseStructuree, ActionAnalysee } from './parseAnalyse';

const C = {
  bg: '#0f1117', surface: '#161b22', border: '#30363d',
  text: '#e6edf3', muted: '#8d96a0',
  up: '#3fb950', down: '#f85149', warn: '#d29922',
  white: '#ffffff', dark: '#24292f',
};

const SIGNAL_COLOR: Record<string, string> = { ACHAT: C.up, NEUTRE: C.warn, VENTE: C.down };
const sigColor = (sig: string) => {
  const s = sig.toUpperCase();
  return s.includes('ACHAT') || s === 'BUY' ? C.up
       : s.includes('VENTE') || s === 'SELL' ? C.down
       : C.warn;
};

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, color: C.text, fontFamily: 'Helvetica', paddingTop: 40, paddingBottom: 60, paddingHorizontal: 40 },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  brand: { fontSize: 8, color: C.up, letterSpacing: 2, marginBottom: 4 },
  titre: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 2 },
  sousTitre: { fontSize: 10, color: C.muted },
  dateText: { fontSize: 8, color: C.muted, marginBottom: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 1 },
  // Score + KPI
  scoreRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  scoreCard: { flex: 1, backgroundColor: C.surface, borderRadius: 6, padding: 12, borderWidth: 1, borderColor: C.border },
  scoreLabel: { fontSize: 7, color: C.muted, letterSpacing: 1.5, marginBottom: 5 },
  scoreVal: { fontSize: 26, fontFamily: 'Helvetica-Bold' },
  scoreSub: { fontSize: 12, color: C.muted },
  progressBg: { height: 5, backgroundColor: C.border, borderRadius: 3, marginTop: 7 },
  progressFill: { height: 5, borderRadius: 3 },
  scoreNote: { fontSize: 7.5, color: C.muted, marginTop: 3 },
  kpiGrid: { flex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kpiCard: { width: '47%', backgroundColor: C.surface, borderRadius: 5, padding: 8, borderWidth: 1, borderColor: C.border },
  kpiLabel: { fontSize: 7, color: C.muted, marginBottom: 2 },
  kpiVal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.white },
  kpiPct: { fontSize: 8, color: C.up, marginTop: 1 },
  // Sections
  section: { marginBottom: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: C.border },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.white },
  sectionBody: { fontSize: 9, color: C.muted, lineHeight: 1.6 },
  // Table
  table: { marginTop: 7, borderWidth: 1, borderColor: C.border, borderRadius: 3 },
  tHead: { flexDirection: 'row', backgroundColor: C.dark },
  tHCell: { flex: 1, padding: 5, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.white, borderRightWidth: 1, borderRightColor: C.border },
  tRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
  tRowAlt: { backgroundColor: '#1c2128' },
  tCell: { flex: 1, padding: 5, fontSize: 8, color: C.text, borderRightWidth: 1, borderRightColor: C.border },
  // Risques
  riskBox: { backgroundColor: '#1f1107', borderRadius: 5, padding: 10, borderWidth: 1, borderColor: '#3d2b0f', marginBottom: 14 },
  riskTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.warn, marginBottom: 5 },
  riskRow: { flexDirection: 'row', gap: 5, marginBottom: 2 },
  riskBullet: { fontSize: 8.5, color: C.warn },
  riskText: { fontSize: 8.5, color: '#d29922', flex: 1, lineHeight: 1.5 },
  // Footer
  footer: { position: 'absolute', bottom: 22, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  footerL: { fontSize: 7, color: C.muted, flex: 1 },
  footerR: { fontSize: 7, color: C.up },
  pageNum: { position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontSize: 7.5, color: C.muted },
  // Screener
  actionBlock: { marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  actionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, backgroundColor: C.surface, padding: 9, borderRadius: 5 },
  actionSymbole: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white },
  actionNom: { fontSize: 8.5, color: C.muted, marginTop: 2 },
  actionBadges: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  rsiChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, backgroundColor: C.surface, borderWidth: 1 },
  kpiRowMini: { flexDirection: 'row', gap: 5, marginTop: 6 },
  kpiMini: { flex: 1, backgroundColor: C.surface, borderRadius: 4, padding: 5, borderWidth: 1, borderColor: C.border },
  kpiMiniLabel: { fontSize: 6.5, color: C.muted },
  kpiMiniValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.white, marginTop: 2 },
  screenerTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 14, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border },
});

// ── Composants partagés ────────────────────────────────────────────────────────

const Tableau = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <View style={s.table}>
    <View style={s.tHead}>
      {headers.map((h, i) => <Text key={i} style={s.tHCell}>{h}</Text>)}
    </View>
    {rows.map((row, ri) => (
      <View key={ri} style={[s.tRow, ri % 2 === 1 ? s.tRowAlt : {}]}>
        {row.map((cell, ci) => <Text key={ci} style={s.tCell}>{cell}</Text>)}
      </View>
    ))}
  </View>
);

const KpiCard = ({ label, value, pct, valueColor }: { label: string; value: string; pct?: string; valueColor?: string }) => (
  <View style={s.kpiCard}>
    <Text style={s.kpiLabel}>{label.toUpperCase()}</Text>
    <Text style={[s.kpiVal, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    {pct && pct !== 'N/A' && <Text style={s.kpiPct}>{pct}</Text>}
  </View>
);

const ActionScreenerBlock = ({ action, index }: { action: ActionAnalysee; index: number }) => {
  const sc = sigColor(action.signal);
  const rsiVal = action.rsi ?? 50;
  const rsiC = rsiVal < 30 ? C.up : rsiVal > 70 ? C.down : C.warn;
  const medal = index === 0 ? '#1' : index === 1 ? '#2' : index === 2 ? '#3' : `#${index + 1}`;

  return (
    <View style={s.actionBlock} wrap={false}>
      <View style={s.actionHeader}>
        <View>
          <Text style={s.actionSymbole}>{medal}  {action.symbole}</Text>
          <Text style={s.actionNom}>{action.nom}</Text>
        </View>
        <View style={s.actionBadges}>
          {action.rsi !== undefined && (
            <View style={[s.rsiChip, { borderColor: rsiC }]}>
              <Text style={[{ fontSize: 8, fontFamily: 'Helvetica-Bold' }, { color: rsiC }]}>RSI {action.rsi}</Text>
            </View>
          )}
          <View style={[s.badge, { backgroundColor: sc }]}>
            <Text style={s.badgeText}>{action.signal}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: C.border }]}>
            <Text style={[s.badgeText, { color: sc }]}>{action.score}/10</Text>
          </View>
        </View>
      </View>
      <View style={s.kpiRowMini}>
        {[
          { l: 'ENTRÉE',     v: action.prixEntree || 'N/A' },
          { l: 'OBJECTIF 1', v: action.objectif1 || 'N/A', color: C.up },
          { l: 'STOP-LOSS',  v: action.stopLoss || 'N/A', color: C.down },
          { l: 'HORIZON',    v: action.horizon || 'N/A' },
        ].map((k, i) => (
          <View key={i} style={s.kpiMini}>
            <Text style={s.kpiMiniLabel}>{k.l}</Text>
            <Text style={[s.kpiMiniValue, k.color ? { color: k.color } : {}]}>{k.v}</Text>
          </View>
        ))}
      </View>
      {action.risques.length > 0 && (
        <View style={{ marginTop: 5 }}>
          {action.risques.map((r, i) => (
            <Text key={i} style={{ fontSize: 8, color: C.warn, marginTop: 1 }}>• {r}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

// ── Document principal ────────────────────────────────────────────────────────

export const PdfAnalyseDocument = ({ data }: { data: AnalyseStructuree }) => {
  const sc = SIGNAL_COLOR[data.signal] ?? C.warn;
  const scoreNote = data.scoreConviction >= 7 ? 'Achat fort' : data.scoreConviction >= 5 ? 'A surveiller' : 'Neutre / Eviter';

  return (
    <Document title={`Analyse BRVM — ${data.symbole || data.titreRapport} — ${data.date}`} author="BRVM Analyst Pro">
      <Page size="A4" style={s.page}>

        {/* HEADER */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.brand}>BRVM ANALYST PRO</Text>
            <Text style={s.titre}>{data.titreRapport}</Text>
            <Text style={s.sousTitre}>
              {data.symbole ? `${data.symbole} · ` : ''}{data.typeAnalyse === 'screener' ? 'Screener multi-actions' : 'Analyse financière complète'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.dateText}>{data.date}</Text>
            <View style={[s.badge, { backgroundColor: sc }]}>
              <Text style={s.badgeText}>{data.signal}</Text>
            </View>
          </View>
        </View>

        {/* SCORE + KPIs — uniquement pour fiche action */}
        {data.typeAnalyse === 'fiche' && (
          <View style={s.scoreRow}>
            <View style={s.scoreCard}>
              <Text style={s.scoreLabel}>SCORE DE CONVICTION</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={[s.scoreVal, { color: sc }]}>{data.scoreConviction.toFixed(1)}</Text>
                <Text style={s.scoreSub}> /10</Text>
              </View>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${data.scoreConviction * 10}%`, backgroundColor: sc }]} />
              </View>
              <Text style={s.scoreNote}>{scoreNote}</Text>
            </View>
            <View style={s.kpiGrid}>
              <KpiCard label="Prix d'entrée" value={data.recommendation.prixEntree} />
              <KpiCard label="Objectif 1" value={data.recommendation.objectif1} pct={data.recommendation.objectif1Pct} valueColor={C.up} />
              <KpiCard label="Objectif 2" value={data.recommendation.objectif2} pct={data.recommendation.objectif2Pct} valueColor={C.up} />
              <KpiCard label="Stop-Loss" value={data.recommendation.stopLoss} pct={data.recommendation.stopLossPct} valueColor={C.down} />
              <KpiCard label="Horizon" value={data.recommendation.horizon} />
            </View>
          </View>
        )}

        {/* SCORE SYNTHÈSE — screener */}
        {data.typeAnalyse === 'screener' && data.actionsAnalysees && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <View style={s.scoreCard}>
              <Text style={s.scoreLabel}>ACTIONS SÉLECTIONNÉES</Text>
              <Text style={[s.scoreVal, { color: sc, fontSize: 22 }]}>{data.actionsAnalysees.length}</Text>
              <Text style={s.scoreNote}>opportunités filtrées</Text>
            </View>
            <View style={[s.scoreCard, { flex: 2 }]}>
              <Text style={s.scoreLabel}>SCORE MOYEN</Text>
              <Text style={[s.scoreVal, { color: sc, fontSize: 22 }]}>
                {(data.actionsAnalysees.reduce((sum, a) => sum + a.score, 0) / data.actionsAnalysees.length).toFixed(1)}
              </Text>
              <Text style={s.scoreNote}>/ 10 — classement par conviction décroissante</Text>
            </View>
          </View>
        )}

        {/* SECTIONS TEXTE */}
        {data.sections.map((sec, i) => (
          <View key={i} style={s.section} wrap={false}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>{sec.titre}</Text>
            </View>
            <Text style={s.sectionBody}>{sec.contenu}</Text>
            {(sec.tableaux ?? []).map((t, ti) => <Tableau key={ti} headers={t.headers} rows={t.rows} />)}
          </View>
        ))}

        {/* ACTIONS SCREENER */}
        {data.actionsAnalysees && data.actionsAnalysees.length > 0 && (
          <View>
            <Text style={s.screenerTitle}>Classement des Opportunités</Text>
            {data.actionsAnalysees.map((action, i) => (
              <ActionScreenerBlock key={action.symbole + i} action={action} index={i} />
            ))}
          </View>
        )}

        {/* RISQUES */}
        {data.risques.length > 0 && (
          <View style={s.riskBox} wrap={false}>
            <Text style={s.riskTitle}>RISQUES SPECIFIQUES</Text>
            {data.risques.map((r, i) => (
              <View key={i} style={s.riskRow}>
                <Text style={s.riskBullet}>•</Text>
                <Text style={s.riskText}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* FOOTER */}
        <View style={s.footer}>
          <Text style={s.footerL}>{data.disclaimer}</Text>
          <Text style={s.footerR}>BRVM Analyst Pro</Text>
        </View>
        <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
};
