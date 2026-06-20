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
      </main>
    </div>
  );
}
