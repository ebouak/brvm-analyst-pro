import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { chargerDonneesRecherche } from '../donnees';
import { construireInstantane, type DonneesSociete } from '../instantane';
import { rechercheMotsCles } from '../motsCles';
import { classerParJev } from '../jev';
import { validerReponseJev } from '../validerJev';
import { resultatsJev } from '../decision';
import { VERSION_DICTIONNAIRE } from '../dictionnaire';
import { JEU, satisfait } from './jeu';
import type { ResultatRecherche, StatutRecherche } from '../types';

interface Mesures {
  p3: number[];
  respect: { ok: number; total: number };
  aucune: { ok: number; total: number };
  inventes: number;
  echecs: number;
}
type Sortie = { statut: StatutRecherche; resultats: ResultatRecherche[] };
const vides = (): Mesures => ({ p3: [], respect: { ok: 0, total: 0 }, aucune: { ok: 0, total: 0 }, inventes: 0, echecs: 0 });
const taux = (x: { ok: number; total: number }) => (x.total ? x.ok / x.total : 1);
const moyenne = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

describe('évaluation de la recherche (manuelle — appels payants)', () => {
  it(
    'Jev contre le repli, sur le jeu figé',
    async () => {
      const r = await chargerDonneesRecherche(
        createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } }),
      );
      expect(r).not.toBeNull();
      const inst = construireInstantane(r!.donnees, r!.dateSeance);
      const parCode = new Map<string, DonneesSociete>(r!.donnees.map((d) => [d.code, d]));
      const faitsConnus = new Map(inst.fiches.map((f) => [f.code, new Set(f.faits.map((x) => `${x.cle}|${x.valeur}`))]));
      const m = { jev: vides(), repli: vides() };

      const noter = (mes: Mesures, i: number, sortie: Sortie) => {
        const cas = JEU[i]!;
        const satisfiables = r!.donnees.filter((d) => satisfait(cas, d)).length;
        const aucuneAttendue = cas.aucuneAttendue ?? (cas.contraintes.length > 0 && satisfiables === 0);
        for (const res of sortie.resultats) for (const f of res.faits) if (!faitsConnus.get(res.code)?.has(`${f.cle}|${f.valeur}`)) mes.inventes += 1;
        if (aucuneAttendue) {
          mes.aucune.total += 1;
          if (sortie.statut === 'aucune') mes.aucune.ok += 1;
          return;
        }
        const ok = (res: ResultatRecherche) => satisfait(cas, parCode.get(res.code)!);
        const denom = Math.min(3, satisfiables);
        mes.p3.push(denom ? sortie.resultats.slice(0, 3).filter(ok).length / denom : 0);
        mes.respect.total += sortie.resultats.length;
        mes.respect.ok += sortie.resultats.filter(ok).length;
      };

      for (let i = 0; i < JEU.length; i += 1) {
        const cas = JEU[i]!;
        noter(m.repli, i, rechercheMotsCles(cas.q, inst.fiches));
        let sortieJev: Sortie = { statut: 'aucune', resultats: [] };
        try {
          const v = validerReponseJev(await classerParJev(cas.q, inst.fiches, AbortSignal.timeout(20_000)), inst.fiches.map((f) => f.code));
          if (v) sortieJev = resultatsJev(v, inst.fiches);
          else m.jev.echecs += 1;
        } catch {
          m.jev.echecs += 1;
        }
        noter(m.jev, i, sortieJev);
      }

      const ligne = (x: Mesures) => ({
        'précision top 3': moyenne(x.p3).toFixed(3),
        'respect des contraintes': taux(x.respect).toFixed(3),
        'absence juste': taux(x.aucune).toFixed(3),
        'faits inventés': x.inventes,
        'échecs fournisseur': x.echecs,
      });
      console.log(`Instantané ${inst.snapshotId} · dictionnaire ${VERSION_DICTIONNAIRE} · ${JEU.length} recherches`);
      console.table({ Jev: ligne(m.jev), Repli: ligne(m.repli) });
      const lancement =
        moyenne(m.jev.p3) > moyenne(m.repli.p3) &&
        taux(m.jev.respect) > taux(m.repli.respect) &&
        taux(m.jev.aucune) >= taux(m.repli.aucune) &&
        m.jev.inventes === 0;
      console.log(`Règle de lancement : ${lancement ? 'SATISFAITE — Jev bat le repli' : 'NON SATISFAITE — garder le repli'}`);

      expect(m.jev.inventes).toBe(0);
      expect(m.repli.inventes).toBe(0);
    },
    900_000,
  );
});
