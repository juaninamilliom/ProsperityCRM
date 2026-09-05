import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { asUser, bearerFor, buildApp, restoreEnvironment } from '../../test/app-harness.js';

/** The delete guard counted pipeline entries only. Contacts and requisitions
 *  block the delete and came back as a bare 500; deals cascade, so a company
 *  with only deals reported 204 and took them - and the activity recording how
 *  it became a client - with it.
 *
 *  These are request tests because the finding is about which dependents the
 *  route notices. A unit test on the count would keep passing after somebody
 *  narrowed the route back down to one of them. */

// Every export of company.service.ts. Naming them all matters: Vite defers a
// missing one to call time, so an incomplete factory is silent until some
// later route test touches it, and then reads like a harness bug.
vi.mock('./company.service.js', () => ({
  listCompanies: vi.fn(),
  getCompany: vi.fn(),
  createCompany: vi.fn(),
  updateCompany: vi.fn(),
  findDuplicateCompany: vi.fn(),
  countCompanyDependents: vi.fn(),
  deleteCompanyIfUnreferenced: vi.fn(),
}));

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

const COMPANY = '33333333-3333-3333-3333-333333333333';

const user = asUser();

const none = { people: 0, requisitions: 0, entries: 0, deals: 0 };

let app: Express;
let auth: string;
let companies: typeof import('./company.service.js');
let users: typeof import('../user/user.service.js');

beforeAll(async () => {
  app = await buildApp();
  auth = await bearerFor(user);
  companies = await import('./company.service.js');
  users = await import('../user/user.service.js');
});

afterAll(() => {
  restoreEnvironment();
});

beforeEach(() => {
  vi.mocked(users.getUserById).mockReset().mockResolvedValue(user);
  vi.mocked(companies.deleteCompanyIfUnreferenced).mockReset();
});

/** A drizzle error as the driver shapes one, wrapped the way drizzle hands it
 *  on. Reading `.code` on the outer error finds nothing. */
const wrappedPgError = (code: string) => {
  const driver = Object.assign(new Error('driver text that must not be echoed'), {
    code,
    constraint: 'companies_pkey',
    detail: 'Key (company_id)=(...) is still referenced.',
  });
  const wrapper = new Error('Failed query: delete from "companies" ... params: 33333333');
  (wrapper as { cause?: unknown }).cause = driver;
  return wrapper;
};

describe('DELETE /companies/:companyId', () => {
  it('deletes a company nothing refers to', async () => {
    vi.mocked(companies.deleteCompanyIfUnreferenced).mockResolvedValue({ deleted: true });

    const response = await request(app).delete(`/companies/${COMPANY}`).set('Authorization', auth);

    expect(response.status).toBe(204);
  });

  it('refuses on deals alone, which the old guard deleted silently', async () => {
    // The whole P2 proof. Deals cascade, so the previous guard counted zero
    // blocking dependents, returned 204, and destroyed them.
    vi.mocked(companies.deleteCompanyIfUnreferenced).mockResolvedValue({
      deleted: false,
      dependents: { ...none, deals: 1 },
    });

    const response = await request(app).delete(`/companies/${COMPANY}`).set('Authorization', auth);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('This company still has 1 deal.');
    expect(response.body.dependents.deals).toBe(1);
  });

  it('names contacts and requisitions, which used to be a bare 500', async () => {
    vi.mocked(companies.deleteCompanyIfUnreferenced).mockResolvedValue({
      deleted: false,
      dependents: { people: 2, requisitions: 1, entries: 0, deals: 0 },
    });

    const response = await request(app).delete(`/companies/${COMPANY}`).set('Authorization', auth);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('This company still has 2 contacts and 1 requisition.');
  });

  it('names all four when all four are present', async () => {
    vi.mocked(companies.deleteCompanyIfUnreferenced).mockResolvedValue({
      deleted: false,
      dependents: { people: 2, requisitions: 1, entries: 4, deals: 7 },
    });

    const response = await request(app).delete(`/companies/${COMPANY}`).set('Authorization', auth);

    expect(response.body.message).toBe(
      'This company still has 2 contacts, 1 requisition, 4 pipeline entries and 7 deals.'
    );
  });

  it('turns a foreign key violation into a 409 rather than a 500', async () => {
    // The backstop for a sixth foreign key nobody adds to the count.
    vi.mocked(companies.deleteCompanyIfUnreferenced).mockRejectedValue(wrappedPgError('23503'));

    const response = await request(app).delete(`/companies/${COMPANY}`).set('Authorization', auth);

    expect(response.status).toBe(409);
    expect(JSON.stringify(response.body)).not.toContain('driver text');
  });

  it('turns a malformed id into a 400 rather than a 500', async () => {
    // No path parameter is validated anywhere and every id column is uuid, so
    // this reaches the driver.
    vi.mocked(companies.deleteCompanyIfUnreferenced).mockRejectedValue(wrappedPgError('22P02'));

    const response = await request(app).delete('/companies/not-a-uuid').set('Authorization', auth);

    expect(response.status).toBe(400);
  });

  it('still requires a bearer token', async () => {
    const response = await request(app).delete(`/companies/${COMPANY}`);

    expect(response.status).toBe(401);
    expect(companies.deleteCompanyIfUnreferenced).not.toHaveBeenCalled();
  });
});
