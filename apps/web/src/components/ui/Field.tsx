import { useId } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const fieldClass =
  'focus-ring w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3';

type Common = { label: string; hint?: string };
type InputProps = Common & { as?: 'input' } & InputHTMLAttributes<HTMLInputElement>;
type AreaProps = Common & { as: 'textarea' } & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Field(props: InputProps | AreaProps) {
  const id = useId();
  const isArea = props.as === 'textarea';
  const { label, hint, className = '', ...rest } = props as Common & {
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
          className={`${fieldClass} min-h-[96px] resize-none py-2.5 leading-relaxed ${className}`}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={id}
          className={`${fieldClass} h-9 ${className}`}
          {...(rest as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
    </div>
  );
}
