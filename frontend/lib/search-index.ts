import { NAV_GROUPS, PALETTE_EXTRA } from '@/lib/nav';

export interface SearchItem {
  kind: 'action' | 'secteur' | 'page';
  label: string;
  sublabel?: string;
  href: string;
  searchKey: string;
  emoji: string;
}

/**
 * Pages indexées = navigation (NAV_GROUPS) + routes hors-menu (PALETTE_EXTRA).
 * Source unique avec la sidebar : la palette ⌘K trouve TOUT, y compris les
 * pages sorties du menu à la refonte nav 2026-07-10.
 */
const STATIC_PAGES: SearchItem[] = [
  ...NAV_GROUPS.filter((g) => !g.adminOnly).flatMap((g) =>
    g.items.map((it) => ({
      kind: 'page' as const,
      label: it.label,
      sublabel: g.label,
      href: it.href,
      searchKey: `${it.label} ${g.label}`.toLowerCase(),
      emoji: '📄',
    })),
  ),
  ...PALETTE_EXTRA.map((it) => ({
    kind: 'page' as const,
    label: it.label,
    sublabel: 'Autres pages',
    href: it.href,
    searchKey: it.label.toLowerCase(),
    emoji: '📄',
  })),
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
