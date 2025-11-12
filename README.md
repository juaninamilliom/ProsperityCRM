# Prosperity CRM

Custom CRM for recruiting agencies with candidate tracking, configurable statuses, and target agency management.

## Getting Started

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill connection details (including `ROOT_ADMIN_TOKEN`)
3. Start API and web: `npm run dev`

See `AGENTS.md` for contributor details.

## Provisioning Flow

1. Use the super-admin routes (prefixed with `/admin` and guarded by the `x-admin-token` header) to create an organization.
2. Generate an invite/passcode for that organization either via the super-admin route or through the org admin UI once an admin exists.
3. Share the passcode with the initial administrator so they can sign in via SSO. During the first `/users/sso` call, passcodes determine whether the user becomes `OrgAdmin` or `OrgEmployee`.
4. Org admins can rotate roles for members (`PATCH /users/:id/role`) and manage additional invite codes from the “Settings” page in the web app.

> Every user must be associated with an organization. Roles are limited to `OrgAdmin` (full admin) and `OrgEmployee` (standard user). Passcodes are single-use by default; revoke them via `/invite-codes/:code/revoke` if leaked.
