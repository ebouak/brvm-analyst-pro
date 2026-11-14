import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Garde-fous STATIQUES sur la confidentialité du relevé mensuel (lot 6).
 *
 * Ils ne remplacent pas le contrôle de RLS contre la vraie base (voir la
 * requête de contrôle dans la PR), mais ils empêchent une régression de code
 * ou de migration de rouvrir ce que la conception a fermé.
 */
const RACINE = path.resolve(__dirname, '..', '..');
const lire = (p: string) => readFileSync(path.join(RACINE, p), 'utf8').replace(/\r\n/g, '\n');
const MIGRATION = lire('../supabase/migrations/0233_releve_mensuel.sql');
const SANS_COMMENTAIRES = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(--|\/\/).*$/gm, '');

function fichiers(dir: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    if (['node_modules', '.next', '.next-fix404', '.next-prod.ancien', '.tmp-qa'].includes(nom)) continue;
    const p = path.join(dir, nom);
    if (statSync(p).isDirectory()) fichiers(p, sortie);
    else if (/\.(ts|tsx|mjs)$/.test(nom) && !/\.test\./.test(nom)) sortie.push(p);
  }
  return sortie;
}

describe('migration 0233 : monthly_reports', () => {
  it('retire tout droit à anon et authenticated, puis n’accorde que des colonnes nommées SANS les colonnes de jeton', () => {
    expect(MIGRATION).toMatch(/revoke all on public\.monthly_reports from anon, authenticated;/);
    const m = MIGRATION.match(/grant select \(([^)]*)\)\s+on public\.monthly_reports to authenticated;/);
    expect(m, 'GRANT SELECT par colonnes introuvable').not.toBeNull();
    const colonnes = m![1]!.split(',').map((c) => c.trim());
    expect(colonnes).toContain('report_json');
    expect(colonnes.some((c) => c.startsWith('rendu_jeton'))).toBe(false);
    expect(MIGRATION).not.toMatch(/grant [^;]*monthly_reports to anon/);
  });

  it('le bucket des PDF est privé et aucune policy ne l’ouvre', () => {
    expect(MIGRATION).toMatch(/values \('releves', 'releves', false,/);
    expect(SANS_COMMENTAIRES(MIGRATION)).not.toMatch(/create policy/i);
    expect(SANS_COMMENTAIRES(MIGRATION)).not.toMatch(/storage\.objects/i);
  });

  it('les consentements sont décochés par défaut', () => {
    expect(MIGRATION).toMatch(/releve_email\s+boolean not null default false/);
    expect(MIGRATION).toMatch(/releve_telegram boolean not null default false/);
  });

  it('l’empreinte du jeton doit être un SHA-256 hexadécimal', () => {
    expect(MIGRATION).toMatch(/\^\[0-9a-f\]\{64\}\$/);
  });
});

describe('code : les colonnes de jeton ne sortent que par le module d’accès', () => {
  const sources = [
    ...fichiers(path.join(RACINE, 'app')),
    ...fichiers(path.join(RACINE, 'components')),
    ...fichiers(path.join(RACINE, 'lib')),
  ];

  it('seuls releveAcces.ts et renduAutorise.ts nomment rendu_jeton (hors commentaires)', () => {
    const autorises = [path.join('lib', 'server', 'releveAcces.ts'), path.join('lib', 'releve', 'renduAutorise.ts')];
    const fautifs = sources
      .filter((f) => /rendu_jeton/.test(SANS_COMMENTAIRES(readFileSync(f, 'utf8'))))
      .map((f) => path.relative(RACINE, f))
      .filter((f) => !autorises.includes(f));
    expect(fautifs).toEqual([]);
  });

  it('aucun select("*") sur monthly_reports', () => {
    const fautifs = sources.filter((f) => /from\('monthly_reports'\)\s*\.select\(\s*['"`]\*['"`]/.test(readFileSync(f, 'utf8')));
    expect(fautifs.map((f) => path.relative(RACINE, f))).toEqual([]);
  });

  it('la page de rendu et le module d’accès ne lisent aucune position de portefeuille', () => {
    for (const f of ['app/rapports/releve/[id]/page.tsx', 'lib/server/releveAcces.ts', 'lib/releve/affichage.ts']) {
      const s = SANS_COMMENTAIRES(lire(f));
      expect(s, f).not.toMatch(/portfolios_positions|paper_trading/);
    }
  });

  it('le secret de rendu du dossier valeur n’ouvre jamais un relevé', () => {
    for (const f of ['app/rapports/releve/[id]/page.tsx', 'lib/server/releveAcces.ts', 'lib/releve/renduAutorise.ts']) {
      expect(SANS_COMMENTAIRES(lire(f)), f).not.toMatch(/DOSSIER_RENDER_SECRET|x-dossier-render|secretRenduValide/);
    }
  });

  it('la page ne met rien en cache et ne s’indexe pas', () => {
    const page = lire('app/rapports/releve/[id]/page.tsx');
    expect(page).toMatch(/export const dynamic = 'force-dynamic'/);
    expect(page).toMatch(/noStore\(\)/);
    expect(page).toMatch(/index: false/);
    expect(lire('lib/supabase/middleware.ts')).toMatch(/Cache-Control', 'no-store'/);
  });

  it('le téléchargement exige une session et vérifie le propriétaire', () => {
    const route = lire('app/api/releve/[id]/pdf/route.ts');
    expect(route).toMatch(/status: 401/);
    expect(route).toMatch(/ligne\.user_id !== user\.id/);
  });
});

describe('middleware : le jeton n’ouvre que le préfixe du relevé', () => {
  it('laisse passer un jeton de bonne forme sur /rapports/releve/ seulement', () => {
    const m = lire('lib/supabase/middleware.ts');
    expect(m).toMatch(/pathname\.startsWith\(PREFIXE_RELEVE\)/);
    expect(m).toMatch(/!isRenderAuthorized\(request\) && !porteUnJetonDeReleve\(request\)/);
    expect(lire('lib/releve/renduAutorise.ts')).toMatch(/PREFIXE_RELEVE = '\/rapports\/releve\/'/);
  });
});

describe('RGPD', () => {
  it('l’export couvre monthly_reports sans les colonnes de jeton', () => {
    const e = lire('app/api/account/export/route.ts');
    expect(e).toMatch(/from\('monthly_reports'\)/);
    expect(e).toMatch(/monthly_reports: monthlyReports\.data/);
    const requete = e.match(/from\('monthly_reports'\)\s*\.select\('([^']*)'\)/);
    expect(requete?.[1]).toBeTruthy();
    expect(requete![1]).not.toMatch(/rendu_jeton/);
  });

  it('la suppression du compte purge le bucket releves', () => {
    expect(lire('app/api/account/delete/route.ts')).toMatch(/storage\.from\('releves'\)\.remove/);
  });

  it('RelevePrefs n’écrit jamais les colonnes verrouillées de notification_prefs', () => {
    const upsert = lire('components/settings/RelevePrefs.tsx').match(/\.upsert\(\s*\{([\s\S]*?)\}\s*,/);
    expect(upsert).not.toBeNull();
    expect(upsert![1]).not.toMatch(/telegram_chat_id|whatsapp_phone|whatsapp_chat_id/);
    expect(upsert![1]).toMatch(/releve_email/);
  });
});
