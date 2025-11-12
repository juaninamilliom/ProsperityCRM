import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser } from '../api/users';
import { createInviteCode, fetchInviteCodes, revokeInvite } from '../api/invites';

export function AccountSettingsPage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: fetchCurrentUser });
  const organizationId = currentUser?.dbUser?.organization_id;
  const isOrgAdmin = currentUser?.dbUser?.role === 'OrgAdmin';

  const [role, setRole] = useState<'OrgAdmin' | 'OrgEmployee'>('OrgEmployee');
  const [maxUses, setMaxUses] = useState(1);

  const invitesQuery = useQuery({
    queryKey: ['invites', organizationId],
    queryFn: () => fetchInviteCodes(organizationId!),
    enabled: Boolean(organizationId && isOrgAdmin),
  });

  const createMutation = useMutation({
    mutationFn: () => createInviteCode(organizationId!, { role, maxUses }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', organizationId] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (code: string) => revokeInvite(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', organizationId] });
    },
  });

  if (!isOrgAdmin) {
    return <p className="text-sm text-slate-500">Only organization administrators can manage invite codes.</p>;
  }

  return (
    <section className="space-y-6">
      <div className="glass-card">
        <h2 className="text-lg font-semibold text-slate-700 dark:text-white">Generate Passcode</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Share passcodes with teammates to onboard them via SSO. Codes are single use unless you raise the max-uses value.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex flex-col text-sm text-slate-600 dark:text-slate-200">
            Role
            <select className="pill-input" value={role} onChange={(event) => setRole(event.target.value as 'OrgAdmin' | 'OrgEmployee')}>
              <option value="OrgEmployee">OrgEmployee</option>
              <option value="OrgAdmin">OrgAdmin</option>
            </select>
          </label>
          <label className="flex flex-col text-sm text-slate-600 dark:text-slate-200">
            Max Uses
            <input className="pill-input" type="number" min={1} max={10} value={maxUses} onChange={(event) => setMaxUses(Number(event.target.value))} />
          </label>
          <button
            className="self-end rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-soft"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isLoading}
          >
            Generate Code
          </button>
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
                    Role {invite.role} • {invite.used_count}/{invite.max_uses} uses • {invite.status}
                  </p>
                </div>
                {invite.status === 'active' && (
                  <button className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-brand-fuchsia shadow-inner" onClick={() => revokeMutation.mutate(invite.code)}>
                    Revoke
                  </button>
                )}
              </li>
            ))
          ) : (
            <p className="text-sm text-slate-500">No codes yet.</p>
          )}
        </ul>
      </div>
    </section>
  );
}
