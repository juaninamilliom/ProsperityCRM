import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppSidebar } from './AppSidebar';

function renderSidebar(overrides: Record<string, unknown> = {}) {
  const props = {
    userName: 'Juan Guardado',
    role: 'OrgAdmin' as const,
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

  it('shows the user name', () => {
    renderSidebar();
    expect(screen.getByText('Juan Guardado')).toBeInTheDocument();
  });

  it('falls back to a readable role when no org name is known', () => {
    renderSidebar();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('prefers the organisation name when one is supplied', () => {
    renderSidebar({ orgName: 'Prosperity Recruiting' });
    expect(screen.getByText('Prosperity Recruiting')).toBeInTheDocument();
    expect(screen.queryByText('Admin')).toBeNull();
  });

  it('toggles the theme', async () => {
    const props = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: /dark mode/i }));
    expect(props.onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('offers light mode when already dark', () => {
    renderSidebar({ theme: 'dark' });
    expect(screen.getByRole('button', { name: /light mode/i })).toBeInTheDocument();
  });

  it('logs out', async () => {
    const props = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(props.onLogout).toHaveBeenCalledTimes(1);
  });
});
