import { describe, expect, it } from 'vitest';
import { evaluerTaches, relatif, type DonneesTaches, type LigneWorkflow } from './taches';
import type { Signal } from './types';

const H = 3600_000;
const J = 24 * H;
// Mardi 3 novembre 2026, 12:00 UTC.
const MAINTENANT = new Date('2026-11-03T12:00:00Z');
const il = (ms: number, depuis: Date = MAINTENANT) => new Date(depuis.getTime() - ms).toISOString();

function wf(p: Partial<LigneWorkflow> & { fichier: string }): LigneWorkflow {
  return {
    nom: p.fichier.replace('.yml', ''),
    etat: 'active',
    crons: ['0 3 * * *'],
    dernier_run_id: 1,
    dernier_evenement: 'schedule',
    dernier_statut: 'completed',
    derniere_conclusion: 'success',
    dernier_debut: il(9 * H),
    derniere_fin: il(9 * H - 60_000),
    dernier_url: `https://github.com/o/r/actions/runs/${p.fichier}`,
    dernier_succes_at: il(9 * H),
    echecs_consecutifs: 0,
    collecte_at: il(20 * 60_000),
    ...p,
  };
}

function donnees(workflows: LigneWorkflow[], extra: Partial<DonneesTaches> = {}): DonneesTaches {
  return {
    workflows,
    collecteAt: il(20 * 60_000),
    scraperRuns24h: { total: 70, echecs: 0, dernierEchec: null, partiels: 0, bloques: { total: 0, plusAncien: null } },
    ...extra,
  };
}

const parId = (s: Signal[], id: string) => s.find((x) => x.id === id);

describe('evaluerTaches — workflows planifiés', () => {
  it('tous les signaux portent le domaine « taches »', () => {
    const s = evaluerTaches(donnees([wf({ fichier: 'a.yml' })]), MAINTENANT);
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.domaine === 'taches')).toBe(true);
  });

  it('regroupe les workflows sains en UN signal ok', () => {
    const sains = Array.from({ length: 31 }, (_, i) => wf({ fichier: `w${i}.yml` }));
    const s = evaluerTaches(donnees(sains), MAINTENANT);
    const planifies = s.filter((x) => x.id.startsWith('taches:') && x.id.endsWith('.yml'));
    expect(planifies).toHaveLength(0);
    const groupe = parId(s, 'taches:planifies');
    expect(groupe?.niveau).toBe('ok');
    expect(groupe?.detail).toContain('31 workflows planifiés à jour');
  });

  it('un problème reste détaillé à part, les sains restent groupés', () => {
    const s = evaluerTaches(
      donnees([wf({ fichier: 'a.yml' }), wf({ fichier: 'b.yml' }), wf({ fichier: 'casse.yml', derniere_conclusion: 'failure', echecs_consecutifs: 1 })]),
      MAINTENANT,
    );
    expect(parId(s, 'taches:casse.yml')?.niveau).toBe('attention');
    expect(parId(s, 'taches:planifies')?.detail).toContain('2 workflows planifiés à jour');
  });

  it('désactivé à la main → alerte « ne tournera plus »', () => {
    const s = evaluerTaches(donnees([wf({ fichier: 'alerts.yml', etat: 'disabled_manually' })]), MAINTENANT);
    const x = parId(s, 'taches:alerts.yml');
    expect(x?.niveau).toBe('alerte');
    expect(x?.detail).toContain('ne tournera plus');
  });

  it('désactivé pour inactivité → alerte qui mentionne les 60 jours', () => {
    const s = evaluerTaches(donnees([wf({ fichier: 'alerts.yml', etat: 'disabled_inactivity' })]), MAINTENANT);
    const x = parId(s, 'taches:alerts.yml');
    expect(x?.niveau).toBe('alerte');
    expect(x?.detail).toContain('60 jours');
  });

  it('un échec isolé → attention ; deux consécutifs → alerte', () => {
    const un = evaluerTaches(donnees([wf({ fichier: 'a.yml', derniere_conclusion: 'failure', echecs_consecutifs: 1 })]), MAINTENANT);
    expect(parId(un, 'taches:a.yml')?.niveau).toBe('attention');

    const deux = evaluerTaches(donnees([wf({ fichier: 'a.yml', derniere_conclusion: 'failure', echecs_consecutifs: 2 })]), MAINTENANT);
    const x = parId(deux, 'taches:a.yml');
    expect(x?.niveau).toBe('alerte');
    expect(x?.detail).toContain('2 échecs consécutifs');
  });

  it('timed_out compte comme un échec', () => {
    const s = evaluerTaches(donnees([wf({ fichier: 'a.yml', derniere_conclusion: 'timed_out', echecs_consecutifs: 3 })]), MAINTENANT);
    expect(parId(s, 'taches:a.yml')?.niveau).toBe('alerte');
  });

  it('annulé → attention', () => {
    const s = evaluerTaches(donnees([wf({ fichier: 'a.yml', derniere_conclusion: 'cancelled' })]), MAINTENANT);
    expect(parId(s, 'taches:a.yml')?.niveau).toBe('attention');
  });

  it('porte le lien du run et le dernier succès', () => {
    const succes = il(3 * J);
    const s = evaluerTaches(
      donnees([wf({ fichier: 'a.yml', derniere_conclusion: 'failure', echecs_consecutifs: 2, dernier_succes_at: succes })]),
      MAINTENANT,
    );
    const x = parId(s, 'taches:a.yml');
    expect(x?.lien).toBe('https://github.com/o/r/actions/runs/a.yml');
    expect(x?.dernierSucces).toBe(succes);
  });

  it('retard : un cron quotidien sans run depuis 3 jours → attention « aurait dû tourner »', () => {
    const s = evaluerTaches(donnees([wf({ fichier: 'nuit.yml', dernier_debut: il(3 * J) })]), MAINTENANT);
    const x = parId(s, 'taches:nuit.yml');
    expect(x?.niveau).toBe('attention');
    expect(x?.detail).toContain('aurait dû tourner');
  });

  it('quotidien : un passage retardé de 6 h par GitHub n’est pas encore un retard', () => {
    // 09:00 : le passage de 03:00 n'est pas parti (GitHub a déjà retardé de 7 h) ;
    // le dernier run est celui d'hier 03:00.
    const neuf = new Date('2026-11-03T09:00:00Z');
    const hier = new Date('2026-11-02T03:02:00Z').toISOString();
    const s = evaluerTaches(
      donnees([wf({ fichier: 'nuit.yml', dernier_debut: hier, collecte_at: il(10 * 60_000, neuf) })], { collecteAt: il(10 * 60_000, neuf) }),
      neuf,
    );
    expect(parId(s, 'taches:nuit.yml')).toBeUndefined();
  });

  it('quotidien lun-ven mort le mardi : détecté le mercredi (pas une semaine plus tard)', () => {
    const mercredi = new Date('2026-11-04T12:00:00Z');
    const lundi = new Date('2026-11-02T16:35:00Z').toISOString();
    const s = evaluerTaches(
      donnees([wf({ fichier: 'alerts.yml', crons: ['30 16 * * 1-5'], dernier_debut: lundi, collecte_at: il(10 * 60_000, mercredi) })], {
        collecteAt: il(10 * 60_000, mercredi),
      }),
      mercredi,
    );
    expect(parId(s, 'taches:alerts.yml')?.niveau).toBe('attention');
    expect(parId(s, 'taches:alerts.yml')?.detail).toContain('aurait dû tourner');
  });

  it('cron toutes les 15 min arrêté depuis 50 min : détecté', () => {
    const s = evaluerTaches(
      donnees([wf({ fichier: 'intraday.yml', crons: ['*/15 * * * *'], dernier_debut: il(50 * 60_000) })]),
      MAINTENANT,
    );
    expect(parId(s, 'taches:intraday.yml')?.niveau).toBe('attention');
  });

  it('échec au démarrage (YAML cassé) : vu comme un échec, pas comme un workflow sain', () => {
    const s = evaluerTaches(donnees([wf({ fichier: 'casse.yml', derniere_conclusion: 'startup_failure', echecs_consecutifs: 1 })]), MAINTENANT);
    expect(parId(s, 'taches:casse.yml')?.niveau).toBe('attention');
    expect(parId(s, 'taches:planifies')).toBeUndefined();
  });

  it('dernier run en cours après 5 échecs : alerte (le compteur fait foi)', () => {
    const s = evaluerTaches(
      donnees([wf({ fichier: 'a.yml', dernier_statut: 'in_progress', derniere_conclusion: null, dernier_debut: il(5 * 60_000), echecs_consecutifs: 5 })]),
      MAINTENANT,
    );
    expect(parId(s, 'taches:a.yml')?.niveau).toBe('alerte');
    expect(parId(s, 'taches:a.yml')?.detail).toContain('5 échecs consécutifs');
  });

  it('dernier run annulé après 2 échecs : alerte, pas une simple annulation', () => {
    const s = evaluerTaches(donnees([wf({ fichier: 'a.yml', derniere_conclusion: 'cancelled', echecs_consecutifs: 2 })]), MAINTENANT);
    expect(parId(s, 'taches:a.yml')?.niveau).toBe('alerte');
  });

  it('week-end : un cron lundi-vendredi n’est PAS en retard le dimanche', () => {
    const dimanche = new Date('2026-11-01T20:00:00Z');
    const vendredi = new Date('2026-10-30T18:00:00Z').toISOString();
    const s = evaluerTaches(
      donnees([wf({ fichier: 'video.yml', crons: ['0 18 * * 1-5'], dernier_debut: vendredi, collecte_at: il(10 * 60_000, dimanche) })], {
        collecteAt: il(10 * 60_000, dimanche),
      }),
      dimanche,
    );
    expect(parId(s, 'taches:video.yml')).toBeUndefined();
    expect(parId(s, 'taches:planifies')?.niveau).toBe('ok');
  });

  it('aucun run connu pour un workflow planifié → attention', () => {
    const s = evaluerTaches(donnees([wf({ fichier: 'neuf.yml', dernier_debut: null, derniere_conclusion: null, dernier_statut: null })]), MAINTENANT);
    expect(parId(s, 'taches:neuf.yml')?.niveau).toBe('attention');
  });

  it('cron illisible → on ne conclut pas sur le retard (inconnu)', () => {
    const s = evaluerTaches(donnees([wf({ fichier: 'bizarre.yml', crons: ['@daily'] })]), MAINTENANT);
    expect(parId(s, 'taches:bizarre.yml')?.niveau).toBe('inconnu');
  });

  it('run in_progress depuis plus de 2 h → attention', () => {
    const s = evaluerTaches(
      donnees([wf({ fichier: 'long.yml', dernier_statut: 'in_progress', derniere_conclusion: null, dernier_debut: il(3 * H) })]),
      MAINTENANT,
    );
    const x = parId(s, 'taches:long.yml');
    expect(x?.niveau).toBe('attention');
    expect(x?.detail).toContain('en cours depuis');
  });

  it('run in_progress depuis 30 min → rien à signaler', () => {
    const s = evaluerTaches(
      donnees([wf({ fichier: 'long.yml', dernier_statut: 'in_progress', derniere_conclusion: null, dernier_debut: il(30 * 60_000) })]),
      MAINTENANT,
    );
    expect(parId(s, 'taches:long.yml')).toBeUndefined();
  });

  it('le pire constat l’emporte quand un workflow cumule les problèmes', () => {
    const s = evaluerTaches(
      donnees([wf({ fichier: 'a.yml', derniere_conclusion: 'failure', echecs_consecutifs: 4, dernier_debut: il(5 * J) })]),
      MAINTENANT,
    );
    const x = parId(s, 'taches:a.yml');
    expect(x?.niveau).toBe('alerte');
    expect(x?.detail).toContain('4 échecs consécutifs');
    expect(x?.detail).toContain('aurait dû tourner');
  });

  it('un workflow supprimé n’est pas une alerte', () => {
    const s = evaluerTaches(donnees([wf({ fichier: 'vieux.yml', etat: 'deleted' })]), MAINTENANT);
    expect(s.some((x) => x.niveau === 'alerte')).toBe(false);
  });
});

describe('evaluerTaches — workflows manuels', () => {
  it('un seul signal récapitulatif ok avec leur nombre', () => {
    const s = evaluerTaches(
      donnees([wf({ fichier: 'm1.yml', crons: [] }), wf({ fichier: 'm2.yml', crons: [] }), wf({ fichier: 'm3.yml', crons: [], dernier_debut: il(90 * J) })]),
      MAINTENANT,
    );
    const manuels = s.filter((x) => x.id === 'taches:manuels');
    expect(manuels).toHaveLength(1);
    expect(manuels[0].niveau).toBe('ok');
    expect(manuels[0].detail).toContain('3 workflows');
    expect(parId(s, 'taches:m1.yml')).toBeUndefined();
  });

  it('échec récent (< 7 j) → attention, en le nommant', () => {
    const s = evaluerTaches(
      donnees([wf({ fichier: 'm1.yml', crons: [] }), wf({ fichier: 'deploy.yml', crons: [], derniere_conclusion: 'failure', dernier_debut: il(2 * J) })]),
      MAINTENANT,
    );
    const x = parId(s, 'taches:manuels');
    expect(x?.niveau).toBe('attention');
    expect(x?.detail).toContain('deploy');
  });

  it('échec ancien (> 7 j) → reste ok', () => {
    const s = evaluerTaches(
      donnees([wf({ fichier: 'deploy.yml', crons: [], derniere_conclusion: 'failure', dernier_debut: il(10 * J) })]),
      MAINTENANT,
    );
    expect(parId(s, 'taches:manuels')?.niveau).toBe('ok');
  });
});

describe('evaluerTaches — collecte périmée', () => {
  it('collecte absente → signal inconnu « Collecte des workflows »', () => {
    const s = evaluerTaches(donnees([], { collecteAt: null }), MAINTENANT);
    const x = parId(s, 'taches:collecte');
    expect(x?.niveau).toBe('inconnu');
    expect(x?.titre).toBe('Collecte des workflows');
  });

  it('collecte de plus de 2 h → tout signal de workflow passe en inconnu, aucun faux ok', () => {
    const vieux = il(5 * H);
    const s = evaluerTaches(
      donnees(
        [wf({ fichier: 'a.yml', collecte_at: vieux }), wf({ fichier: 'b.yml', collecte_at: vieux, etat: 'disabled_manually' }), wf({ fichier: 'm.yml', crons: [], collecte_at: vieux })],
        { collecteAt: vieux },
      ),
      MAINTENANT,
    );
    expect(parId(s, 'taches:collecte')?.niveau).toBe('inconnu');
    const workflows = s.filter((x) => x.id !== 'taches:scraper');
    expect(workflows.length).toBeGreaterThan(1);
    expect(workflows.every((x) => x.niveau === 'inconnu')).toBe(true);
  });

  it('collecte fraîche → pas de signal de collecte en défaut', () => {
    const s = evaluerTaches(donnees([wf({ fichier: 'a.yml' })]), MAINTENANT);
    const x = parId(s, 'taches:collecte');
    expect(x === undefined || x.niveau === 'ok').toBe(true);
  });
});

describe('evaluerTaches — commandes du scraper', () => {
  const scraper = (total: number, echecs: number, extra: { partiels?: number; bloques?: { total: number; plusAncien: string | null } } = {}) =>
    parId(
      evaluerTaches(
        donnees([wf({ fichier: 'a.yml' })], {
          scraperRuns24h: { total, echecs, dernierEchec: echecs ? il(3 * H) : null, partiels: extra.partiels ?? 0, bloques: extra.bloques ?? { total: 0, plusAncien: null } },
        }),
        MAINTENANT,
      ),
      'taches:scraper',
    );

  it('exécutions bloquées « en cours » depuis plus de 2 h : attention, jamais invisibles', () => {
    const x = scraper(70, 0, { bloques: { total: 2, plusAncien: '2026-08-06T11:08:13Z' } });
    expect(x?.niveau).toBe('attention');
    expect(x?.detail).toContain('2 exécutions bloquées');
  });

  it('exécutions partielles sur 24 h : attention', () => {
    const x = scraper(70, 0, { partiels: 2 });
    expect(x?.niveau).toBe('attention');
    expect(x?.detail).toContain('2 partielles');
  });

  it('aucun échec → ok, avec chiffres et lien', () => {
    const x = scraper(70, 0);
    expect(x?.niveau).toBe('ok');
    expect(x?.titre).toBe('Commandes du scraper');
    expect(x?.detail).toContain('70');
    expect(x?.lien).toBe('/admin/scraping');
  });

  it('un échec → attention', () => {
    expect(scraper(70, 1)?.niveau).toBe('attention');
  });

  it('trois échecs → alerte', () => {
    const x = scraper(70, 3);
    expect(x?.niveau).toBe('alerte');
    expect(x?.detail).toContain('3 échecs sur 70');
    expect(x?.detail).toContain('il y a 3 h');
  });

  it('25 % d’échecs → alerte même sous 3 échecs', () => {
    expect(scraper(8, 2)?.niveau).toBe('alerte');
  });

  it('aucune exécution en 24 h → pas un ok (rien ne prouve que le scraper tourne)', () => {
    expect(scraper(0, 0)?.niveau).not.toBe('ok');
  });

  it('reste lisible même si la collecte des workflows est périmée', () => {
    const vieux = il(5 * H);
    const s = evaluerTaches(donnees([wf({ fichier: 'a.yml', collecte_at: vieux })], { collecteAt: vieux }), MAINTENANT);
    expect(parId(s, 'taches:scraper')?.niveau).toBe('ok');
  });
});

describe('relatif', () => {
  it('formats simples', () => {
    expect(relatif(il(5 * 60_000), MAINTENANT)).toBe('il y a 5 min');
    expect(relatif(il(3 * H), MAINTENANT)).toBe('il y a 3 h');
    expect(relatif(il(2 * J), MAINTENANT)).toBe('il y a 2 j');
    expect(relatif(il(10_000), MAINTENANT)).toBe("à l'instant");
  });
});
