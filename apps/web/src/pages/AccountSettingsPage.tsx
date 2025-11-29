import { ChangeEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Select from 'react-select';
import { fetchCurrentUser } from '../api/users';
import { createInviteCode, fetchInviteCodes, revokeInvite } from '../api/invites';
import { AdminStatusesPage } from './AdminStatusesPage';
import { AdminAgenciesPage } from './AdminAgenciesPage';
import { AdminJobsPage } from './AdminJobsPage';
import { useTheme } from 'src/theme';
import { getSelectStyles } from 'src/components/selectStyles';

const tabs = ['General', 'Invites', 'Statuses', 'Agencies', 'Jobs'] as const;
type SelectOption = { value: string; label: string };

const roleOptions: SelectOption[] = [
  { value: 'OrgEmployee', label: 'OrgEmployee' },
  { value: 'OrgAdmin', label: 'OrgAdmin' },
];

export function AccountSettingsPage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: fetchCurrentUser });
  const organizationId = currentUser?.dbUser?.organization_id;
  const isOrgAdmin = currentUser?.dbUser?.role === 'OrgAdmin';
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('General');
  const [role, setRole] = useState<'OrgAdmin' | 'OrgEmployee'>('OrgEmployee');
  const [maxUses, setMaxUses] = useState(1);
  const [theme, toggleTheme] = useTheme();
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [revokeMessage, setRevokeMessage] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

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

  const showInviteTab = activeTab === 'Invites';

  const selectStyles = getSelectStyles(theme);
  
  return (
    <section className="space-y-6">
      <div className="flex gap-3 overflow-x-auto rounded-full border border-slate-200 px-3 py-2 dark:border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              activeTab === tab
                ? 'bg-brand-fuchsia text-white shadow-soft'
                : 'text-slate-500 dark:text-slate-300'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'General' && (
        <div className="glass-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-700 dark:text-white">Theme</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Choose the preferred color mode for this device.
              </p>
            </div>
            <button className="btn-outline" onClick={toggleTheme}>
              <span>{theme === 'light' ? 'Enable Dark Mode' : 'Enable Light Mode'}</span>
            </button>
          </div>
        </div>
      )}

      {showInviteTab && isOrgAdmin && (
        <>
          <div className="glass-card">
            <h2 className="text-lg font-semibold text-slate-700 dark:text-white">
              Generate Passcode
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Share passcodes with teammates to onboard them via SSO. Codes are single use unless
              you raise the max-uses value.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <label className="flex flex-col text-sm font-semibold text-slate-600 dark:text-slate-200">
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
              <label className="flex flex-col text-sm font-semibold text-slate-600 dark:text-slate-200">
                Max Uses
                <input
                  className="pill-input"
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
                className="btn-outline"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                <span>Generate Code</span>
              </button>
              {inviteMessage && <p className="text-xs text-emerald-600">{inviteMessage}</p>}
              {inviteError && <p className="text-xs text-red-500">{inviteError}</p>}
            </div>
          </div>

          <div className="glass-card">
            <h3 className="text-base font-semibold text-slate-700 dark:text-white">Active Codes</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {invitesQuery.data?.length ? (
                invitesQuery.data.map((invite) => (
                  <li
                    key={invite.code_id}
                    className="flex items-center justify-between rounded-2xl border border-white/30 bg-white/70 p-4 shadow-soft dark:border-slate-800/70 dark:bg-slate-900/70"
                  >
                    <div>
                      <p className="font-mono text-sm">{invite.code}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Role {invite.role} • {invite.used_count}/{invite.max_uses} uses •{' '}
                        {invite.status}
                      </p>
                    </div>
                    {invite.status === 'active' && (
                      <button
                        className="btn-outline"
                        onClick={() => revokeMutation.mutate(invite.code)}
                      >
                        <span>Revoke</span>
                      </button>
                    )}
                  </li>
                ))
              ) : (
                <p className="text-sm text-slate-500">No codes yet.</p>
              )}
            </ul>
            {revokeMessage && <p className="mt-3 text-xs text-emerald-600">{revokeMessage}</p>}
            {revokeError && <p className="mt-3 text-xs text-red-500">{revokeError}</p>}
          </div>
        </>
      )}

      {showInviteTab && !isOrgAdmin && (
        <p className="text-sm text-slate-500">
          Only organization administrators can manage invite codes.
        </p>
      )}

      {activeTab === 'Statuses' && (
        <div className="glass-card">
          <AdminStatusesPage />
        </div>
      )}

      {activeTab === 'Agencies' && (
        <div className="glass-card">
          <AdminAgenciesPage />
        </div>
      )}

      {activeTab === 'Jobs' &&
        (isOrgAdmin ? (
          <div className="glass-card">
            <AdminJobsPage />
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Only organization administrators can manage job requisitions.
          </p>
        ))}
    </section>
  );
}
