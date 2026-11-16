// Réduit un rapport Lighthouse JSON aux chiffres utiles (aucune trace, aucun HTML).
import fs from 'node:fs';
const [fichier, page, passage] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(fichier, 'utf8'));
const a = r.audits;
const v = (id) => a[id]?.numericValue ?? null;
const d = (id) => a[id]?.displayValue ?? null;
const items = (id, n = 8) => (a[id]?.details?.items ?? []).slice(0, n);
const lcpEl = items('largest-contentful-paint-element', 1)[0];
const out = {
  page, passage: Number(passage),
  score: r.categories?.performance?.score ?? null,
  fcp: v('first-contentful-paint'), lcp: v('largest-contentful-paint'), tbt: v('total-blocking-time'),
  cls: v('cumulative-layout-shift'), si: v('speed-index'), tti: v('interactive'), ttfb: v('server-response-time'),
  poidsTotalKo: Math.round((v('total-byte-weight') ?? 0) / 1024),
  requetes: items('network-requests', 9999).length,
  jsInutiliseKo: Math.round((a['unused-javascript']?.details?.overallSavingsBytes ?? 0) / 1024),
  cssInutiliseKo: Math.round((a['unused-css-rules']?.details?.overallSavingsBytes ?? 0) / 1024),
  bloquantsMs: a['render-blocking-resources']?.details?.overallSavingsMs ?? (a['render-blocking-insight']?.metricSavings?.FCP ?? null),
  bootupMs: v('bootup-time'), mainThreadMs: v('mainthread-work-breakdown'), domSize: v('dom-size'),
  lcpElement: lcpEl ? (lcpEl.node?.snippet ?? lcpEl.items?.[0]?.node?.snippet ?? JSON.stringify(lcpEl).slice(0, 200)) : (JSON.stringify(a['largest-contentful-paint-element']?.details ?? {}).slice(0, 300)),
  lcpPhases: (a['largest-contentful-paint-element']?.details?.items?.[1]?.items ?? []).map((x) => ({ phase: x.phase, ms: Math.round(x.timing) })),
  parType: Object.fromEntries(items('resource-summary', 20).map((x) => [x.resourceType, { n: x.requestCount, ko: Math.round(x.transferSize / 1024) }])),
  tiers: items('third-party-summary', 10).map((x) => ({ entite: typeof x.entity === 'string' ? x.entity : x.entity?.text, ko: Math.round((x.transferSize ?? 0) / 1024), blocageMs: Math.round(x.blockingTime ?? 0) })),
  jsInutiliseTop: items('unused-javascript', 6).map((x) => ({ url: String(x.url).replace(/^https?:\/\/[^/]+/, ''), totalKo: Math.round(x.totalBytes / 1024), inutiliseKo: Math.round(x.wastedBytes / 1024) })),
  bootupTop: items('bootup-time', 6).map((x) => ({ url: String(x.url).replace(/^https?:\/\/[^/]+/, ''), totalMs: Math.round(x.total), scriptMs: Math.round(x.scripting) })),
  imagesAOptimiser: [...items('uses-optimized-images'), ...items('modern-image-formats'), ...items('uses-responsive-images')].map((x) => ({ url: String(x.url).slice(0, 120), gainKo: Math.round((x.wastedBytes ?? 0) / 1024) })),
  cacheCourt: items('uses-long-cache-ttl', 10).map((x) => ({ url: String(x.url).slice(0, 120), ttl: x.cacheLifetimeMs, ko: Math.round((x.totalBytes ?? 0) / 1024) })),
  longuesTaches: items('long-tasks', 8).map((x) => ({ url: String(x.url).replace(/^https?:\/\/[^/]+/, '').slice(0, 100), ms: Math.round(x.duration) })),
  polices: items('font-display', 5).map((x) => String(x.url).slice(0, 100)),
  diagnosticsEchecs: Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== 'informative' && x.scoreDisplayMode !== 'notApplicable' && x.scoreDisplayMode !== 'manual').map((x) => `${x.id}: ${x.displayValue ?? ''}`).slice(0, 40),
};
process.stdout.write(JSON.stringify(out) + '\n');
