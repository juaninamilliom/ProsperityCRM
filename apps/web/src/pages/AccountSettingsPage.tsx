import { ChangeEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Select from 'react-select';
import { fetchCurrentUser, fetchOrgUsers, updateUserRole } from '../api/users';
import { createInviteCode, fetchInviteCodes, revokeInvite } from '../api/invites';
import { deleteUserPasskey, fetchUserPasskeys, registerPasskey } from '../api/auth';
import { AdminStatusesPage } from './AdminStatusesPage';
import { AdminJobsPage } from './AdminJobsPage';
import { useTheme } from 'src/theme';
import { getSelectStyles } from 'src/components/selectStyles';
import { MembersTable } from '../components/MembersTable';
import { Button, Card, SectionLabel } from '../components/ui';
import type { Role } from 'src/common';

const TABS = [
  { id: 'organisation', label: 'Organisation' },
  { id: 'members', label: 'Members' },
  { id: 'security', label: 'Security & Passkeys' },
  { id: 'stages', label: 'Pipeline stages' },
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
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

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

  const passkeysQuery = useQuery({
    queryKey: ['passkeys'],
    queryFn: fetchUserPasskeys,
  });

  const registerPasskeyMutation = useMutation({
    mutationFn: (deviceName?: string) => registerPasskey(deviceName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      setPasskeyMessage('Passkey registered successfully! You can now use Touch ID / Face ID.');
      setPasskeyError(null);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as { message?: string })?.message ??
        'Failed to register passkey.';
      setPasskeyError(message);
      setPasskeyMessage(null);
    },
  });

  const deletePasskeyMutation = useMutation({
    mutationFn: (passkeyId: string) => deleteUserPasskey(passkeyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      setPasskeyMessage('Passkey removed.');
      setPasskeyError(null);
    },
    onError: () => {
      setPasskeyError('Failed to remove passkey.');
      setPasskeyMessage(null);
    },
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
      setInviteMessage(null);
    },
  });

  useEffect(() => {
    if (!inviteMessage && !inviteError && !revokeMessage && !revokeError && !passkeyMessage && !passkeyError) return;
    const timer = setTimeout(() => {
      setInviteMessage(null);
      setInviteError(null);
      setRevokeMessage(null);
      setRevokeError(null);
      setPasskeyMessage(null);
      setPasskeyError(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [inviteMessage, inviteError, revokeMessage, revokeError, passkeyMessage, passkeyError]);

  const showInviteTab = activeTab === 'members';
  const selectStyles = getSelectStyles();
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

      {activeTab === 'security' && (
        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-4 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <SectionLabel>Apple Passkeys & Biometrics</SectionLabel>
                <p className="text-sm text-ink-3 max-w-[580px]">
                  Passkeys let you sign into your account instantly with <strong>Touch ID, Face ID, or Windows Hello</strong> without typing or remembering a password.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => registerPasskeyMutation.mutate(navigator.userAgent.includes('Mac') ? 'MacBook Touch ID' : 'Mobile / Desktop Device')}
                disabled={registerPasskeyMutation.isPending}
                className="flex items-center gap-2"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004.07 9" />
                </svg>
                <span>{registerPasskeyMutation.isPending ? 'Prompting device…' : 'Register this Device'}</span>
              </Button>
            </div>

            {passkeyMessage && (
              <p className="rounded-[8px] bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 text-sm text-emerald-600 dark:text-emerald-400">
                {passkeyMessage}
              </p>
            )}
            {passkeyError && (
              <p className="rounded-[8px] bg-warn-bg px-3.5 py-2.5 text-sm text-warn-fg">{passkeyError}</p>
            )}

            <div className="mt-2 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-ink-2 mb-3">Your Registered Passkeys</h3>
              {passkeysQuery.isLoading ? (
                <p className="text-sm text-ink-3">Loading devices…</p>
              ) : passkeysQuery.data?.length ? (
                <ul className="space-y-2.5">
                  {passkeysQuery.data.map((item) => (
                    <li
                      key={item.passkey_id}
                      className="flex items-center justify-between rounded-card border border-border bg-surface-2 p-3.5 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-control bg-surface-3 text-ink">
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004.07 9" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-ink">{item.device_name || 'Passkey Device'}</p>
                          <p className="text-xs text-ink-3">
                            Created {new Date(item.created_at).toLocaleDateString()}
                            {item.last_used_at && ` • Last used ${new Date(item.last_used_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => deletePasskeyMutation.mutate(item.passkey_id)}
                        disabled={deletePasskeyMutation.isPending}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">
                  No passkeys registered yet. Click "Register this Device" to enable 1-click biometric sign-in.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {showInviteTab && isOrgAdmin && (
        <>
          <div className="rounded-card border border-border bg-surface p-6">
            <SectionLabel>Invite codes</SectionLabel>
            <p className="mt-1 text-sm text-ink-3">
              Share passcodes with teammates to onboard them via magic link or passcode. Codes are single use unless
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
                    className="flex items-center justify-between rounded-card bg-surface p-4 shadow-token dark:border-border"
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
