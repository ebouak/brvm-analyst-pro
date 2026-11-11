import { describe, expect, it } from 'vitest';
import { parseReponseIA } from './parseAnalyse';
import { FINANCIAL_DISCLAIMER } from '@/lib/legal/disclaimer';

const REPONSE = `## SONATEL — SNTS

## Fondamentaux
| Indicateur | Valeur | Médiane du secteur |
|---|---|---|
| PER | 12,3x | 11,0x |

## Lecture des indicateurs
| Angle | Ce que montrent les données |
|---|---|
| Tendance technique | haussière : cours au-dessus de la MM50 |

## Points de vigilance
- Liquidité moyenne sur les 30 dernières séances.
`;

describe('parseReponseIA', () => {
  it('découpe les sections sans aucun champ de recommandation', () => {
    const d = parseReponseIA(REPONSE, 'SNTS');
    expect(d.sections.map((s) => s.titre)).toEqual(['SONATEL — SNTS', 'Fondamentaux', 'Lecture des indicateurs', 'Points de vigilance']);
    expect(d.sections[1]!.tableaux?.[0]?.rows[0]).toEqual(['PER', '12,3x', '11,0x']);
    for (const cle of ['signal', 'scoreConviction', 'recommendation', 'actionsAnalysees']) {
      expect(d).not.toHaveProperty(cle);
    }
  });

  it("porte l'avertissement centralisé, pas celui du texte", () => {
    expect(parseReponseIA(REPONSE, 'SNTS').disclaimer).toBe(FINANCIAL_DISCLAIMER);
  });
});
