import type { ElementType, ReactNode } from 'react';

interface CardProps {
  as?: ElementType;
  /** Forwarded so a Card can be an anchor target (the user guide links to its sections). */
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
  return (
    <span className="text-2xs font-semibold uppercase tracking-[0.04em] text-ink-3">
      {children}
    </span>
  );
}
