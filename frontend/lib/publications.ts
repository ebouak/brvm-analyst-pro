export const PUBLICATION_TYPES = [
  { value: 'etats_financiers', label: 'États financiers',   color: 'up'     },
  { value: 'ag',               label: 'Assemblée générale', color: 'blue'   },
  { value: 'rapport',          label: "Rapport d'activités", color: 'warn'  },
  { value: 'bilan',            label: 'Bilan liquidité',    color: 'purple' },
  { value: 'notation',         label: 'Notation',           color: 'down'   },
  { value: 'avis',             label: 'Avis',               color: 'muted'  },
  { value: 'autre',            label: 'Autre',              color: 'border' },
] as const;

export type PublicationType = typeof PUBLICATION_TYPES[number]['value'];

export function labelForType(t: string): string {
  const found = PUBLICATION_TYPES.find((p) => p.value === t);
  return found ? found.label : t;
}

export function colorClassesForType(t: string): { bg: string; text: string } {
  const found = PUBLICATION_TYPES.find((p) => p.value === t);
  const color = found ? found.color : 'border';

  const map: Record<string, { bg: string; text: string }> = {
    up:     { bg: 'bg-up/15',     text: 'text-up'     },
    blue:   { bg: 'bg-blue/15',   text: 'text-blue'   },
    warn:   { bg: 'bg-warn/15',   text: 'text-warn'   },
    purple: { bg: 'bg-purple/15', text: 'text-purple' },
    down:   { bg: 'bg-down/15',   text: 'text-down'   },
    muted:  { bg: 'bg-muted/15',  text: 'text-muted'  },
    border: { bg: 'bg-border',    text: 'text-muted'  },
  };

  return map[color] ?? { bg: 'bg-border', text: 'text-muted' };
}
