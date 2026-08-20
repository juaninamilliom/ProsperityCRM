import type { Role, UserDTO } from 'src/common';
import { Chip, SectionLabel } from './ui';

const ROLE_LABEL: Record<Role, string> = {
  OrgAdmin: 'Admin',
  OrgEmployee: 'Recruiter',
};

interface MembersTableProps {
  members: UserDTO[];
  currentUserId: string;
  canEdit: boolean;
  onRoleChange: (userId: string, role: Role) => void;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function MembersTable({ members, currentUserId, canEdit, onRoleChange }: MembersTableProps) {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="grid grid-cols-[2.2fr_1.4fr_1fr] gap-4 border-b border-border bg-surface-2 px-[18px] py-3">
        {['Member', 'Role', 'Status'].map((h) => (
          <SectionLabel key={h}>{h}</SectionLabel>
        ))}
      </div>
      {members.map((member) => {
        const isSelf = member.user_id === currentUserId;
        const next: Role = member.role === 'OrgAdmin' ? 'OrgEmployee' : 'OrgAdmin';
        return (
          <div
            key={member.user_id}
            className="grid grid-cols-[2.2fr_1.4fr_1fr] items-center gap-4 border-b border-border-soft px-[18px] py-3 last:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xs font-semibold text-accent-ink">
                {initials(member.name)}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-base font-medium">{member.name}</span>
                <span className="truncate text-xs text-ink-3">{member.email}</span>
              </span>
            </span>

            <span>
              {canEdit ? (
                <button
                  type="button"
                  disabled={isSelf}
                  title={isSelf ? 'You cannot change your own role' : undefined}
                  onClick={() => !isSelf && onRoleChange(member.user_id, next)}
                  className="focus-ring inline-flex h-[30px] items-center gap-1.5 rounded-control border border-border bg-surface px-2.5 text-sm transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-surface"
                >
                  {ROLE_LABEL[member.role]}
                  {!isSelf && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-3">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  )}
                </button>
              ) : (
                <span className="text-sm text-ink-2">{ROLE_LABEL[member.role]}</span>
              )}
            </span>

            <span className="justify-self-start">
              <Chip tone={member.is_active === false ? 'off' : 'ok'}>
                {member.is_active === false ? 'Inactive' : 'Active'}
              </Chip>
            </span>
          </div>
        );
      })}
    </div>
  );
}
