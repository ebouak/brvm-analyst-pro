import { ImageResponse } from 'next/og';
import type { PulseData, WorkflowDotStatus } from './pulseDonnees';

export const PULSE_LARGEUR = 1080;
export const PULSE_HAUTEUR = 1350;

const C = {
  fond: '#030303',
  carte: '#0a1417',
  bord: 'rgba(255,255,255,0.10)',
  blanc: '#FCFCFC',
  gris: '#A9BFC5',
  sourd: '#7A8A90',
  cyan: '#56D7FD',
  teal: '#16B6A4',
  hausse: '#3fe18b',
  baisse: '#ff6b6b',
  warn: '#F0B23A',
};

const DOT_COULEUR: Record<WorkflowDotStatus, string> = {
  ok: C.hausse,
  warn: C.warn,
  ko: C.baisse,
  off: C.sourd,
};

const nombre = (n: number) => n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');

function MetricBox({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        background: C.carte,
        border: `2px solid ${C.bord}`,
        borderRadius: 24,
        padding: '24px 28px',
      }}
    >
      <span style={{ fontSize: 22, color: C.sourd, letterSpacing: 2 }}>{label.toUpperCase()}</span>
      <span style={{ fontSize: 58, fontWeight: 800, color: color ?? C.blanc, marginTop: 8 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 22, color: C.gris, marginTop: 6 }}>{sub}</span>}
    </div>
  );
}

/**
 * Executive Card PNG (1080x1350) destinee au Bot Telegram Ops.
 * Rendu Edge uniquement (next/og), sans emoji ni espace insecable.
 */
export function imagePulse(d: PulseData): ImageResponse {
  const koCount = d.workflowDots.filter((w) => w.status === 'ko' || w.status === 'off').length;
  const okCount = d.workflowDots.filter((w) => w.status === 'ok').length;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: C.fond,
          color: C.blanc,
          padding: '54px 58px',
        }}
      >
        {/* En-tete */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: C.cyan }}>
              WESTBOURSE OPS
            </span>
            <span style={{ fontSize: 26, color: C.gris, marginTop: 4 }}>
              Pulse Executif & Sante Plateforme
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 20, color: C.sourd }}>INSTANTANE</span>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{d.observeAUtc}</span>
          </div>
        </div>

        {/* Ligne 1 : Croissance & Conversion */}
        <div style={{ display: 'flex', gap: 20, marginTop: 38 }}>
          <MetricBox
            label="Utilisateurs"
            value={nombre(d.totalUsers)}
            sub={`+${nombre(d.newUsers7d)} sur 7 jours`}
            color={C.cyan}
          />
          <MetricBox
            label="Comptes Premium"
            value={nombre(d.premiumUsers)}
            sub={`Conversion ${d.conversionPct} %`}
            color={C.hausse}
          />
        </div>

        {/* Ligne 2 : Operations & Marche */}
        <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
          <MetricBox
            label="Derniere seance BRVM"
            value={d.derniereSeance ?? '—'}
            sub={`${nombre(d.valeursCotees)} valeurs cotees`}
          />
          <MetricBox
            label="Scraper 24h"
            value={`${nombre(d.scraperOk24h)} OK`}
            sub={`${nombre(d.scraperKo24h)} echec(s)`}
            color={d.scraperKo24h > 0 ? C.baisse : C.hausse}
          />
        </div>

        {/* File de decisions */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 24,
            background: C.carte,
            border: `2px solid ${C.bord}`,
            borderRadius: 24,
            padding: '24px 28px',
          }}
        >
          <span style={{ fontSize: 22, color: C.sourd, letterSpacing: 2, marginBottom: 16 }}>
            FILE DE DECISIONS ADMIN
          </span>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, padding: '6px 0' }}>
            <span style={{ color: C.gris }}>Incidents Ops ouverts</span>
            <span style={{ fontWeight: 700, color: d.openIncidents > 0 ? C.baisse : C.hausse }}>
              {nombre(d.openIncidents)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, padding: '6px 0' }}>
            <span style={{ color: C.gris }}>Paiements en attente</span>
            <span style={{ fontWeight: 700, color: d.pendingPayments > 0 ? C.warn : C.hausse }}>
              {nombre(d.pendingPayments)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, padding: '6px 0' }}>
            <span style={{ color: C.gris }}>Contacts sans reponse</span>
            <span style={{ fontWeight: 700, color: d.unreadContacts > 0 ? C.warn : C.hausse }}>
              {nombre(d.unreadContacts)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 28, padding: '6px 0' }}>
            <span style={{ color: C.gris }}>Agregats bancaires a relire</span>
            <span style={{ fontWeight: 700, color: d.openAgregats > 0 ? C.cyan : C.hausse }}>
              {nombre(d.openAgregats)}
            </span>
          </div>
        </div>

        {/* Heatmap Workflows GitHub */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 24,
            background: C.carte,
            border: `2px solid ${C.bord}`,
            borderRadius: 24,
            padding: '24px 28px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 22, color: C.sourd, letterSpacing: 2 }}>
              HEATMAP WORKFLOWS GITHUB ({d.workflowDots.length})
            </span>
            <span style={{ fontSize: 22, color: koCount > 0 ? C.baisse : C.hausse }}>
              {`${okCount} sains / ${koCount} en alerte`}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {d.workflowDots.length === 0 ? (
              <span style={{ fontSize: 24, color: C.sourd }}>Aucune photo ops_workflows disponible.</span>
            ) : (
              d.workflowDots.map((w) => (
                <div
                  key={w.nom}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 10,
                    padding: '6px 12px',
                    marginRight: 10,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      background: DOT_COULEUR[w.status],
                      marginRight: 8,
                    }}
                  />
                  <span style={{ fontSize: 18, color: C.gris }}>{w.nom}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pied */}
        <div style={{ display: 'flex', marginTop: 'auto', justifyContent: 'space-between', fontSize: 21, color: C.sourd }}>
          <span>Console d&apos;orchestration interne WESTBOURSE</span>
          <span>westbourse.com/admin/ops</span>
        </div>
      </div>
    ),
    {
      width: PULSE_LARGEUR,
      height: PULSE_HAUTEUR,
      headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex' },
    },
  );
}
