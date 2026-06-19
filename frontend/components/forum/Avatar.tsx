import type { AuthorProfile } from '@/lib/forum/types';
import { displayName } from '@/lib/forum/identity';

/** Palette d'avatars (déterministe par auteur) — teintes DeFi/finance sobres. */
const PALETTE = [
  ['#56d7fd', '#0a2933'],
  ['#3fe18b', '#0b2a1c'],
  ['#f0b23a', '#2e2310'],
  ['#b18cff', '#221a33'],
  ['#ff8f6b', '#2e1810'],
  ['#6bb8ff', '#101f2e'],
];

function seedIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Avatar à initiales (cercle coloré déterministe). Pas de photo stockée en base
 * pour l'instant — ce repli évite d'inventer une image et reste cohérent visuellement.
 */
export function Avatar({ profile, size = 36 }: { profile: AuthorProfile | null; size?: number }) {
  const name = displayName(profile);
  const [fg, bg] = profile ? PALETTE[seedIndex(profile.id)]! : ['#8b93a7', '#161922'];
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold tabular"
      style={{ width: size, height: size, backgroundColor: bg, color: fg, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}
