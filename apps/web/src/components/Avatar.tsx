interface AvatarProps {
  name?: string;
  size?: number;
}

export function Avatar({ name, size = 28 }: AvatarProps) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const initials = parts.length ? ((parts[0][0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() : '?';

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-ink"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </div>
  );
}
