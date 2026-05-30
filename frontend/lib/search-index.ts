export interface SearchItem {
  kind: 'action' | 'secteur' | 'page';
  label: string;
  sublabel?: string;
  href: string;
  searchKey: string;
  emoji: string;
}

const STATIC_PAGES: SearchItem[] = [
  { kind: 'page', label: 'Dashboard', href: '/', searchKey: 'dashboard accueil', emoji: '📊' },
  { kind: 'page', label: 'Actions', href: '/actions', searchKey: 'actions marché bourse', emoji: '📈' },
  { kind: 'page', label: 'Obligations', href: '/obligations', searchKey: 'obligations dette taux', emoji: '📄' },
  { kind: 'page', label: 'Dividendes', href: '/dividendes', searchKey: 'dividendes rendement distribution', emoji: '💰' },
  { kind: 'page', label: 'Signaux', href: '/signaux', searchKey: 'signaux opportunités scoring', emoji: '🔬' },
  { kind: 'page', label: 'Portefeuille', href: '/portefeuille', searchKey: 'portefeuille watchlist positions alertes', emoji: '💼' },
  { kind: 'page', label: 'Backtest', href: '/backtest', searchKey: 'backtest stratégie simulation historique', emoji: '🧪' },
  { kind: 'page', label: 'Rapports', href: '/dashboard/reports', searchKey: 'rapports événements analyse', emoji: '📑' },
  { kind: 'page', label: 'Méthodologie', href: '/methodologie', searchKey: 'méthodologie scoring explications', emoji: '📖' },
];

export function buildSearchItems(args: {
  instruments: Array<{ code: string; designation: string | null; secteur: string | null }>;
}): SearchItem[] {
  const actionItems: SearchItem[] = args.instruments.map((inst) => ({
    kind: 'action',
    label: inst.code,
    sublabel: inst.designation ?? undefined,
    href: `/actions/${inst.code}`,
    searchKey: `${inst.code} ${inst.designation ?? ''} ${inst.secteur ?? ''}`.toLowerCase(),
    emoji: '📈',
  }));

  const secteurSet = new Set<string>();
  const secteurItems: SearchItem[] = [];
  for (const inst of args.instruments) {
    if (inst.secteur && !secteurSet.has(inst.secteur)) {
      secteurSet.add(inst.secteur);
      secteurItems.push({
        kind: 'secteur',
        label: inst.secteur,
        sublabel: 'Secteur',
        href: `/secteurs?focus=${encodeURIComponent(inst.secteur)}`,
        searchKey: `secteur ${inst.secteur}`.toLowerCase(),
        emoji: '🏭',
      });
    }
  }

  return [...actionItems, ...secteurItems, ...STATIC_PAGES];
}

function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function fuzzyFilter(
  items: SearchItem[],
  query: string,
  limit = 50,
): SearchItem[] {
  if (!query.trim()) {
    return items.slice(0, limit);
  }

  const normalizedQuery = normalize(query.trim());
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return items
    .filter((item) => {
      const key = normalize(item.searchKey);
      return terms.every((term) => key.includes(term));
    })
    .slice(0, limit);
}
