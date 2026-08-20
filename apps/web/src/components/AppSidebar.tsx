import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Role } from 'src/common';
import type { Theme } from '../theme';

interface AppSidebarProps {
  userName: string;
  role: Role;
  /** The /users/me payload carries organization_id but not its name, so this
   *  is optional until that endpoint joins organizations. */
  orgName?: string;
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
  { to: '/candidates/new', label: 'Add candidate', icon: <path d="M12 5v14M5 12h14" /> },
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
  {
    to: '/guide',
    label: 'User guide',
    icon: (
      <path d="M4 5h9a3 3 0 013 3v11a2.5 2.5 0 00-2.5-2.5H4zM20 5h-1a3 3 0 00-3 3v11a2.5 2.5 0 012.5-2.5H20z" />
    ),
  },
];

const ROLE_LABEL: Record<Role, string> = {
  OrgAdmin: 'Admin',
  OrgEmployee: 'Recruiter',
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function AppSidebar({
  userName,
  role,
  orgName,
  theme,
  onToggleTheme,
  onLogout,
}: AppSidebarProps) {
  return (
    <aside className="flex w-[236px] shrink-0 flex-col gap-7 border-r border-border bg-surface-2 px-4 py-6">
      <div className="flex items-center gap-2.5 px-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xs font-semibold text-accent-ink">
            {initials(userName)}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium">{userName}</span>
            <span className="truncate text-2xs text-ink-3">{orgName ?? ROLE_LABEL[role]}</span>
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
