import { describe, it, expect, vi } from 'vitest';
import { rechercher, type DepsRecherche, type EntreeCache, type StockageRecherche } from './orchestrer';
import { construireInstantane } from './instantane';
import { empreinte } from './normaliser';
import { CLE_GLOBALE } from './jev';
import type { CleCache, ResultatJevValide } from './types';

const instantane = construireInstantane(
  [
    { code: 'SGBC', nom: 'SGCI', secteur: 'Services financiers', activite: 'banque', pays: 'CI', rendement: null, liquidite: 'B', perf12m: null },
    { code: 'SNTS', nom: 'Sonatel', secteur: 'Télécommunications', activite: null, pays: 'SN', rendement: null, liquidite: 'A', perf12m: null },
  ],
  '2026-11-04',
);
const Q = 'une banque ivoirienne confidentielle';
const brutJev = { model: 'jev-1', answers: { SGBC: { type: 'noul', noul: 0.92 }, SNTS: { type: 'noul', noul: 0.04 }, [CLE_GLOBALE]: { type: 'noul', noul: 0.9 } } };

/** Stockage en mémoire, atomique comme les fonctions SQL. */
function memoire() {
  const lignes = new Map<string, EntreeCache>();
  const k = (c: CleCache) => `${c.empreinte}|${c.snapshotId}`;
  const s: StockageRecherche & { lignes: typeof lignes } = {
    lignes,
    lire: async (c) => lignes.get(k(c)) ?? null,
    verrouiller: async (c) => {
      if (lignes.has(k(c))) return false;
      lignes.set(k(c), { etat: 'en_cours', resultat: null });
      return true;
    },
    ecrire: async (c, r: ResultatJevValide) => {
      lignes.set(k(c), { etat: 'prete', resultat: r });
    },
    liberer: async (c) => {
      if (lignes.get(k(c))?.etat === 'en_cours') lignes.delete(k(c));
    },
  };
  return s;
}

function deps(o: Partial<DepsRecherche> = {}): DepsRecherche & { journaux: unknown[][] } {
  const journaux: unknown[][] = [];
  return {
    journaux,
    instantane: async () => instantane,
    utilisateur: async () => ({ id: 'u1', email: null }),
    eligible: async () => true,
    quota: async () => true,
    stockage: memoire(),
    reserverBudget: async () => 'ok',
    jev: vi.fn(async () => brutJev),
    attendre: (ms) => new Promise((r) => setTimeout(r, ms)),
    journal: (...args) => journaux.push(args),
    delaiJevMs: 200,
    attenteMs: 5,
    attenteEssais: 40,
    ...o,
  };
}

describe('recherche : flux nominal', () => {
  it('appelle Jev, valide, met en cache et renvoie les faits de l’instantané', async () => {
    const d = deps();
    const r = await rechercher(Q, d);
    expect(r).toMatchObject({ mode: 'jev', raison: null, cache: false, statut: 'partielle', snapshotId: instantane.snapshotId, actualiseLe: '2026-11-04' });
    expect(r.resultats.map((x) => x.code)).toEqual(['SGBC']);
    expect(r.resultats[0]!.faits).toEqual(instantane.fiches.find((f) => f.code === 'SGBC')!.faits);
    expect(d.jev).toHaveBeenCalledTimes(1);
  });
});

describe('recherche : invariants', () => {
  it('Accès — non connecté : mots-clés, Jev jamais appelé', async () => {
    const d = deps({ utilisateur: async () => null });
    expect(await rechercher(Q, d)).toMatchObject({ mode: 'mots-cles', raison: 'non_connecte' });
    expect(d.jev).not.toHaveBeenCalled();
  });

  it('Accès — compte non éligible : jamais de réponse Jev, même en cache', async () => {
    const d = deps({ eligible: async () => false });
    await d.stockage.ecrire({ empreinte: empreinte(Q), snapshotId: instantane.snapshotId }, { scores: { SGBC: 1, SNTS: 0 }, pertinenceGlobale: 1, modele: 'm' });
    const lire = vi.spyOn(d.stockage, 'lire');
    expect(await rechercher(Q, d)).toMatchObject({ mode: 'mots-cles', raison: 'offre_non_eligible', cache: false });
    expect(lire).not.toHaveBeenCalled();
  });

  it('Quota — une réponse en cache ne consomme ni quota ni budget', async () => {
    const quota = vi.fn(async () => true);
    const reserverBudget = vi.fn(async () => 'ok' as const);
    const d = deps({ quota, reserverBudget });
    await rechercher(Q, d);
    const r = await rechercher(Q, d);
    expect(r.cache).toBe(true);
    expect(quota).toHaveBeenCalledTimes(1);
    expect(reserverBudget).toHaveBeenCalledTimes(1);
    expect(d.jev).toHaveBeenCalledTimes(1);
  });

  it('Cache — recherches identiques simultanées : un seul appel Jev', async () => {
    let ouvrir!: () => void;
    const barriere = new Promise<void>((r) => (ouvrir = r));
    const jev = vi.fn(async () => {
      await barriere;
      return brutJev;
    });
    const d = deps({ jev });
    const lot = Promise.all([rechercher(Q, d), rechercher(Q, d), rechercher(Q, d)]);
    setTimeout(ouvrir, 30);
    const reponses = await lot;
    expect(jev).toHaveBeenCalledTimes(1);
    expect(reponses.every((r) => r.mode === 'jev')).toBe(true);
    expect(reponses.filter((r) => r.cache)).toHaveLength(2);
  });

  it('Versionnement — un nouvel instantané invalide l’ancien résultat', async () => {
    const d = deps();
    await d.stockage.ecrire({ empreinte: empreinte(Q), snapshotId: '2026-11-03.ancien' }, { scores: { SGBC: 0, SNTS: 1 }, pertinenceGlobale: 1, modele: 'm' });
    expect((await rechercher(Q, d)).cache).toBe(false);
    expect(d.jev).toHaveBeenCalledTimes(1);
  });

  it('Budget — plafond atteint ou compteur illisible : repli, verrou libéré', async () => {
    const d1 = deps({ reserverBudget: async () => 'refuse' });
    expect(await rechercher(Q, d1)).toMatchObject({ mode: 'mots-cles', raison: 'plafond_atteint' });
    expect((d1.stockage as ReturnType<typeof memoire>).lignes.size).toBe(0);
    const d2 = deps({
      reserverBudget: async () => {
        throw new Error('rpc');
      },
    });
    expect(await rechercher(Q, d2)).toMatchObject({ raison: 'compteur_indisponible' });
    expect(d2.jev).not.toHaveBeenCalled();
  });

  it('Quota atteint : repli, verrou libéré, budget intact', async () => {
    const reserverBudget = vi.fn(async () => 'ok' as const);
    const d = deps({ quota: async () => false, reserverBudget });
    expect(await rechercher(Q, d)).toMatchObject({ raison: 'quota_atteint' });
    expect(reserverBudget).not.toHaveBeenCalled();
    expect((d.stockage as ReturnType<typeof memoire>).lignes.size).toBe(0);
  });

  it.each([
    ['code inconnu', { answers: { ...brutJev.answers, XXXX: { type: 'noul', noul: 0.5 } } }],
    ['score invalide', { answers: { ...brutJev.answers, SGBC: { type: 'noul', noul: 7 } } }],
  ])('Fournisseur — %s : repli jev_indisponible', async (_n, brut) => {
    const d = deps({ jev: async () => brut });
    expect(await rechercher(Q, d)).toMatchObject({ mode: 'mots-cles', raison: 'jev_indisponible' });
    expect((d.stockage as ReturnType<typeof memoire>).lignes.size).toBe(0);
  });

  it('Fournisseur — délai dépassé : repli', async () => {
    const d = deps({
      jev: (_q, _i, signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('abort')))),
      delaiJevMs: 20,
    });
    expect(await rechercher(Q, d)).toMatchObject({ raison: 'jev_indisponible' });
  });

  it('Persistance — échec d’écriture du cache après succès : la réponse reste correcte', async () => {
    const d = deps();
    d.stockage.ecrire = async () => {
      throw new Error('ecriture');
    };
    const r = await rechercher(Q, d);
    expect(r).toMatchObject({ mode: 'jev', cache: false });
    expect(r.resultats[0]!.code).toBe('SGBC');
    expect(d.journaux.some((j) => j[0] === 'cache_ecriture_echec')).toBe(true);
  });

  it('Confidentialité — une exception ne journalise jamais le texte de la requête', async () => {
    const d = deps({
      jev: async (q) => {
        throw new Error(`échec pour « ${q} »`);
      },
    });
    await rechercher(Q, d);
    const d2 = deps({
      stockage: {
        ...memoire(),
        verrouiller: async () => {
          throw new Error(Q);
        },
      },
    });
    await rechercher(Q, d2);
    const tout = JSON.stringify([...d.journaux, ...d2.journaux]);
    expect(tout).not.toContain('confidentielle');
    expect(d.journaux.length + d2.journaux.length).toBeGreaterThan(0);
  });

  it('Données — instantané indisponible : réponse vide, jamais d’erreur', async () => {
    const d = deps({
      instantane: async () => {
        throw new Error('db');
      },
    });
    expect(await rechercher(Q, d)).toEqual({
      mode: 'mots-cles', raison: 'donnees_indisponibles', cache: false, statut: 'aucune', resultats: [], snapshotId: null, actualiseLe: null,
    });
  });
});
