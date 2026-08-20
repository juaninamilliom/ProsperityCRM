import { ChangeEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Select from 'react-select';
import { fetchCurrentUser, fetchOrgUsers, updateUserRole } from '../api/users';
import { createInviteCode, fetchInviteCodes, revokeInvite } from '../api/invites';
import { AdminStatusesPage } from './AdminStatusesPage';
import { AdminAgenciesPage } from './AdminAgenciesPage';
import { AdminJobsPage } from './AdminJobsPage';
import { useTheme } from 'src/theme';
import { getSelectStyles } from 'src/components/selectStyles';
import { MembersTable } from '../components/MembersTable';
import { Card, SectionLabel } from '../components/ui';
import type { Role } from 'src/common';

const TABS = [
  { id: 'organisation', label: 'Organisation' },
  { id: 'members', label: 'Members' },
  { id: 'stages', label: 'Pipeline stages' },
  { id: 'agencies', label: 'Agencies' },
  { id: 'jobs', label: 'Jobs' },
] as const;

type TabId = (typeof TABS)[number]['id'];
type SelectOption = { value: string; label: string };

const roleOptions: SelectOption[] = [
  { value: 'OrgEmployee', label: 'Recruiter' },
  { value: 'OrgAdmin', label: 'Admin' },
];

export function AccountSettingsPage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: fetchCurrentUser });
  const organizationId = currentUser?.dbUser?.organization_id;
  const isOrgAdmin = currentUser?.dbUser?.role === 'OrgAdmin';
  const [activeTab, setActiveTab] = useState<TabId>('organisation');
  const [role, setRole] = useState<'OrgAdmin' | 'OrgEmployee'>('OrgEmployee');
  const [maxUses, setMaxUses] = useState(1);
  const [theme, toggleTheme] = useTheme();
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [revokeMessage, setRevokeMessage] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ['org-users', organizationId],
    queryFn: fetchOrgUsers,
    enabled: Boolean(organizationId),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role: nextRole }: { userId: string; role: Role }) =>
      updateUserRole(userId, nextRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-users', organizationId] });
    },
  });

  const invitesQuery = useQuery({
    queryKey: ['invites', organizationId],
    queryFn: () => fetchInviteCodes(organizationId!),
    enabled: Boolean(organizationId && isOrgAdmin),
  });

  const createMutation = useMutation({
    mutationFn: () => createInviteCode(organizationId!, { role, maxUses }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', organizationId] });
      setInviteMessage('Passcode generated.');
      setInviteError(null);
    },
    onError: () => {
      setInviteError('Failed to generate passcode. Try again.');
      setInviteMessage(null);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (code: string) => revokeInvite(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', organizationId] });
      setRevokeMessage('Passcode revoked.');
      setRevokeError(null);
    },
    onError: () => {
      setRevokeError('Failed to revoke passcode. Try again.');
      setRevokeMessage(null);
    },
  });

  useEffect(() => {
    if (!inviteMessage && !inviteError && !revokeMessage && !revokeError) return;
    const timer = setTimeout(() => {
      setInviteMessage(null);
      setInviteError(null);
      setRevokeMessage(null);
      setRevokeError(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [inviteMessage, inviteError, revokeMessage, revokeError]);

  const showInviteTab = activeTab === 'members';

  const selectStyles = getSelectStyles(theme);

  const memberCount = membersQuery.data?.length ?? 0;

  return (
    <section className="flex max-w-[1080px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-title">Settings</h1>
        <p className="text-base text-ink-2">
          {memberCount > 0
            ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`
            : 'Manage your organisation, team and pipeline.'}
        </p>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'focus-ring h-9 whitespace-nowrap border-b-2 px-3.5 text-base transition',
              activeTab === tab.id
                ? 'border-accent font-semibold text-ink'
                : 'border-transparent font-medium text-ink-2 hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'organisation' && (
        <Card className="flex flex-col gap-4 p-6">
          <SectionLabel>Appearance</SectionLabel>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-medium">Theme</span>
              <p className="text-sm text-ink-3">Applies to your account on this device.</p>
            </div>
            <button
              className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 font-medium text-ink transition hover:bg-surface-3"
              onClick={toggleTheme}
            >
              <span>{theme === 'light' ? 'Enable dark mode' : 'Enable light mode'}</span>
            </button>
          </div>
        </Card>
      )}

      {activeTab === 'members' && (
        <div className="flex flex-col gap-4">
          {membersQuery.isLoading ? (
            <p className="text-sm text-ink-3">Loading members…</p>
          ) : membersQuery.error ? (
            <p className="text-sm text-warn-fg">Could not load members.</p>
          ) : (
            <MembersTable
              members={membersQuery.data ?? []}
              currentUserId={currentUser?.dbUser?.user_id ?? ''}
              canEdit={isOrgAdmin}
              onRoleChange={(userId, nextRole) => roleMutation.mutate({ userId, role: nextRole })}
            />
          )}
        </div>
      )}

      {showInviteTab && isOrgAdmin && (
        <>
          <div className="rounded-card border border-border bg-surface p-6">
            <SectionLabel>Invite codes</SectionLabel>
            <p className="mt-1 text-sm text-ink-3">
              Share passcodes with teammates to onboard them via SSO. Codes are single use unless
              you raise the max-uses value.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <label className="flex flex-col text-sm font-semibold text-ink-2">
                Role
                <Select
                  options={roleOptions}
                  value={roleOptions.find((o) => o.value === role)}
                  onChange={(option) =>
                    setRole((option?.value as 'OrgAdmin' | 'OrgEmployee') ?? 'OrgEmployee')
                  }
                  styles={selectStyles}
                  classNamePrefix="skill-select"
                />
              </label>
              <label className="flex flex-col text-sm font-semibold text-ink-2">
                Max Uses
                <input
                  className="focus-ring h-9 w-full rounded-control border border-border bg-surface px-3 text-base text-ink placeholder:text-ink-3"
                  type="number"
                  min={1}
                  max={10}
                  value={maxUses}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setMaxUses(Number(event.currentTarget.value))
                  }
                />
              </label>
              <button
                className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control bg-accent px-4 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                <span>Generate Code</span>
              </button>
              {inviteMessage && <p className="text-xs text-emerald-600">{inviteMessage}</p>}
              {inviteError && <p className="text-xs text-warn-fg">{inviteError}</p>}
            </div>
          </div>

          <div className="rounded-card border border-border bg-surface p-6">
            <SectionLabel>Active codes</SectionLabel>
            <ul className="mt-4 space-y-3 text-sm">
              {invitesQuery.data?.length ? (
                invitesQuery.data.map((invite) => (
                  <li
                    key={invite.code_id}
                    className="flex items-center justify-between rounded-2xl border border-white/30 bg-surface p-4 shadow-token dark:border-border dark:bg-surface-2"
                  >
                    <div>
                      <p className="font-mono text-sm">{invite.code}</p>
                      <p className="text-xs text-ink-3">
                        Role {invite.role} • {invite.used_count}/{invite.max_uses} uses •{' '}
                        {invite.status}
                      </p>
                    </div>
                    {invite.status === 'active' && (
                      <button
                        className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 font-medium text-ink transition hover:bg-surface-3"
                        onClick={() => revokeMutation.mutate(invite.code)}
                      >
                        <span>Revoke</span>
                      </button>
                    )}
                  </li>
                ))
              ) : (
                <p className="text-sm text-ink-3">No codes yet.</p>
              )}
            </ul>
            {revokeMessage && <p className="mt-3 text-xs text-emerald-600">{revokeMessage}</p>}
            {revokeError && <p className="mt-3 text-xs text-warn-fg">{revokeError}</p>}
          </div>
        </>
      )}

      {showInviteTab && !isOrgAdmin && (
        <p className="text-sm text-ink-3">
          Only organization administrators can manage invite codes.
        </p>
      )}

      {activeTab === 'stages' && (
        <div className="rounded-card border border-border bg-surface p-6">
          <AdminStatusesPage />
        </div>
      )}

      {activeTab === 'agencies' && (
        <div className="rounded-card border border-border bg-surface p-6">
          <AdminAgenciesPage />
        </div>
      )}

      {activeTab === 'jobs' &&
        (isOrgAdmin ? (
          <div className="rounded-card border border-border bg-surface p-6">
            <AdminJobsPage />
          </div>
        ) : (
          <p className="text-sm text-ink-3">
            Only organization administrators can manage job requisitions.
          </p>
        ))}
    </section>
  );
}
