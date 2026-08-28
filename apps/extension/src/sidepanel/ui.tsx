/**
 * The web app's ui primitives (apps/web/src/components/ui), reproduced here
 * because the extension is a separate Vite root. Keep them byte-for-byte in
 * step with the originals; the point is that the panel reads as the app.
 */
import { useId } from 'react';
import type {
  ButtonHTMLAttributes,
  ElementType,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  SVGProps,
  TextareaHTMLAttributes,
} from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white border border-transparent hover:opacity-90',
  secondary: 'bg-surface text-ink border border-border hover:bg-surface-3',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-surface-3',
};

const SIZES: Record<Size, string> = {
  md: 'h-9 px-4 text-base',
  sm: 'h-[30px] px-3 text-sm',
};

export function Button({ variant = 'secondary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={[
        'focus-ring inline-flex items-center justify-center gap-2 rounded-control font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...props}
    />
  );
}

interface CardProps {
  as?: ElementType;
  id?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ as: Tag = 'div', id, className = '', children }: CardProps) {
  return (
    <Tag id={id} className={`rounded-card border border-border bg-surface ${className}`}>
      {children}
    </Tag>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="text-2xs font-semibold uppercase tracking-[0.04em] text-ink-3">{children}</span>;
}

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'off';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-2',
  accent: 'bg-accent-soft text-accent-ink',
  ok: 'bg-ok-bg text-ok-fg',
  warn: 'bg-warn-bg text-warn-fg',
  off: 'bg-off-bg text-off-fg',
};

const CHIP_SIZES: Record<Size, string> = {
  md: 'px-2.5 py-1 text-sm',
  sm: 'px-2 py-0.5 text-2xs',
};

export function Chip({ tone = 'neutral', size = 'md', children }: { tone?: Tone; size?: Size; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-chip font-medium ${CHIP_SIZES[size]} ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export const fieldClass =
  'focus-ring w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3';

type Common = { label: string; hint?: ReactNode };
type InputProps = Common & { as?: 'input' } & InputHTMLAttributes<HTMLInputElement>;
type AreaProps = Common & { as: 'textarea' } & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Field(props: InputProps | AreaProps) {
  const id = useId();
  const isArea = props.as === 'textarea';
  const {
    label,
    hint,
    className = '',
    ...rest
  } = props as Common & {
    as?: string;
    className?: string;
  };
  delete (rest as Record<string, unknown>).as;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink-2">
          {label}
        </label>
        {hint && <span className="text-xs text-ink-3">{hint}</span>}
      </div>
      {isArea ? (
        <textarea
          id={id}
          className={`${fieldClass} min-h-[72px] resize-none py-2.5 leading-relaxed ${className}`}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input id={id} className={`${fieldClass} h-9 ${className}`} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
    </div>
  );
}

export function Select({
  label,
  className = '',
  children,
  ...rest
}: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      <select id={id} className={`focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink ${className}`} {...rest}>
        {children}
      </select>
    </div>
  );
}

/** Stroke icons in the sidebar's style: 24-box, 1.9 stroke, round caps. */
const ICONS = {
  logo: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  check: <path d="M5 12l4 4L19 7" />,
  alert: (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9L2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  passkey: (
    <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004.07 9" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />,
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 1 1 4 0v4M12 10v7" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a1 1 0 0 1 1-1h10" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </>
  ),
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16, className, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {ICONS[name]}
    </svg>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent"
      style={{ width: size, height: size }}
    />
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Web app Avatar: initials on the soft accent tint. Shows the LinkedIn
 *  photo when one was captured. */
export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="shrink-0 rounded-full border border-border object-cover"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-ink"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

/** Inline status line in the web app's notice style (warn-bg/ok-bg with the
 *  matching dot colour as a border - never an opacity modifier on a var()). */
export function Notice({ tone, children }: { tone: 'ok' | 'warn' | 'accent' | 'off'; children: ReactNode }) {
  const classes = {
    ok: 'border-ok-dot bg-ok-bg text-ok-fg',
    warn: 'border-warn-dot bg-warn-bg text-warn-fg',
    accent: 'border-sel-ring bg-sel-bg text-accent-ink',
    off: 'border-border bg-off-bg text-off-fg',
  }[tone];
  return <div className={`flex items-start gap-2 rounded-control border px-3 py-2 text-sm ${classes}`}>{children}</div>;
}
