// Avatar utilisateur générique : photo si disponible, sinon initiales sur un
// dégradé déterministe (cyan→émeraude par défaut). Pas de dépendance forum.

const SIZES = { sm: 28, md: 36, lg: 64, xl: 96 } as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export default function UserAvatar({
  src, name, size = 'md', className = '',
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = SIZES[size];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} width={px} height={px}
        className={`shrink-0 rounded-full object-cover border border-accent/50 ${className}`}
        style={{ width: px, height: px }} />
    );
  }
  return (
    <span
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-bg bg-gradient-to-br from-accent to-up ${className}`}
      style={{ width: px, height: px, fontSize: px * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}
