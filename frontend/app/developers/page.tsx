import Link from 'next/link';

export const metadata = {
  title: 'API Développeurs — WESTBOURSE',
  description: 'API REST publique des données de marché BRVM : actions, indices, historiques. JSON, gratuit, sans clé.',
};

interface Endpoint {
  method: string;
  path: string;
  desc: string;
  example: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/public/v1/actions',
    desc: 'Toutes les actions de la dernière séance (cours, variation, volume, valeur échangée).',
    example: '{ "date": "2026-06-19", "count": 47, "actions": [{ "code": "SNTS", "nom": "SONATEL", "cours": 28150, "variation_pct": 0.54, "volume": 21619, "valeur_echangee": 608600000 }] }',
  },
  {
    method: 'GET',
    path: '/api/public/v1/actions/{code}',
    desc: 'Cours actuel + historique des 90 dernières séances d’une action (ex. SNTS).',
    example: '{ "code": "SNTS", "cours": 28150, "variation_pct": 0.54, "date": "2026-06-19", "historique": [{ "date": "...", "cours": 28000, "variation_pct": -0.2, "volume": 1200 }] }',
  },
  {
    method: 'GET',
    path: '/api/public/v1/indices',
    desc: 'Indices BRVM de la dernière séance (BRVM-Composite, BRVM-30, sectoriels).',
    example: '{ "date": "2026-06-19", "indices": [{ "code": "BRVMC", "nom": "BRVM Composite", "valeur": 438.68, "variation_pct": 0.5 }] }',
  },
  {
    method: 'GET',
    path: '/api/public/v1/obligations',
    desc: 'Obligations cotées de la dernière séance, avec YTM et duration modifiée dérivés.',
    example: '{ "date": "2026-06-19", "count": 30, "obligations": [{ "code": "...", "emetteur": "ETAT DU SENEGAL", "taux_coupon_pct": 6.5, "maturite": "2028-12-31", "cours": 99.5, "ytm_pct": 6.7, "duration_modifiee": 2.4 }] }',
  },
];

/**
 * Origine CANONIQUE. `westbourse.com` redirige en 308 vers `www.` — un snippet
 * qui l'utiliserait ferait échouer le contrôle `event.origin` de l'auto-hauteur
 * (l'iframe est servie depuis `www.`), en silence, chez chaque partenaire.
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.westbourse.com';

/**
 * Widgets embarquables. Le `titre` alimente l'attribut `title` de l'iframe des
 * snippets : sans lui, c'est le score d'accessibilité (WCAG 2.1 § 4.1.2) et
 * Lighthouse du média partenaire qui chute — et notre widget qu'on accuse.
 */
const WIDGETS: { nom: string; path: string; h: number; titre: string }[] = [
  { nom: 'Bandeau des cours', path: '/embed/ticker', h: 56, titre: 'Cours BRVM — WESTBOURSE' },
  { nom: 'Heatmap du jour', path: '/embed/heatmap', h: 420, titre: 'Heatmap BRVM — WESTBOURSE' },
  { nom: 'Fiche valeur', path: '/embed/valeur/SNTS', h: 180, titre: 'Cours SNTS — WESTBOURSE' },
];

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border/60 bg-surface/60 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-display text-white tracking-tight hover:text-accent transition-colors">WESTBOURSE</Link>
          <Link href="/" className="text-sm text-muted hover:text-white transition-colors">← Accueil</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div>
          <p className="overline text-faint mb-2">Développeurs</p>
          <h1 className="font-display text-3xl text-white">API publique BRVM</h1>
          <p className="mt-3 max-w-2xl text-muted leading-relaxed">
            API REST <strong>gratuite, sans clé, en JSON</strong> sur les données de marché de la BRVM
            (Bourse Régionale des Valeurs Mobilières, UEMOA). CORS ouvert, réponses mises en cache 5 min.
            Idéale pour vos scripts, dashboards et bots.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-sm text-muted">Base URL</p>
          <code className="mt-1 block font-mono text-sm text-accent">https://westbourse.com</code>
          <p className="mt-3 text-xs text-faint">
            Données fournies à titre informatif (dernière séance consolidée). Pas de garantie temps réel.
            Limite indicative : <strong>60 requêtes/minute</strong> par IP (réponses mises en cache 5 min).
            Voir <Link href="/mentions-legales" className="text-accent underline">mentions légales</Link>.
          </p>
        </div>

        <section className="space-y-5">
          <h2 className="font-display text-xl text-white">Endpoints</h2>
          {ENDPOINTS.map((e) => (
            <div key={e.path} className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                <span className="rounded bg-up/10 px-2 py-0.5 text-[11px] font-bold text-up">{e.method}</span>
                <code className="font-mono text-sm text-white">{e.path}</code>
              </div>
              <div className="px-4 py-3 space-y-2">
                <p className="text-sm text-muted">{e.desc}</p>
                <pre className="overflow-x-auto rounded-lg bg-bg border border-border/60 p-3 text-[11px] text-faint">{e.example}</pre>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl text-white">Exemple</h2>
          <pre className="overflow-x-auto rounded-lg bg-bg border border-border/60 p-4 text-xs text-muted">{`curl https://westbourse.com/api/public/v1/actions/SNTS`}</pre>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl text-white">Widgets embarquables</h2>
          <p className="text-sm text-muted">
            Intégrez les données BRVM sur votre site en copiant une ligne. Les widgets ne posent{' '}
            <strong className="text-white">aucun cookie</strong> et n&apos;utilisent aucun traceur :
            leur intégration ne déclenche pas d&apos;obligation de consentement chez vous.
            Paramètres : <code className="text-accent">?theme=dark|light</code>,{' '}
            <code className="text-accent">?lang=fr|en</code>, et{' '}
            <code className="text-accent">?codes=SNTS,ETIT</code> (ticker, 20 maximum).
          </p>

          {WIDGETS.map((w) => (
            <div key={w.path} className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="border-b border-border px-4 py-2 text-sm text-white">{w.nom}</div>
              <div className="space-y-3 p-4">
                <iframe
                  title={w.titre}
                  src={w.path}
                  width="100%"
                  height={w.h}
                  style={{ border: 0 }}
                  loading="lazy"
                />
                <pre className="overflow-x-auto rounded-lg bg-bg border border-border/60 p-3 text-[11px] text-faint">{`<iframe title="${w.titre}" src="${SITE}${w.path}" width="100%" height="${w.h}" frameborder="0" loading="lazy"></iframe>`}</pre>
              </div>
            </div>
          ))}

          <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-white">Hauteur automatique (facultatif)</p>
            <p className="text-xs text-muted">
              Le widget publie sa hauteur réelle. Ce script l&apos;applique — il{' '}
              <strong className="text-white">vérifie l&apos;origine</strong>, ce qui est
              indispensable : sans ce contrôle, n&apos;importe quelle autre iframe de votre page
              pourrait redimensionner le widget.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-bg border border-border/60 p-3 text-[11px] text-faint">{`<iframe id="wb-widget" title="Cours BRVM — WESTBOURSE"
  src="${SITE}/embed/ticker" width="100%" height="56"
  frameborder="0" loading="lazy"></iframe>
<script>
  window.addEventListener('message', function (e) {
    if (e.origin !== '${SITE}') return;   // obligatoire
    if (!e.data || e.data.type !== 'wb-resize') return;
    document.getElementById('wb-widget').style.height = e.data.height + 'px';
  });
</script>`}</pre>
          </div>
        </section>
      </main>
    </div>
  );
}
