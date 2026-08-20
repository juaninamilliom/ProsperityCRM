import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MembersTable } from './MembersTable';
import type { UserDTO } from 'src/common';

const members = [
  { user_id: 'u1', name: 'Juan Guardado', email: 'juan@example.com', role: 'OrgAdmin', organization_id: 'o1', is_active: true },
  { user_id: 'u2', name: 'Dana Whitfield', email: 'dana@example.com', role: 'OrgEmployee', organization_id: 'o1', is_active: true },
] as UserDTO[];

describe('MembersTable', () => {
  it('lists every member with a readable role', () => {
    render(<MembersTable members={members} currentUserId="u1" canEdit onRoleChange={vi.fn()} />);
    expect(screen.getByText('Juan Guardado')).toBeInTheDocument();
    expect(screen.getByText('dana@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recruiter/i })).toBeInTheDocument();
  });

  it('toggles a role', async () => {
    const onRoleChange = vi.fn();
    render(<MembersTable members={members} currentUserId="u1" canEdit onRoleChange={onRoleChange} />);
    await userEvent.click(screen.getByRole('button', { name: /recruiter/i }));
    expect(onRoleChange).toHaveBeenCalledWith('u2', 'OrgAdmin');
  });

  it('will not let you demote yourself', async () => {
    const onRoleChange = vi.fn();
    render(<MembersTable members={members} currentUserId="u1" canEdit onRoleChange={onRoleChange} />);
    const own = screen.getByRole('button', { name: /admin/i });
    expect(own).toBeDisabled();
    await userEvent.click(own);
    expect(onRoleChange).not.toHaveBeenCalled();
  });

  it('renders roles as static text without edit rights', () => {
    render(<MembersTable members={members} currentUserId="u2" canEdit={false} onRoleChange={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Recruiter')).toBeInTheDocument();
  });
});
