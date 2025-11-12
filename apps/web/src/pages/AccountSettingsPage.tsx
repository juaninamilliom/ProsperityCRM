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
      <div className="rounded-card border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className="text-lg font-semibold">Generate Passcode</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Share passcodes with teammates to onboard them via SSO. Codes are single use unless you raise the max-uses value.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex flex-col text-sm">
            Role
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              value={role}
              onChange={(event) => setRole(event.target.value as 'OrgAdmin' | 'OrgEmployee')}
            >
              <option value="OrgEmployee">OrgEmployee</option>
              <option value="OrgAdmin">OrgAdmin</option>
            </select>
          </label>
          <label className="flex flex-col text-sm">
            Max Uses
            <input
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              type="number"
              min={1}
              max={10}
              value={maxUses}
              onChange={(event) => setMaxUses(Number(event.target.value))}
            />
          </label>
          <button
            className="self-end rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isLoading}
          >
            Generate Code
          </button>
        </div>
      </div>

      <div className="rounded-card border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60">
        <h3 className="text-base font-semibold">Active Codes</h3>
        <ul className="mt-4 space-y-3 text-sm">
          {invitesQuery.data?.length ? (
            invitesQuery.data.map((invite) => (
              <li key={invite.code_id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <div>
                  <p className="font-mono text-sm">{invite.code}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Role {invite.role} • {invite.used_count}/{invite.max_uses} uses • {invite.status}
                  </p>
                </div>
                {invite.status === 'active' && (
                  <button className="text-sm text-red-500" onClick={() => revokeMutation.mutate(invite.code)}>
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
