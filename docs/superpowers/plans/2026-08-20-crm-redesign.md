# Prosperity CRM Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current gradient/pill visual language with a tokenised, calm, consumer-grade design system across the four core screens, in light and dark.

**Architecture:** All colour moves into CSS custom properties defined once per theme on `:root` and `:root.dark`. Tailwind's theme maps utility names onto those variables, so components never hardcode colour. A small set of primitives (Button, Field, Chip, Card, StageDot, SectionLabel) carries the new vocabulary; screens are rebuilt on top of them. The existing `useTheme` hook already toggles `.dark` on `<html>` — the token layer plugs straight into it, so no theme plumbing changes.

**Tech Stack:** React 18, TypeScript 5.4, Tailwind 3.4, Vite 5, vitest + @testing-library/react, React Router 6, TanStack Query 5.

**Spec:** Design canvas — https://claude.ai/code/artifact/e0662b1d-3325-4222-ac7b-eea70ed02f86
Artboard sources (read-only reference): `Main/Jobs/Candidate/Form.src.html` + `_tokens.css` in the session scratchpad, mirrored verbatim in Task 1 below.

## Global Constraints

- Node **20.19.4** (`.nvmrc`, `engines`). Run `nvm use` before any npm command.
- Fonts: **Instrument Sans** (400/500/600/700) for UI, **Instrument Serif** (400) for page titles and display numerals. Loaded from Google Fonts in `apps/web/index.html`. Every stack ends `ui-sans-serif, system-ui, sans-serif` / `Georgia, serif`.
- **No component may hardcode a colour.** Colour comes from a token utility (`bg-surface`, `text-ink-2`, `border-border`) or a `var(--token)`. The only literal colours permitted are `#fff` for glyph strokes sitting on an accent fill.
- Radii: controls `9px`, cards `14px`, chips `7px`. **No `rounded-full` on inputs or buttons** — that is the look being replaced. `rounded-full` remains correct for avatars and count pills.
- Control height: **36px** for form fields and primary actions, **34px** for toolbar controls, **30px** for filter chips. Minimum interactive target 30px.
- Type ramp: 11 / 11.5 / 12 / 12.5 / 13 / 15 / 27 / 30px. Body text 13px, `line-height: 1.45`.
- Both themes MUST define the identical set of custom-property names. Task 1 has a test enforcing this.
- Existing behaviour must not regress: drag-and-drop stage moves, filter state in `useFiltersStore`, React Query cache keys, and all API call sites stay as they are. This is a presentation-layer change.
- Every PR must leave `npm run build`, `npm run typecheck`, and `npm run test` green from the repo root.

---

## File Structure

**New:**
- `apps/web/src/styles/tokens.css` — the two token blocks, light and dark. Single source of colour truth.
- `apps/web/src/components/ui/Button.tsx` — variant/size button.
- `apps/web/src/components/ui/Field.tsx` — labelled text input + textarea.
- `apps/web/src/components/ui/Chip.tsx` — skill / flag / status chip.
- `apps/web/src/components/ui/Card.tsx` — bordered surface panel + `SectionLabel`.
- `apps/web/src/components/ui/StageDot.tsx` — stage colour dot + `stageToken()` mapping.
- `apps/web/src/components/ui/index.ts` — barrel.
- `apps/web/src/components/AppSidebar.tsx` — the left nav that replaces the blue header.
- `apps/web/src/components/DetailRail.tsx` — right-hand detail panel shell, shared by pipeline and jobs.
- `apps/web/src/components/StageStepper.tsx` — vertical + horizontal stage progress.
- `apps/web/src/test/setup.ts` — jsdom + jest-dom matchers.

**Modified:**
- `apps/web/index.html` — font links.
- `apps/web/tailwind.config.ts` — theme mapped onto tokens; brand gradient removed.
- `apps/web/src/styles.css` — imports tokens, base styles rewritten.
- `apps/web/vite.config.ts` — vitest jsdom config.
- `apps/web/package.json` — jsdom, jest-dom, user-event.
- `apps/web/src/App.tsx` — sidebar layout.
- `apps/web/src/components/{PipelineBoard,PipelineList,CandidateCard,DraggableCandidateCard,FilterBar,Avatar,Modal,selectStyles}.tsx`
- `apps/web/src/pages/{DashboardPage,JobsPage,JobDealPage,CandidateFormPage,CandidateEditPage,AuthPage,AccountSettingsPage}.tsx`

**PR boundaries** — six PRs, each independently reviewable and shippable:

| PR | Tasks | Deliverable |
|----|-------|-------------|
| 1 | 1–2 | Token layer + test harness. Nothing looks different yet except fonts. |
| 2 | 3–7 | UI primitives, fully tested, not yet adopted. |
| 3 | 8 | Sidebar shell replaces the blue header. |
| 4 | 9–11 | Pipeline board, list, and detail rail. |
| 5 | 12–13 | Jobs list and deal sheet. |
| 6 | 14–15 | Candidate form and candidate detail. |

---

### Task 1: Token layer

**Files:**
- Create: `apps/web/src/styles/tokens.css`
- Modify: `apps/web/src/styles.css`, `apps/web/tailwind.config.ts`, `apps/web/index.html`
- Test: `apps/web/src/styles/tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties `--bg --surface --surface-2 --surface-3 --border --border-soft --ink --ink-2 --ink-3 --accent --accent-soft --accent-ink --sel-bg --sel-ring --shadow --shadow-pop --r-control --r-card --r-chip --stage-sourced --stage-screening --stage-interviewing --stage-offer --stage-placed --stage-rejected --ok-bg --ok-fg --ok-dot --warn-bg --warn-fg --warn-dot --off-bg --off-fg --off-dot --tint-eng-bg --tint-eng-fg --tint-design-bg --tint-design-fg`. Tailwind utilities `bg-app bg-surface bg-surface-2 bg-surface-3 border-border border-border-soft text-ink text-ink-2 text-ink-3 bg-accent text-accent-ink bg-accent-soft rounded-control rounded-card rounded-chip shadow-token shadow-pop font-sans font-serif`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/styles/tokens.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf-8');

function varsInBlock(selector: string): string[] {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`missing block: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return [...css.slice(open, close).matchAll(/(--[a-z0-9-]+)\s*:/g)]
    .map((m) => m[1])
    .sort();
}

describe('design tokens', () => {
  it('defines light and dark with an identical variable set', () => {
    expect(varsInBlock(':root.dark')).toEqual(varsInBlock(':root {'));
  });

  it('defines every stage colour', () => {
    const light = varsInBlock(':root {');
    for (const stage of ['sourced', 'screening', 'interviewing', 'offer', 'placed', 'rejected']) {
      expect(light).toContain(`--stage-${stage}`);
    }
  });

  it('ships no raw hex colours outside glyph white', () => {
    const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    expect(hexes.filter((h) => h !== '#fff' && h !== '#ffffff')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/styles/tokens.test.ts`
Expected: FAIL — `ENOENT` on `tokens.css`.

- [ ] **Step 3: Write `apps/web/src/styles/tokens.css`**

```css
/* Design tokens. Colour is defined here and nowhere else.
   Both blocks must declare the identical set of names — enforced by tokens.test.ts. */
:root {
  --bg: oklch(0.985 0.004 90);
  --surface: #ffffff;
  --surface-2: oklch(0.972 0.005 90);
  --surface-3: oklch(0.955 0.005 90);
  --border: oklch(0.925 0.005 90);
  --border-soft: oklch(0.958 0.004 90);

  --ink: oklch(0.26 0.017 268);
  --ink-2: oklch(0.52 0.016 268);
  --ink-3: oklch(0.64 0.014 268);

  --accent: oklch(0.52 0.13 276);
  --accent-soft: color-mix(in oklab, var(--accent) 9%, white);
  --accent-ink: color-mix(in oklab, var(--accent) 78%, black);
  --sel-bg: color-mix(in oklab, var(--accent) 5%, white);
  --sel-ring: color-mix(in oklab, var(--accent) 22%, white);

  --shadow: 0 1px 2px rgba(20, 22, 32, 0.04);
  --shadow-pop: 0 1px 2px rgba(20, 22, 32, 0.07);

  --r-control: 9px;
  --r-card: 14px;
  --r-chip: 7px;

  --stage-sourced: oklch(0.63 0.07 255);
  --stage-screening: oklch(0.63 0.07 210);
  --stage-interviewing: oklch(0.63 0.07 165);
  --stage-offer: oklch(0.63 0.07 75);
  --stage-placed: oklch(0.63 0.07 140);
  --stage-rejected: oklch(0.63 0.07 20);

  --ok-bg: oklch(0.96 0.03 145);
  --ok-fg: oklch(0.42 0.09 145);
  --ok-dot: oklch(0.63 0.09 145);
  --warn-bg: oklch(0.965 0.03 80);
  --warn-fg: oklch(0.45 0.08 65);
  --warn-dot: oklch(0.68 0.09 75);
  --off-bg: oklch(0.962 0.004 90);
  --off-fg: oklch(0.52 0.012 268);
  --off-dot: oklch(0.72 0.008 268);

  --tint-eng-bg: oklch(0.93 0.035 276);
  --tint-eng-fg: oklch(0.42 0.10 276);
  --tint-design-bg: oklch(0.93 0.035 200);
  --tint-design-fg: oklch(0.42 0.10 200);
}

:root.dark {
  --bg: oklch(0.185 0.012 268);
  --surface: oklch(0.232 0.014 268);
  --surface-2: oklch(0.212 0.013 268);
  --surface-3: oklch(0.268 0.014 268);
  --border: oklch(0.305 0.014 268);
  --border-soft: oklch(0.262 0.013 268);

  --ink: oklch(0.945 0.006 268);
  --ink-2: oklch(0.735 0.013 268);
  --ink-3: oklch(0.60 0.013 268);

  --accent: oklch(0.68 0.14 276);
  --accent-soft: color-mix(in oklab, var(--accent) 26%, oklch(0.232 0.014 268));
  --accent-ink: color-mix(in oklab, var(--accent) 40%, white);
  --sel-bg: color-mix(in oklab, var(--accent) 16%, oklch(0.232 0.014 268));
  --sel-ring: color-mix(in oklab, var(--accent) 34%, oklch(0.185 0.012 268));

  --shadow: 0 1px 2px rgba(0, 0, 0, 0.32);
  --shadow-pop: 0 2px 6px rgba(0, 0, 0, 0.40);

  --r-control: 9px;
  --r-card: 14px;
  --r-chip: 7px;

  --stage-sourced: oklch(0.74 0.10 255);
  --stage-screening: oklch(0.74 0.10 210);
  --stage-interviewing: oklch(0.74 0.10 165);
  --stage-offer: oklch(0.78 0.11 75);
  --stage-placed: oklch(0.74 0.10 140);
  --stage-rejected: oklch(0.70 0.11 20);

  --ok-bg: oklch(0.30 0.05 145);
  --ok-fg: oklch(0.86 0.09 145);
  --ok-dot: oklch(0.74 0.10 145);
  --warn-bg: oklch(0.31 0.05 70);
  --warn-fg: oklch(0.88 0.09 80);
  --warn-dot: oklch(0.78 0.11 75);
  --off-bg: oklch(0.268 0.014 268);
  --off-fg: oklch(0.72 0.012 268);
  --off-dot: oklch(0.55 0.012 268);

  --tint-eng-bg: oklch(0.34 0.06 276);
  --tint-eng-fg: oklch(0.88 0.05 276);
  --tint-design-bg: oklch(0.34 0.06 200);
  --tint-design-fg: oklch(0.88 0.05 200);
}
```

Note the dark `--accent` is lighter (`L 0.68`) than light's (`L 0.52`): a mid indigo that reads well on paper-white goes muddy on a dark ground.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/styles/tokens.test.ts`
Expected: PASS, 3 tests. (Requires Task 2's harness for the jsdom-free node env — this test is pure node, so it passes with the default environment.)

- [ ] **Step 5: Rewrite `apps/web/src/styles.css`**

Replace the whole file:

```css
@import './styles/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    font-family: 'Instrument Sans', ui-sans-serif, system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.45;
    background-color: var(--bg);
    color: var(--ink);
  }

  body {
    @apply min-h-screen;
    background-color: var(--bg);
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
  }

  /* Deliberately no global input/button styling: the pill defaults are what
     this redesign replaces. Controls opt in via the ui/ primitives. */
}

@layer components {
  .focus-ring {
    @apply outline-none;
  }
  .focus-ring:focus-visible {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--sel-ring);
  }
}
```

- [ ] **Step 6: Rewrite `apps/web/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        border: {
          DEFAULT: 'var(--border)',
          soft: 'var(--border-soft)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          ink: 'var(--accent-ink)',
        },
        sel: {
          bg: 'var(--sel-bg)',
          ring: 'var(--sel-ring)',
        },
        stage: {
          sourced: 'var(--stage-sourced)',
          screening: 'var(--stage-screening)',
          interviewing: 'var(--stage-interviewing)',
          offer: 'var(--stage-offer)',
          placed: 'var(--stage-placed)',
          rejected: 'var(--stage-rejected)',
        },
        ok: { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)', dot: 'var(--ok-dot)' },
        warn: { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)', dot: 'var(--warn-dot)' },
        off: { bg: 'var(--off-bg)', fg: 'var(--off-fg)', dot: 'var(--off-dot)' },
      },
      borderRadius: {
        control: 'var(--r-control)',
        card: 'var(--r-card)',
        chip: 'var(--r-chip)',
      },
      boxShadow: {
        token: 'var(--shadow)',
        pop: 'var(--shadow-pop)',
      },
      fontFamily: {
        sans: ['Instrument Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': ['11px', '1.4'],
        xs: ['11.5px', '1.4'],
        sm: ['12.5px', '1.45'],
        base: ['13px', '1.45'],
        lg: ['15px', '1.35'],
        title: ['27px', '1.15'],
        display: ['30px', '1.1'],
      },
    },
  },
  plugins: [],
};

export default config;
```

Tailwind cannot apply opacity modifiers to `var()` colours, so **never** write `bg-accent/20` — use a dedicated token instead.

- [ ] **Step 7: Add fonts in `apps/web/index.html`**

Inside `<head>`, before the stylesheet:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif&display=swap">
```

- [ ] **Step 8: Verify build and commit**

```bash
cd /Users/JuansMacbook/Workspace/ProsperityCRM && nvm use
npm run build && npm run typecheck
git add apps/web/src/styles apps/web/src/styles.css apps/web/tailwind.config.ts apps/web/index.html docs/superpowers/plans
git commit -m "feat(web): add design token layer and map Tailwind theme onto it"
```

Expected: build passes. Screens will look partly unstyled at this point — the old `.glass-card`/`.btn-*`/`.pill-input` classes are gone and their call sites are updated in PRs 3–6. This is intentional and is why PRs 1–2 land together before any screen work.

---

### Task 2: Test harness

**Files:**
- Create: `apps/web/src/test/setup.ts`
- Modify: `apps/web/vite.config.ts`, `apps/web/package.json`
- Test: `apps/web/src/test/setup.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: a jsdom vitest environment with `@testing-library/jest-dom` matchers auto-loaded, so every later task can `render()` components.

- [ ] **Step 1: Install dev dependencies**

```bash
cd /Users/JuansMacbook/Workspace/ProsperityCRM && nvm use
npm install -D --workspace @prosperity/web jsdom@^24.0.0 @testing-library/jest-dom@^6.4.2 @testing-library/user-event@^14.5.2
```

- [ ] **Step 2: Write the failing test**

`apps/web/src/test/setup.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('renders React into jsdom and exposes jest-dom matchers', () => {
    render(<p>pipeline</p>);
    expect(screen.getByText('pipeline')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/test/setup.test.tsx`
Expected: FAIL — `document is not defined` (vitest defaults to the node environment).

- [ ] **Step 4: Write `apps/web/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 5: Add the vitest block to `apps/web/vite.config.ts`**

Add to the `defineConfig` object, after `build`:

```ts
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    css: false,
  },
```

`vite.config.ts` must also gain the triple-slash reference on line 1 so TypeScript knows about the `test` key:

```ts
/// <reference types="vitest" />
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/test/setup.tsx`
Expected: PASS, 1 test.

- [ ] **Step 7: Drop `--passWithNoTests`**

In `apps/web/package.json`, the web app now has tests, so restore a strict runner:

```json
"test": "vitest run",
```

- [ ] **Step 8: Verify and commit**

```bash
cd /Users/JuansMacbook/Workspace/ProsperityCRM && nvm use && npm run test
git add apps/web/vite.config.ts apps/web/package.json apps/web/src/test package-lock.json
git commit -m "test(web): add jsdom harness for component tests"
```

**PR 1 ends here.** Open it: `feat(web): design token layer and test harness`.

---

### Task 3: Button primitive

**Files:**
- Create: `apps/web/src/components/ui/Button.tsx`
- Test: `apps/web/src/components/ui/Button.test.tsx`

**Interfaces:**
- Consumes: Tailwind token utilities from Task 1.
- Produces: `Button({ variant?: 'primary' | 'secondary' | 'ghost', size?: 'md' | 'sm', ...ButtonHTMLAttributes })`. `variant` defaults `'secondary'`, `size` defaults `'md'` (36px) / `'sm'` (30px).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('defaults to the secondary variant', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-surface');
  });

  it('applies the primary variant', () => {
    render(<Button variant="primary">Save</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-accent');
  });

  it('never uses a fully round radius', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button').className).not.toContain('rounded-full');
  });

  it('forwards arbitrary button props', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/ui/Button.test.tsx`
Expected: FAIL — cannot resolve `./Button`.

- [ ] **Step 3: Write the implementation**

```tsx
import type { ButtonHTMLAttributes } from 'react';

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/ui/Button.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Button.tsx apps/web/src/components/ui/Button.test.tsx
git commit -m "feat(web): add Button primitive"
```

---

### Task 4: Field primitive

**Files:**
- Create: `apps/web/src/components/ui/Field.tsx`
- Test: `apps/web/src/components/ui/Field.test.tsx`

**Interfaces:**
- Consumes: Task 1 utilities.
- Produces: `Field({ label, hint?, as?: 'input' | 'textarea', ...props })` rendering a `<label>` wrapping the control, associated by generated id. Exports `fieldClass` for cases needing a bare control (react-select, custom popovers).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './Field';

describe('Field', () => {
  it('associates the label with the control', () => {
    render(<Field label="Full name" />);
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
  });

  it('renders a textarea when asked', () => {
    render(<Field label="Notes" as="textarea" />);
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
  });

  it('shows the hint text', () => {
    render(<Field label="Email" hint="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('passes typing through to onChange', async () => {
    const onChange = vi.fn();
    render(<Field label="Full name" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Full name'), 'Priya');
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/ui/Field.test.tsx`
Expected: FAIL — cannot resolve `./Field`.

- [ ] **Step 3: Write the implementation**

```tsx
import { useId } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const fieldClass =
  'focus-ring w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3';

type Common = { label: string; hint?: string };
type InputProps = Common & { as?: 'input' } & InputHTMLAttributes<HTMLInputElement>;
type AreaProps = Common & { as: 'textarea' } & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Field(props: InputProps | AreaProps) {
  const id = useId();
  const { label, hint, className = '', ...rest } = props as Common & {
    as?: string;
    className?: string;
  };
  const isArea = props.as === 'textarea';
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/ui/Field.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Field.tsx apps/web/src/components/ui/Field.test.tsx
git commit -m "feat(web): add Field primitive"
```

---

### Task 5: Chip primitive

**Files:**
- Create: `apps/web/src/components/ui/Chip.tsx`
- Test: `apps/web/src/components/ui/Chip.test.tsx`

**Interfaces:**
- Consumes: Task 1 utilities.
- Produces: `Chip({ tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'off', onRemove?: () => void, children })`. When `onRemove` is supplied the chip renders a remove button labelled `Remove ${children}`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip';

describe('Chip', () => {
  it('renders its label', () => {
    render(<Chip>Python</Chip>);
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('applies the accent tone', () => {
    const { container } = render(<Chip tone="accent">Python</Chip>);
    expect(container.firstChild).toHaveClass('bg-accent-soft');
  });

  it('calls onRemove when the remove control is clicked', async () => {
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove}>Python</Chip>);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Python' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders no remove control without onRemove', () => {
    render(<Chip>Python</Chip>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/ui/Chip.test.tsx`
Expected: FAIL — cannot resolve `./Chip`.

- [ ] **Step 3: Write the implementation**

```tsx
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'off';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-2',
  accent: 'bg-accent-soft text-accent-ink',
  ok: 'bg-ok-bg text-ok-fg',
  warn: 'bg-warn-bg text-warn-fg',
  off: 'bg-off-bg text-off-fg',
};

interface ChipProps {
  tone?: Tone;
  onRemove?: () => void;
  children: ReactNode;
}

export function Chip({ tone = 'neutral', onRemove, children }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-sm font-medium ${TONES[tone]}`}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${children}`}
          onClick={onRemove}
          className="focus-ring -mr-0.5 rounded-[4px] opacity-70 transition hover:opacity-100"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/ui/Chip.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Chip.tsx apps/web/src/components/ui/Chip.test.tsx
git commit -m "feat(web): add Chip primitive"
```

---

### Task 6: Card and SectionLabel

**Files:**
- Create: `apps/web/src/components/ui/Card.tsx`
- Test: `apps/web/src/components/ui/Card.test.tsx`

**Interfaces:**
- Consumes: Task 1 utilities.
- Produces: `Card({ as?, className?, children })` — bordered surface at `rounded-card`; `SectionLabel({ children })` — the 11px uppercase section heading used throughout.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, SectionLabel } from './Card';

describe('Card', () => {
  it('renders a bordered surface', () => {
    const { container } = render(<Card>body</Card>);
    expect(container.firstChild).toHaveClass('border-border');
    expect(container.firstChild).toHaveClass('rounded-card');
  });

  it('merges an extra className', () => {
    const { container } = render(<Card className="p-8">body</Card>);
    expect(container.firstChild).toHaveClass('p-8');
  });
});

describe('SectionLabel', () => {
  it('renders uppercase label text', () => {
    render(<SectionLabel>Skills</SectionLabel>);
    expect(screen.getByText('Skills')).toHaveClass('uppercase');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/ui/Card.test.tsx`
Expected: FAIL — cannot resolve `./Card`.

- [ ] **Step 3: Write the implementation**

```tsx
import type { ElementType, ReactNode } from 'react';

interface CardProps {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

export function Card({ as: Tag = 'div', className = '', children }: CardProps) {
  return (
    <Tag className={`rounded-card border border-border bg-surface ${className}`}>{children}</Tag>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-2xs font-semibold uppercase tracking-[0.04em] text-ink-3">{children}</span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/ui/Card.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Card.tsx apps/web/src/components/ui/Card.test.tsx
git commit -m "feat(web): add Card and SectionLabel primitives"
```

---

### Task 7: StageDot and the stage colour map

**Files:**
- Create: `apps/web/src/components/ui/StageDot.tsx`, `apps/web/src/components/ui/index.ts`
- Test: `apps/web/src/components/ui/StageDot.test.tsx`

**Interfaces:**
- Consumes: Task 1 stage tokens.
- Produces: `stageToken(name: string): string` returning a `var(--stage-*)` string, defaulting to `var(--stage-sourced)` for unknown names; `StageDot({ stage, size? })`. Also the barrel `apps/web/src/components/ui/index.ts` re-exporting `Button`, `Field`, `fieldClass`, `Chip`, `Card`, `SectionLabel`, `StageDot`, `stageToken`.

Stage names come from the `status_config` table and are user-editable, so the mapping is by normalised name with a safe default — never by index.

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StageDot, stageToken } from './StageDot';

describe('stageToken', () => {
  it('maps the seeded status names', () => {
    expect(stageToken('Sourced')).toBe('var(--stage-sourced)');
    expect(stageToken('Offer Extended')).toBe('var(--stage-offer)');
    expect(stageToken('Interviewing')).toBe('var(--stage-interviewing)');
  });

  it('is case and whitespace insensitive', () => {
    expect(stageToken('  placed ')).toBe('var(--stage-placed)');
  });

  it('falls back for a custom status name', () => {
    expect(stageToken('Second Interview')).toBe('var(--stage-sourced)');
  });
});

describe('StageDot', () => {
  it('paints itself with the stage colour', () => {
    const { container } = render(<StageDot stage="Placed" />);
    expect((container.firstChild as HTMLElement).style.background).toContain('--stage-placed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/ui/StageDot.test.tsx`
Expected: FAIL — cannot resolve `./StageDot`.

- [ ] **Step 3: Write the implementation**

```tsx
const STAGE_TOKENS: Record<string, string> = {
  sourced: 'var(--stage-sourced)',
  screening: 'var(--stage-screening)',
  interviewing: 'var(--stage-interviewing)',
  'offer extended': 'var(--stage-offer)',
  offer: 'var(--stage-offer)',
  placed: 'var(--stage-placed)',
  rejected: 'var(--stage-rejected)',
};

/** Status names are user-editable, so map by name with a safe default. */
export function stageToken(name: string): string {
  return STAGE_TOKENS[name.trim().toLowerCase()] ?? 'var(--stage-sourced)';
}

export function StageDot({ stage, size = 7 }: { stage: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: stageToken(stage) }}
    />
  );
}
```

`apps/web/src/components/ui/index.ts`:

```ts
export { Button } from './Button';
export { Field, fieldClass } from './Field';
export { Chip } from './Chip';
export { Card, SectionLabel } from './Card';
export { StageDot, stageToken } from './StageDot';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/ui/StageDot.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the whole suite, then commit**

```bash
cd /Users/JuansMacbook/Workspace/ProsperityCRM && nvm use && npm run test && npm run typecheck
git add apps/web/src/components/ui
git commit -m "feat(web): add StageDot, stage colour map, and ui barrel"
```

**PR 2 ends here.** Open it: `feat(web): UI primitives for the redesign`.

---

### Task 8: Sidebar app shell

**Files:**
- Create: `apps/web/src/components/AppSidebar.tsx`
- Modify: `apps/web/src/App.tsx:60-104` (the `ProtectedLayout` return block)
- Test: `apps/web/src/components/AppSidebar.test.tsx`

**Interfaces:**
- Consumes: `Button`, `SectionLabel` from Task 7's barrel; `useTheme` from `src/theme`.
- Produces: `AppSidebar({ userName, orgName, theme, onToggleTheme, onLogout })`.

The current blue `rounded-[32px]` header is replaced by a 236px left rail. Nav destinations stay exactly as they are today (`/`, `/jobs`, `/candidates/new`, `/settings`, `/guide`) so no routing changes.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppSidebar } from './AppSidebar';

function renderSidebar(overrides = {}) {
  const props = {
    userName: 'Juan Guardado',
    orgName: 'Prosperity Recruiting',
    theme: 'light' as const,
    onToggleTheme: vi.fn(),
    onLogout: vi.fn(),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <AppSidebar {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe('AppSidebar', () => {
  it('links to every primary destination', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /pipeline/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /jobs/i })).toHaveAttribute('href', '/jobs');
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
  });

  it('shows the user and organisation', () => {
    renderSidebar();
    expect(screen.getByText('Juan Guardado')).toBeInTheDocument();
    expect(screen.getByText('Prosperity Recruiting')).toBeInTheDocument();
  });

  it('toggles the theme', async () => {
    const props = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: /dark mode/i }));
    expect(props.onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('logs out', async () => {
    const props = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(props.onLogout).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/AppSidebar.test.tsx`
Expected: FAIL — cannot resolve `./AppSidebar`.

- [ ] **Step 3: Write `AppSidebar.tsx`**

```tsx
import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Theme } from '../theme';

interface AppSidebarProps {
  userName: string;
  orgName: string;
  theme: Theme;
  onToggleTheme: () => void;
  onLogout: () => void;
}

const NAV: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'Pipeline', icon: <path d="M3 6h18M6 12h12M10 18h4" /> },
  {
    to: '/jobs',
    label: 'Jobs',
    icon: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
      </>
    ),
  },
  {
    to: '/candidates/new',
    label: 'Add candidate',
    icon: <path d="M12 5v14M5 12h14" />,
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
      </>
    ),
  },
  { to: '/guide', label: 'User guide', icon: <path d="M4 5h9a3 3 0 013 3v11a2.5 2.5 0 00-2.5-2.5H4zM20 5h-1a3 3 0 00-3 3v11a2.5 2.5 0 012.5-2.5H20z" /> },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

export function AppSidebar({ userName, orgName, theme, onToggleTheme, onLogout }: AppSidebarProps) {
  return (
    <aside className="flex w-[236px] shrink-0 flex-col gap-7 border-r border-border bg-surface-2 px-4 py-6">
      <div className="flex items-center gap-2.5 px-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17l6-6 4 4 8-8" />
            <path d="M17 7h4v4" />
          </svg>
        </span>
        <span className="text-lg font-semibold tracking-[-0.01em]">Prosperity</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              [
                'focus-ring flex h-[34px] items-center gap-2.5 rounded-[8px] px-2.5 text-base transition',
                isActive ? 'bg-surface-3 font-semibold text-ink' : 'text-ink-2 hover:bg-surface-3',
              ].join(' ')
            }
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              {item.icon}
            </svg>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <button
          type="button"
          onClick={onToggleTheme}
          className="focus-ring flex h-[34px] items-center gap-2.5 rounded-[8px] px-2.5 text-base text-ink-2 transition hover:bg-surface-3"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            {theme === 'dark' ? (
              <>
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
              </>
            ) : (
              <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
            )}
          </svg>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        <div className="flex items-center gap-2.5 px-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-2xs font-semibold uppercase text-accent-ink">
            {initials(userName)}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{userName}</span>
            <span className="truncate text-2xs text-ink-3">{orgName}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="focus-ring rounded-[8px] px-2.5 py-1.5 text-left text-sm text-ink-3 transition hover:bg-surface-3 hover:text-ink-2"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/AppSidebar.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Rewrite `ProtectedLayout`'s return in `App.tsx`**

Replace everything from `return (` to the closing `);` of `ProtectedLayout` with:

```tsx
  return (
    <div className="flex min-h-screen bg-app text-ink" data-theme={theme}>
      <AppSidebar
        userName={data.dbUser.name}
        orgName={data.dbUser.organization_name ?? 'Your organisation'}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <Outlet context={{ theme, toggleTheme }} />
      </main>
    </div>
  );
```

Then delete the now-unused `navClass` function and the `Dropdown` / `Avatar` / `NavLink` imports from `App.tsx`, and add `import { AppSidebar } from './components/AppSidebar';`.

If `organization_name` is not present on the `me` payload, fall back as written — do not add an API call in this task.

- [ ] **Step 6: Verify and commit**

```bash
cd /Users/JuansMacbook/Workspace/ProsperityCRM && nvm use && npm run typecheck && npm run test && npm run build
git add apps/web/src/App.tsx apps/web/src/components/AppSidebar.tsx apps/web/src/components/AppSidebar.test.tsx
git commit -m "feat(web): replace header bar with sidebar shell"
```

**PR 3 ends here.** Open it: `feat(web): sidebar app shell`.

---

### Task 9: Candidate card

**Files:**
- Modify: `apps/web/src/components/CandidateCard.tsx` (full rewrite)
- Test: `apps/web/src/components/CandidateCard.test.tsx`

**Interfaces:**
- Consumes: `Chip`, `stageToken` from `./ui`; `CandidateWithMeta` from `src/common`.
- Produces: `CandidateCard({ candidate, selected?, onSelect? })`. `onSelect` is new and optional so `DraggableCandidateCard` keeps working unchanged until Task 10.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CandidateCard } from './CandidateCard';
import type { CandidateWithMeta } from 'src/common';

const candidate = {
  candidate_id: 'c1',
  name: 'Priya Raghunathan',
  email: 'priya.r@example.com',
  current_status_id: 's1',
  target_agency_id: 'a1',
  recruiter_id: 'u1',
  flags: ['Referral'],
  skills: ['Python', 'Django', 'Redis'],
  agency_name: 'Northgate Staffing',
  job_title: 'Senior Backend Engineer',
} as CandidateWithMeta;

function renderCard(props = {}) {
  render(
    <MemoryRouter>
      <CandidateCard candidate={candidate} {...props} />
    </MemoryRouter>,
  );
}

describe('CandidateCard', () => {
  it('shows the name and job title', () => {
    renderCard();
    expect(screen.getByText('Priya Raghunathan')).toBeInTheDocument();
    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
  });

  it('shows at most two skills plus an overflow count', () => {
    renderCard();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Django')).toBeInTheDocument();
    expect(screen.queryByText('Redis')).toBeNull();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('renders skills as plain strings, not objects', () => {
    renderCard();
    expect(screen.queryByText('[object Object]')).toBeNull();
  });

  it('marks the selected card', () => {
    const { container } = render(
      <MemoryRouter>
        <CandidateCard candidate={candidate} selected />
      </MemoryRouter>,
    );
    expect(container.querySelector('[data-selected="true"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/CandidateCard.test.tsx`
Expected: FAIL — no `+1` overflow chip in the current implementation.

- [ ] **Step 3: Rewrite `CandidateCard.tsx`**

```tsx
import type { CandidateWithMeta } from 'src/common';
import { Chip } from './ui';

interface CandidateCardProps {
  candidate: CandidateWithMeta;
  selected?: boolean;
  onSelect?: (candidateId: string) => void;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function CandidateCard({ candidate, selected = false, onSelect }: CandidateCardProps) {
  const skills = candidate.skills ?? [];
  const shown = skills.slice(0, 2);
  const overflow = skills.length - shown.length;

  return (
    <article
      data-selected={selected}
      onClick={onSelect ? () => onSelect(candidate.candidate_id) : undefined}
      className={[
        'flex w-full flex-col gap-2.5 rounded-[11px] border bg-surface p-3 text-left transition',
        selected ? 'border-accent shadow-pop' : 'border-border shadow-token',
        onSelect ? 'cursor-pointer' : '',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-ink">
          {initials(candidate.name)}
        </span>
        <span className="truncate text-sm font-semibold tracking-[-0.005em]">{candidate.name}</span>
      </div>

      {candidate.job_title && <p className="truncate text-xs text-ink-2">{candidate.job_title}</p>}

      {shown.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {shown.map((skill) => (
            <Chip key={skill}>{skill}</Chip>
          ))}
          {overflow > 0 && <Chip>{`+${overflow}`}</Chip>}
        </div>
      )}
    </article>
  );
}
```

The edit `Link` moves to the detail rail in Task 11 — a card that is both a drag handle and contains a link is a persistent source of accidental navigation during drags.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/CandidateCard.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/CandidateCard.tsx apps/web/src/components/CandidateCard.test.tsx
git commit -m "feat(web): restyle candidate card with skill overflow"
```

---

### Task 10: Pipeline board columns

**Files:**
- Modify: `apps/web/src/components/PipelineBoard.tsx` (the `PipelineColumn` block and grid), `apps/web/src/components/DraggableCandidateCard.tsx`
- Test: `apps/web/src/components/PipelineBoard.test.tsx`

**Interfaces:**
- Consumes: `StageDot` from `./ui`, `CandidateCard` from Task 9.
- Produces: unchanged `PipelineBoard({ statuses, candidates, onMove })` plus new optional `selectedId?: string` and `onSelect?: (id: string) => void` forwarded to the cards.

Drag-and-drop behaviour (`DndContext`, `useDroppable`, `handleDragEnd`) must not change — only the column chrome and grid.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PipelineBoard } from './PipelineBoard';
import type { CandidateWithMeta, StatusDTO } from 'src/common';

const statuses = [
  { status_id: 's1', name: 'Sourced', order_index: 0, is_terminal: false },
  { status_id: 's2', name: 'Placed', order_index: 4, is_terminal: true },
] as StatusDTO[];

const candidates = [
  { candidate_id: 'c1', name: 'Maya Okonkwo', email: 'm@example.com', current_status_id: 's1', target_agency_id: 'a1', recruiter_id: 'u1', flags: [], skills: ['Go'] },
] as CandidateWithMeta[];

describe('PipelineBoard', () => {
  it('renders one column per status with a count', () => {
    render(
      <MemoryRouter>
        <PipelineBoard statuses={statuses} candidates={candidates} onMove={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Sourced')).toBeInTheDocument();
    expect(screen.getByText('Placed')).toBeInTheDocument();
    expect(screen.getByTestId('column-count-s1')).toHaveTextContent('1');
    expect(screen.getByTestId('column-count-s2')).toHaveTextContent('0');
  });

  it('places each candidate in its status column', () => {
    render(
      <MemoryRouter>
        <PipelineBoard statuses={statuses} candidates={candidates} onMove={vi.fn()} />
      </MemoryRouter>,
    );
    const column = screen.getByTestId('column-s1');
    expect(column).toHaveTextContent('Maya Okonkwo');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/PipelineBoard.test.tsx`
Expected: FAIL — no `column-count-s1` test id.

- [ ] **Step 3: Rewrite `PipelineColumn` and the grid**

Replace the `PipelineColumn` function body's `return` and the grid `div` in `PipelineBoard`:

```tsx
  return (
    <section
      ref={setNodeRef}
      data-testid={`column-${status.status_id}`}
      data-terminal={status.is_terminal}
      className={[
        'flex min-h-[240px] min-w-0 flex-col rounded-card border bg-surface-2 transition',
        isOver ? 'border-accent' : 'border-border',
      ].join(' ')}
    >
      <header className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <StageDot stage={status.name} />
          <h3 className="truncate text-sm font-semibold">{status.name}</h3>
        </div>
        <span
          data-testid={`column-count-${status.status_id}`}
          className="rounded-full bg-surface-3 px-1.5 py-px text-2xs font-semibold text-ink-2"
        >
          {count}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2 px-2.5 pb-3">{children}</div>
    </section>
  );
```

and the grid:

```tsx
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
```

Add `import { StageDot } from './ui';` at the top and delete the `is_terminal` "Terminal" caption — terminal state now reads from the stage colour and column position.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/PipelineBoard.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/PipelineBoard.tsx apps/web/src/components/PipelineBoard.test.tsx apps/web/src/components/DraggableCandidateCard.tsx
git commit -m "feat(web): restyle pipeline columns onto the token layer"
```

---

### Task 11: Dashboard toolbar, filter bar, and detail rail

**Files:**
- Modify: `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/components/FilterBar.tsx`, `apps/web/src/components/PipelineList.tsx`, `apps/web/src/components/selectStyles.ts`
- Create: `apps/web/src/components/DetailRail.tsx`, `apps/web/src/components/StageStepper.tsx`
- Test: `apps/web/src/components/DetailRail.test.tsx`, `apps/web/src/components/StageStepper.test.tsx`

**Interfaces:**
- Consumes: `Card`, `SectionLabel`, `Chip`, `Button`, `StageDot`, `stageToken`.
- Produces: `StageStepper({ statuses, currentStatusId, orientation? })`; `DetailRail({ candidate, statuses, onClose })`.

`selectStyles.ts` keeps its generic signature from PR #1 — only the palette values change, from the hardcoded Tailwind colours to `var(--…)` tokens. Do not alter `getSelectStyles`/`getMultiSelectStyles` type parameters.

- [ ] **Step 1: Write the failing tests**

`StageStepper.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StageStepper } from './StageStepper';
import type { StatusDTO } from 'src/common';

const statuses = [
  { status_id: 's1', name: 'Sourced', order_index: 0, is_terminal: false },
  { status_id: 's2', name: 'Screening', order_index: 1, is_terminal: false },
  { status_id: 's3', name: 'Interviewing', order_index: 2, is_terminal: false },
] as StatusDTO[];

describe('StageStepper', () => {
  it('marks earlier stages complete and the current one active', () => {
    render(<StageStepper statuses={statuses} currentStatusId="s2" />);
    expect(screen.getByTestId('step-s1')).toHaveAttribute('data-state', 'done');
    expect(screen.getByTestId('step-s2')).toHaveAttribute('data-state', 'current');
    expect(screen.getByTestId('step-s3')).toHaveAttribute('data-state', 'todo');
  });

  it('orders by order_index, not array order', () => {
    const shuffled = [statuses[2], statuses[0], statuses[1]];
    render(<StageStepper statuses={shuffled} currentStatusId="s1" />);
    const names = screen.getAllByTestId(/^step-/).map((el) => el.textContent);
    expect(names).toEqual(['Sourced', 'Screening', 'Interviewing']);
  });
});
```

`DetailRail.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DetailRail } from './DetailRail';
import type { CandidateWithMeta, StatusDTO } from 'src/common';

const statuses = [
  { status_id: 's1', name: 'Sourced', order_index: 0, is_terminal: false },
  { status_id: 's2', name: 'Screening', order_index: 1, is_terminal: false },
] as StatusDTO[];

const candidate = {
  candidate_id: 'c1',
  name: 'Priya Raghunathan',
  email: 'priya.r@example.com',
  phone: '628-555-0193',
  current_status_id: 's2',
  target_agency_id: 'a1',
  recruiter_id: 'u1',
  flags: [],
  skills: ['Python'],
  agency_name: 'Northgate Staffing',
  job_title: 'Senior Backend Engineer',
} as CandidateWithMeta;

describe('DetailRail', () => {
  it('shows contact details and skills', () => {
    render(
      <MemoryRouter>
        <DetailRail candidate={candidate} statuses={statuses} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('priya.r@example.com')).toBeInTheDocument();
    expect(screen.getByText('Northgate Staffing')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('closes', async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <DetailRail candidate={candidate} statuses={statuses} onClose={onClose} />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('links to the edit page', () => {
    render(
      <MemoryRouter>
        <DetailRail candidate={candidate} statuses={statuses} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute('href', '/candidates/c1/edit');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/components/StageStepper.test.tsx src/components/DetailRail.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `StageStepper.tsx`**

```tsx
import type { StatusDTO } from 'src/common';
import { stageToken } from './ui';

type State = 'done' | 'current' | 'todo';

interface StageStepperProps {
  statuses: StatusDTO[];
  currentStatusId: string;
  orientation?: 'vertical' | 'horizontal';
}

export function StageStepper({ statuses, currentStatusId, orientation = 'vertical' }: StageStepperProps) {
  const ordered = [...statuses].sort((a, b) => a.order_index - b.order_index);
  const currentIndex = ordered.findIndex((s) => s.status_id === currentStatusId);

  return (
    <div className={orientation === 'vertical' ? 'flex flex-col gap-px' : 'flex items-center gap-2'}>
      {ordered.map((status, index) => {
        const state: State = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        const colour = stageToken(status.name);
        return (
          <div
            key={status.status_id}
            data-testid={`step-${status.status_id}`}
            data-state={state}
            className={orientation === 'vertical' ? 'flex items-center gap-2.5 py-1' : 'flex flex-1 items-center gap-2'}
          >
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]"
              style={{
                background: state === 'todo' ? 'transparent' : colour,
                borderColor: state === 'todo' ? 'var(--border)' : colour,
              }}
            >
              {state === 'done' && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              )}
            </span>
            <span
              className={[
                'text-sm',
                state === 'current' ? 'font-semibold text-ink' : state === 'done' ? 'text-ink-2' : 'text-ink-3',
              ].join(' ')}
            >
              {status.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Write `DetailRail.tsx`**

```tsx
import { Link } from 'react-router-dom';
import type { CandidateWithMeta, StatusDTO } from 'src/common';
import { Button, Chip, SectionLabel } from './ui';
import { StageStepper } from './StageStepper';

interface DetailRailProps {
  candidate: CandidateWithMeta;
  statuses: StatusDTO[];
  onClose: () => void;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function DetailRail({ candidate, statuses, onClose }: DetailRailProps) {
  const fields: [string, string | null | undefined][] = [
    ['Email', candidate.email],
    ['Phone', candidate.phone],
    ['Agency', candidate.agency_name],
    ['Job', candidate.job_title],
  ];

  return (
    <aside className="flex w-[344px] shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-base font-semibold text-accent-ink">
            {initials(candidate.name)}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-lg font-semibold tracking-[-0.01em]">{candidate.name}</span>
            {candidate.job_title && <span className="truncate text-sm text-ink-2">{candidate.job_title}</span>}
          </div>
        </div>
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-surface-3 text-ink-2"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-5 overflow-y-auto p-5">
        <div className="flex flex-col gap-2">
          <SectionLabel>Stage</SectionLabel>
          <StageStepper statuses={statuses} currentStatusId={candidate.current_status_id} />
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>Details</SectionLabel>
          {fields
            .filter(([, value]) => Boolean(value))
            .map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-b border-border-soft py-1.5">
                <span className="shrink-0 text-sm text-ink-2">{label}</span>
                <span className="break-words text-right text-sm">{value}</span>
              </div>
            ))}
        </div>

        {candidate.skills?.length > 0 && (
          <div className="flex flex-col gap-2">
            <SectionLabel>Skills</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.map((skill) => (
                <Chip key={skill} tone="accent">
                  {skill}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {candidate.flags?.length > 0 && (
          <div className="flex flex-col gap-2">
            <SectionLabel>Flags</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {candidate.flags.map((flag) => (
                <Chip key={flag} tone="warn">
                  {flag}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto flex gap-2 border-t border-border p-4">
        <Link to={`/candidates/${candidate.candidate_id}/edit`} className="flex-1">
          <Button variant="primary" className="w-full">
            Open
          </Button>
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/components/StageStepper.test.tsx src/components/DetailRail.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Wire selection into `DashboardPage.tsx`**

Add `const [selectedId, setSelectedId] = useState<string | null>(null);` beside the existing `viewMode` state. Replace the Board/List button pair with a segmented control, and wrap the board and rail:

```tsx
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {viewMode === 'board' ? (
            <PipelineBoard
              statuses={statusesQuery.data ?? []}
              candidates={candidatesQuery.data ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={async (candidateId, toStatusId) => {
                await moveMutation.mutateAsync({ candidateId, toStatusId });
              }}
            />
          ) : (
            <PipelineList statuses={statusesQuery.data ?? []} candidates={candidatesQuery.data ?? []} />
          )}
        </div>
        {selected && (
          <DetailRail
            candidate={selected}
            statuses={statusesQuery.data ?? []}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
```

with `const selected = (candidatesQuery.data ?? []).find((c) => c.candidate_id === selectedId) ?? null;` computed above the return. The segmented control markup:

```tsx
        <div className="flex items-center gap-1 rounded-control bg-surface-3 p-[3px]">
          {(['board', 'list'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={[
                'focus-ring h-[26px] rounded-[7px] px-3 text-sm font-medium capitalize transition',
                viewMode === mode ? 'bg-surface text-ink shadow-pop' : 'text-ink-2',
              ].join(' ')}
            >
              {mode}
            </button>
          ))}
        </div>
```

- [ ] **Step 7: Retint `selectStyles.ts`**

Swap the `palette` object's two blocks so every value is a token reference — `controlBorder: 'var(--border)'`, `menuBg: 'var(--surface)'`, `menuColor: 'var(--ink)'`, `optionHoverBg: 'var(--surface-3)'`, `optionSelectedColor: 'var(--accent-ink)'`, `optionColor: 'var(--ink)'`, `optionActiveBg: 'var(--sel-bg)'`, `multiBg: 'var(--accent-soft)'`, `multiText: 'var(--accent-ink)'`, `multiRemoveHoverBg: 'var(--accent)'`, `valueColor: 'var(--ink)'`, `placeholderColor: 'var(--ink-3)'`, `controlBorderFocus`/`controlBorderHover`: `'var(--accent)'`. Both `light` and `dark` entries become identical (the tokens already resolve per theme), but keep both keys so the `Theme` parameter and every call site stay valid. Also change the control's `borderRadius` to `'var(--r-control)'` and remove the `9999` pill radius.

- [ ] **Step 8: Verify and commit**

```bash
cd /Users/JuansMacbook/Workspace/ProsperityCRM && nvm use && npm run typecheck && npm run test && npm run build
git add apps/web/src/pages/DashboardPage.tsx apps/web/src/components
git commit -m "feat(web): pipeline toolbar, filters, and candidate detail rail"
```

**PR 4 ends here.** Open it: `feat(web): redesign the pipeline dashboard`.

---

### Task 12: Jobs list

**Files:**
- Modify: `apps/web/src/pages/JobsPage.tsx`
- Test: `apps/web/src/pages/JobsPage.test.tsx`

**Interfaces:**
- Consumes: `Card`, `SectionLabel`, `Chip`, `Button`, `StageDot`.
- Produces: exported helper `formatMoney(value: string | number | null | undefined): string` returning `'—'` for empty and `$45,000` otherwise (no decimals).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest';
import { formatMoney } from './JobsPage';

describe('formatMoney', () => {
  it('formats a numeric string as whole dollars', () => {
    expect(formatMoney('45000')).toBe('$45,000');
  });

  it('formats a number', () => {
    expect(formatMoney(45000)).toBe('$45,000');
  });

  it('renders an em dash for empty values', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney('')).toBe('—');
  });

  it('renders an em dash for junk', () => {
    expect(formatMoney('not a number')).toBe('—');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/pages/JobsPage.test.tsx`
Expected: FAIL — `formatMoney` is not exported.

- [ ] **Step 3: Add `formatMoney` to `JobsPage.tsx`**

```tsx
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
```

`deal_amount` arrives from Postgres `numeric` as a **string**, which is why the signature accepts both.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/pages/JobsPage.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Restyle the jobs list**

Rebuild the page body as: a serif `Jobs` title with a summary line; a four-tile stat row (Open roles / Pipeline value / Weighted / In play) using `Card` and `SectionLabel`; status filter tabs (All / Open / On hold / Closed) with counts; and a `Card`-wrapped table with columns Role · Department · Location · Pipeline · Deal value · Status. Status pills use `Chip` with `tone="ok"` for open, `"warn"` for on hold, `"off"` for closed. Every currency figure goes through `formatMoney`.

- [ ] **Step 6: Verify and commit**

```bash
cd /Users/JuansMacbook/Workspace/ProsperityCRM && nvm use && npm run typecheck && npm run test && npm run build
git add apps/web/src/pages/JobsPage.tsx apps/web/src/pages/JobsPage.test.tsx
git commit -m "feat(web): redesign the jobs list"
```

---

### Task 13: Job deal sheet

**Files:**
- Modify: `apps/web/src/pages/JobDealPage.tsx`
- Test: `apps/web/src/pages/JobDealPage.test.tsx`

**Interfaces:**
- Consumes: `formatMoney` from Task 12, `Card`, `SectionLabel`, `Button`, `Field`.
- Produces: exported helper `splitAmount(total: string | number | null | undefined, percent: string | number | null | undefined): string`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from 'vitest';
import { splitAmount } from './JobDealPage';

describe('splitAmount', () => {
  it('computes a percentage of the deal', () => {
    expect(splitAmount('45000', '60')).toBe('$27,000');
  });

  it('handles numeric input', () => {
    expect(splitAmount(45000, 50)).toBe('$22,500');
  });

  it('returns an em dash when either side is missing', () => {
    expect(splitAmount(null, '60')).toBe('—');
    expect(splitAmount('45000', null)).toBe('—');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/pages/JobDealPage.test.tsx`
Expected: FAIL — `splitAmount` is not exported.

- [ ] **Step 3: Implement**

```tsx
import { formatMoney } from './JobsPage';

export function splitAmount(
  total: string | number | null | undefined,
  percent: string | number | null | undefined,
): string {
  if (total === null || total === undefined || total === '') return '—';
  if (percent === null || percent === undefined || percent === '') return '—';
  const t = Number(total);
  const p = Number(percent);
  if (!Number.isFinite(t) || !Number.isFinite(p)) return '—';
  return formatMoney((t * p) / 100);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/pages/JobDealPage.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Restyle the deal sheet**

Two stat tiles (Deal value / Weighted) in serif display type, a pipeline bar list by stage, and the deal-split table showing teammate, role, percent and computed `splitAmount`. All inputs become `Field`; all buttons become `Button`.

- [ ] **Step 6: Verify and commit**

```bash
cd /Users/JuansMacbook/Workspace/ProsperityCRM && nvm use && npm run typecheck && npm run test && npm run build
git add apps/web/src/pages/JobDealPage.tsx apps/web/src/pages/JobDealPage.test.tsx
git commit -m "feat(web): redesign the job deal sheet"
```

**PR 5 ends here.** Open it: `feat(web): redesign jobs list and deal sheet`.

---

### Task 14: Candidate form

**Files:**
- Modify: `apps/web/src/pages/CandidateFormPage.tsx`, `apps/web/src/pages/CandidateEditPage.tsx`
- Create: `apps/web/src/components/CandidateFormLayout.tsx`
- Test: `apps/web/src/components/CandidateFormLayout.test.tsx`

**Interfaces:**
- Consumes: `Card`, `SectionLabel`, `Field`, `Chip`, `Button`, `StageDot`.
- Produces: `CandidateFormLayout({ title, subtitle, children, preview, checklist, saveHint, onCancel, submitting })` — the two-column shell (form left, sticky preview rail right, sticky save bar bottom). `checklist: { label: string; done: boolean }[]`.

Both the create and edit pages share this shell so they cannot drift apart, which is how the two pages ended up with duplicated select-handling bugs in the first place.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CandidateFormLayout } from './CandidateFormLayout';

function renderLayout(overrides = {}) {
  const props = {
    title: 'New candidate',
    subtitle: 'Only a name and email are required.',
    checklist: [
      { label: 'Name and email', done: true },
      { label: 'At least one skill', done: false },
    ],
    saveHint: 'Saving adds this candidate to Screening.',
    onCancel: vi.fn(),
    submitting: false,
    preview: <p>preview</p>,
    children: <p>fields</p>,
    ...overrides,
  };
  render(<CandidateFormLayout {...props} />);
  return props;
}

describe('CandidateFormLayout', () => {
  it('renders the title, fields and preview', () => {
    renderLayout();
    expect(screen.getByRole('heading', { name: 'New candidate' })).toBeInTheDocument();
    expect(screen.getByText('fields')).toBeInTheDocument();
    expect(screen.getByText('preview')).toBeInTheDocument();
  });

  it('reports checklist progress', () => {
    renderLayout();
    expect(screen.getByTestId('checklist-progress')).toHaveTextContent('1 of 2');
  });

  it('disables the submit button while submitting', () => {
    renderLayout({ submitting: true });
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });

  it('cancels', async () => {
    const props = renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/CandidateFormLayout.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `CandidateFormLayout.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Button, Card, SectionLabel } from './ui';

interface CandidateFormLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  preview: ReactNode;
  checklist: { label: string; done: boolean }[];
  saveHint: string;
  onCancel: () => void;
  submitting: boolean;
}

export function CandidateFormLayout({
  title,
  subtitle,
  children,
  preview,
  checklist,
  saveHint,
  onCancel,
  submitting,
}: CandidateFormLayoutProps) {
  const done = checklist.filter((c) => c.done).length;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 gap-6 p-8 pb-28">
        <div className="flex min-w-0 max-w-[680px] flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-[28px] tracking-[-0.012em]">{title}</h1>
            <p className="text-base text-ink-2">{subtitle}</p>
          </div>
          {children}
        </div>

        <div className="sticky top-8 flex w-[320px] shrink-0 flex-col gap-4 self-start">
          <Card className="flex flex-col gap-3 p-4">
            <SectionLabel>Board preview</SectionLabel>
            {preview}
          </Card>

          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>Ready to save</SectionLabel>
              <span data-testid="checklist-progress" className="text-xs font-semibold text-ink-2">
                {done} of {checklist.length}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-sm bg-surface-3">
              <div
                className="h-full bg-accent transition-[width]"
                style={{ width: `${checklist.length ? (done / checklist.length) * 100 : 0}%` }}
              />
            </div>
            <ul className="flex flex-col gap-1.5">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2.5">
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]"
                    style={{
                      background: item.done ? 'var(--accent)' : 'transparent',
                      borderColor: item.done ? 'var(--accent)' : 'var(--border)',
                    }}
                  >
                    {item.done && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12.5l5 5L20 6.5" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm ${item.done ? 'text-ink-2' : 'text-ink-3'}`}>{item.label}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border bg-surface px-8 py-3.5">
        <span className="text-sm text-ink-3">{saveHint}</span>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save candidate'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/CandidateFormLayout.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Adopt the layout in both form pages**

Wrap the existing `<form>` bodies of `CandidateFormPage` and `CandidateEditPage` in `CandidateFormLayout`, grouping the existing inputs into four `Card` sections — Basics (name, email, phone), Assignment (agency, job, status), Skills (chosen chips + library suggestions), Notes (textarea + flags). Replace every raw `<input className="pill-input">` with `Field`. Keep all existing `useMutation` / `useQuery` calls, field names, and the `handleSkillSelectChange` logic exactly as they are — this is a presentation change.

Compute `checklist` from live form state:

```tsx
  const checklist = [
    { label: 'Name and email', done: Boolean(form.name && form.email) },
    { label: 'Assigned to a job', done: Boolean(form.job_requisition_id) },
    { label: 'At least one skill', done: form.skills.length > 0 },
    { label: 'Screening note', done: Boolean(form.notes?.trim()) },
  ];
```

- [ ] **Step 6: Verify and commit**

```bash
cd /Users/JuansMacbook/Workspace/ProsperityCRM && nvm use && npm run typecheck && npm run test && npm run build
git add apps/web/src/pages/CandidateFormPage.tsx apps/web/src/pages/CandidateEditPage.tsx apps/web/src/components/CandidateFormLayout.tsx apps/web/src/components/CandidateFormLayout.test.tsx
git commit -m "feat(web): redesign the candidate form with live preview and checklist"
```

---

### Task 15: Auth page and modal

**Files:**
- Modify: `apps/web/src/pages/AuthPage.tsx`, `apps/web/src/components/Modal.tsx`, `apps/web/src/components/CandidateDetailsModal.tsx`, `apps/web/src/components/Avatar.tsx`
- Test: `apps/web/src/components/Avatar.test.tsx`

**Interfaces:**
- Consumes: `Card`, `Field`, `Button`, `Chip`.
- Produces: `Avatar({ name, size? })` on the token palette.

These are the last screens still carrying `.glass-card` / `.btn-gradient`. Leaving them behind would ship two visual languages at once.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('shows two initials', () => {
    render(<Avatar name="Juan Guardado" />);
    expect(screen.getByText('JG')).toBeInTheDocument();
  });

  it('handles a single-word name', () => {
    render(<Avatar name="Prosperity" />);
    expect(screen.getByText('P')).toBeInTheDocument();
  });

  it('falls back when the name is missing', () => {
    render(<Avatar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('uses the accent tint, not brand fuchsia', () => {
    const { container } = render(<Avatar name="Juan Guardado" />);
    expect((container.firstChild as HTMLElement).className).not.toContain('brand-fuchsia');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/Avatar.test.tsx`
Expected: FAIL — the current Avatar renders `??` for a missing name and uses `bg-brand-fuchsia`.

- [ ] **Step 3: Rewrite `Avatar.tsx`**

```tsx
interface AvatarProps {
  name?: string;
  size?: number;
}

export function Avatar({ name, size = 28 }: AvatarProps) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const initials = parts.length
    ? ((parts[0][0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
    : '?';

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-ink"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/Avatar.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Restyle `AuthPage`, `Modal`, `CandidateDetailsModal`**

`AuthPage`: a single centred `Card` at `max-w-[420px]`, serif title, `Field` inputs, `Button variant="primary"` submit, login/signup as a segmented control matching the dashboard's. `Modal`: token surface, `rounded-card`, `bg-black/40` backdrop. `CandidateDetailsModal`: `SectionLabel` headings and `Chip` for skills — the skill values are plain strings, keep them that way.

- [ ] **Step 6: Delete the dead brand theme**

Remove `brand`, `surface`, `borderRadius.card`, `boxShadow.soft/inner`, and `backgroundImage.brand-gradient` from `tailwind.config.ts` — Task 1 replaced them, and leaving them invites reuse. Then confirm nothing references them:

```bash
cd apps/web && grep -rn "brand-fuchsia\|brand-green\|brand-blue\|brand-gradient\|glass-card\|pill-input\|pill-select\|btn-gradient\|btn-fuchsia\|btn-outline\|shadow-soft" src/ && echo "STILL REFERENCED — fix before committing" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 7: Verify and commit**

```bash
cd /Users/JuansMacbook/Workspace/ProsperityCRM && nvm use && npm run typecheck && npm run test && npm run build
git add apps/web
git commit -m "feat(web): move auth, modals, and avatar onto the token layer"
```

**PR 6 ends here.** Open it: `feat(web): redesign candidate form, auth, and modals`.

---

## Verification

After PR 6 merges, confirm the whole thing end to end:

```bash
cd /Users/JuansMacbook/Workspace/ProsperityCRM && nvm use
npm run build && npm run typecheck && npm run test
npm run dev
```

Then in the browser at http://localhost:5173 — log in, and check each of: the board renders six columns and a card can be dragged between them; the list view and the detail rail both open; jobs and the deal sheet show currency correctly; the candidate form's checklist reacts to input; **toggle dark mode on every screen** and confirm no unreadable text and no white flashes.
