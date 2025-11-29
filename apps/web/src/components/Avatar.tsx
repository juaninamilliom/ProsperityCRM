interface AvatarProps {
  name?: string;
}

export function Avatar({ name }: AvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
    : '??';

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-fuchsia text-white shadow-soft">
      <span className="text-sm font-semibold">{initials}</span>
    </div>
  );
}
