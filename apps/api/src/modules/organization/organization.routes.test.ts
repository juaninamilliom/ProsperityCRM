import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  asOrganization,
  asUser,
  bearerFor,
  buildApp,
  restoreEnvironment,
} from '../../test/app-harness.js';

/** `requireRole` checks the role and nothing else. Every admin route keyed by
 *  an organization or user id has to compare that id to the caller's own, and
 *  these did not - so any OrgAdmin could read every tenant and rename any of
 *  them. The invite routes already do the comparison; this brings these into
 *  line with that.
 *
 *  These are request tests because the finding is the ABSENCE of a check. A
 *  unit test on an extracted predicate would keep passing after somebody
 *  deleted the call site. */

// Every export of user.service.ts. Naming them all matters: Vite defers a
// missing one to call time, so an incomplete factory is silent until some
// later route test touches it, and then reads like a harness bug.
vi.mock('../user/user.service.js', () => ({
  getUserById: vi.fn(),
  getUserBySsoId: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUserRoleAndOrg: vi.fn(),
  listUsersByOrg: vi.fn(),
  createLocalUser: vi.fn(),
  listAllUsers: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('./organization.service.js', () => ({
  listOrganizations: vi.fn(),
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  getOrganizationById: vi.fn(),
}));

const OWN_ORG = '11111111-1111-1111-1111-111111111111';
const OTHER_ORG = '22222222-2222-2222-2222-222222222222';

const admin = asUser({ role: 'OrgAdmin', organization_id: OWN_ORG });
const employee = asUser({ role: 'OrgEmployee', organization_id: OWN_ORG });

let app: Express;
let adminAuth: string;
let employeeAuth: string;
let users: typeof import('../user/user.service.js');
let orgs: typeof import('./organization.service.js');

beforeAll(async () => {
  app = await buildApp();
  adminAuth = await bearerFor(admin);
  employeeAuth = await bearerFor(employee);
  users = await import('../user/user.service.js');
  orgs = await import('./organization.service.js');
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(users.getUserById).mockImplementation(async (id: string) =>
    [admin, employee].find((candidate) => candidate.user_id === id),
  );
  // Stubbed with BOTH tenants on purpose: it is the negative control for the
  // GET below. A regression to listOrganizations() would return two.
  vi.mocked(orgs.listOrganizations).mockResolvedValue([
    asOrganization({ organization_id: OWN_ORG }),
    asOrganization({ organization_id: OTHER_ORG, name: 'A Competitor', slug: 'competitor' }),
  ]);
  vi.mocked(orgs.getOrganizationById).mockResolvedValue(asOrganization({ organization_id: OWN_ORG }));
  vi.mocked(orgs.updateOrganization).mockResolvedValue(
    asOrganization({ organization_id: OWN_ORG, name: 'Renamed', slug: 'renamed' }),
  );
});

afterAll(restoreEnvironment);

describe('GET /organizations', () => {
  it('returns only the caller organization, not every tenant', async () => {
    const res = await request(app).get('/organizations').set('Authorization', employeeAuth);

    expect(res.status).toBe(200);
    expect(res.body.map((org: { organization_id: string }) => org.organization_id)).toEqual([OWN_ORG]);
    expect(orgs.listOrganizations).not.toHaveBeenCalled();
  });

  it('still requires a token', () => {
    return request(app).get('/organizations').expect(401);
  });
});

describe('PUT /organizations/:id', () => {
  it('renames the caller own organization', async () => {
    const res = await request(app)
      .put(`/organizations/${OWN_ORG}`)
      .set('Authorization', adminAuth)
      .send({ name: 'Renamed', slug: 'renamed' });

    expect(res.status).toBe(200);
    expect(orgs.updateOrganization).toHaveBeenCalledWith(OWN_ORG, expect.anything());
  });

  it('refuses to rename another organization', async () => {
    // The finding: requireRole('OrgAdmin') passed, and nothing compared the id
    // in the path to the caller own organization.
    const res = await request(app)
      .put(`/organizations/${OTHER_ORG}`)
      .set('Authorization', adminAuth)
      .send({ name: 'Owned', slug: 'owned' });

    expect(res.status).toBe(403);
    expect(orgs.updateOrganization).not.toHaveBeenCalled();
  });

  it('refuses an employee even on their own organization', async () => {
    const res = await request(app)
      .put(`/organizations/${OWN_ORG}`)
      .set('Authorization', employeeAuth)
      .send({ name: 'Renamed', slug: 'renamed' });

    expect(res.status).toBe(403);
    expect(orgs.updateOrganization).not.toHaveBeenCalled();
  });

  it('validates the body before touching anything', async () => {
    const res = await request(app)
      .put(`/organizations/${OWN_ORG}`)
      .set('Authorization', adminAuth)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(orgs.updateOrganization).not.toHaveBeenCalled();
  });
});

describe('POST /organizations', () => {
  it('no longer exists, because creating a tenant is the root admin job', async () => {
    // It was guarded only by requireRole('OrgAdmin'), so any org admin could
    // mint organizations. POST /admin/organizations is byte-for-byte the same
    // handler behind the root-admin header, so this one was pure surface.
    const res = await request(app)
      .post('/organizations')
      .set('Authorization', adminAuth)
      .send({ name: 'New Tenant', slug: 'new-tenant' });

    expect(res.status).toBe(404);
    expect(orgs.createOrganization).not.toHaveBeenCalled();
  });
});
