import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { asUser, bearerFor, buildApp, restoreEnvironment, rootAdminToken } from './app-harness.js';

/** Four delete routes sat on foreign keys with no delete behaviour, so each one
 *  reached the client as a bare 500. One of them, DELETE /jobs/:id, is wired to
 *  a live admin button.
 *
 *  These live in one file rather than four because they are one finding and one
 *  pattern. Testing them together is what makes a divergence visible: if
 *  somebody adds a fifth delete and reaches for count-then-delete, or forgets
 *  the branch that keeps a malformed id out of the count, the shape of this
 *  file is where it shows.
 *
 *  Every one of them CATCHES rather than counting up front. A blocking foreign
 *  key announces itself — the delete raises 23503 and nothing has been
 *  destroyed — so catching costs no query on the success path and has no window
 *  between the count and the delete. The count runs only to name what is in the
 *  way. The company delete is the exception and is tested separately, because
 *  one of its dependents cascades and a cascade never raises. */

vi.mock('../modules/job/job.service.js', () => ({
  listJobs: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  countJobDependents: vi.fn(),
  deleteJob: vi.fn(),
  getJobWithStats: vi.fn(),
  getJobEntries: vi.fn(),
  listJobSplits: vi.fn(),
  replaceJobSplits: vi.fn(),
}));

vi.mock('../modules/status/status.service.js', () => ({
  listStatuses: vi.fn(),
  createStatus: vi.fn(),
  updateStatus: vi.fn(),
  countStatusDependents: vi.fn(),
  deleteStatus: vi.fn(),
}));

vi.mock('../modules/opportunity/opportunity.service.js', () => ({
  listOpportunities: vi.fn(),
  getOpportunity: vi.fn(),
  getOpportunityRaw: vi.fn(),
  createOpportunity: vi.fn(),
  updateOpportunity: vi.fn(),
  addContact: vi.fn(),
  removeContact: vi.fn(),
  countOpportunityDependents: vi.fn(),
  deleteOpportunity: vi.fn(),
  transitionOpportunityStage: vi.fn(),
}));

vi.mock('../modules/user/user.service.js', () => ({
  getUserBySsoId: vi.fn(),
  getUserById: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUserRoleAndOrg: vi.fn(),
  listUsersByOrg: vi.fn(),
  createLocalUser: vi.fn(),
  listAllUsers: vi.fn(),
  countUserDependents: vi.fn(),
  deleteUser: vi.fn(),
}));

const ID = '44444444-4444-4444-4444-444444444444';

const admin = asUser({ role: 'OrgAdmin' });

let app: Express;
let adminAuth: string;
let jobs: typeof import('../modules/job/job.service.js');
let statuses: typeof import('../modules/status/status.service.js');
let deals: typeof import('../modules/opportunity/opportunity.service.js');
let users: typeof import('../modules/user/user.service.js');

beforeAll(async () => {
  app = await buildApp();
  adminAuth = await bearerFor(admin);
  jobs = await import('../modules/job/job.service.js');
  statuses = await import('../modules/status/status.service.js');
  deals = await import('../modules/opportunity/opportunity.service.js');
  users = await import('../modules/user/user.service.js');
});

afterAll(() => {
  restoreEnvironment();
});

beforeEach(() => {
  vi.mocked(users.getUserById).mockReset().mockResolvedValue(admin);
  vi.mocked(jobs.deleteJob).mockReset();
  vi.mocked(jobs.countJobDependents).mockReset();
  vi.mocked(statuses.deleteStatus).mockReset();
  vi.mocked(statuses.countStatusDependents).mockReset();
  vi.mocked(deals.deleteOpportunity).mockReset();
  vi.mocked(deals.countOpportunityDependents).mockReset();
  vi.mocked(users.deleteUser).mockReset();
  vi.mocked(users.countUserDependents).mockReset();
});

/** A driver error as pg shapes one, wrapped the way drizzle hands it on:
 *  reading `.code` on the outer error finds nothing, which is the whole reason
 *  pgErrorOf walks the cause chain. The text is the thing that must never be
 *  echoed — it carries the SQL and the bound parameters. */
const wrapped = (code: string) => {
  const driver = Object.assign(new Error('driver text that must not be echoed'), {
    code,
    constraint: 'pipeline_entries_job_id_fkey',
    detail: 'Key (job_id)=(...) is still referenced from table "pipeline_entries".',
  });
  const wrapper = new Error('Failed query: delete from "job_requisitions" ... params: 4444');
  (wrapper as { cause?: unknown }).cause = driver;
  return wrapper;
};

describe('DELETE /jobs/:id', () => {
  it('names the candidates in the way instead of returning a 500', async () => {
    vi.mocked(jobs.deleteJob).mockRejectedValue(wrapped('23503'));
    vi.mocked(jobs.countJobDependents).mockResolvedValue({ entries: 3 });

    const response = await request(app).delete(`/jobs/${ID}`).set('Authorization', adminAuth);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'This requisition has 3 candidates in the pipeline. Move or remove them first.'
    );
    expect(JSON.stringify(response.body)).not.toContain('driver text');
  });

  it('uses the singular for one candidate', async () => {
    vi.mocked(jobs.deleteJob).mockRejectedValue(wrapped('23503'));
    vi.mocked(jobs.countJobDependents).mockResolvedValue({ entries: 1 });

    const response = await request(app).delete(`/jobs/${ID}`).set('Authorization', adminAuth);

    expect(response.body.message).toContain('1 candidate in the pipeline');
  });

  it('does not say "0 candidates" when the blocker is gone by count time', async () => {
    // The count runs after the failure, so the row can disappear in between.
    vi.mocked(jobs.deleteJob).mockRejectedValue(wrapped('23503'));
    vi.mocked(jobs.countJobDependents).mockResolvedValue({ entries: 0 });

    const response = await request(app).delete(`/jobs/${ID}`).set('Authorization', adminAuth);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Something still refers to this requisition.');
  });

  it('deletes a requisition nothing refers to', async () => {
    vi.mocked(jobs.deleteJob).mockResolvedValue(undefined);

    const response = await request(app).delete(`/jobs/${ID}`).set('Authorization', adminAuth);

    expect(response.status).toBe(204);
    expect(jobs.countJobDependents).not.toHaveBeenCalled();
  });

  it('answers a malformed id with a 400 and does not run the count', async () => {
    // classify maps 22P02 to a 400. No path parameter is validated anywhere and
    // every id column is uuid, so this reaches the driver. Falling through to
    // the count would re-throw the same error from inside the catch.
    vi.mocked(jobs.deleteJob).mockRejectedValue(wrapped('22P02'));

    const response = await request(app).delete('/jobs/not-a-uuid').set('Authorization', adminAuth);

    expect(response.status).toBe(400);
    expect(jobs.countJobDependents).not.toHaveBeenCalled();
  });
});

describe('DELETE /statuses/:id', () => {
  it('names live entries and history rows separately', async () => {
    vi.mocked(statuses.deleteStatus).mockRejectedValue(wrapped('23503'));
    vi.mocked(statuses.countStatusDependents).mockResolvedValue({ entries: 1, history: 4 });

    const response = await request(app).delete(`/statuses/${ID}`).set('Authorization', adminAuth);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'This status is still used by 1 pipeline entry and 4 status history rows.'
    );
  });

  it('explains a status blocked only by history', async () => {
    // The trap: no live entries, still undeletable. Without naming the history
    // an admin moves every entry off the status and gets the same 409 with
    // nothing left to act on.
    vi.mocked(statuses.deleteStatus).mockRejectedValue(wrapped('23503'));
    vi.mocked(statuses.countStatusDependents).mockResolvedValue({ entries: 0, history: 4 });

    const response = await request(app).delete(`/statuses/${ID}`).set('Authorization', adminAuth);

    expect(response.body.message).toBe('This status is still used by 4 status history rows.');
  });

  it('answers a malformed id with a 400 and does not run the count', async () => {
    vi.mocked(statuses.deleteStatus).mockRejectedValue(wrapped('22P02'));

    const response = await request(app)
      .delete('/statuses/not-a-uuid')
      .set('Authorization', adminAuth);

    expect(response.status).toBe(400);
    expect(statuses.countStatusDependents).not.toHaveBeenCalled();
  });
});

describe('DELETE /opportunities/:opportunityId', () => {
  it('names the requisitions the deal produced', async () => {
    vi.mocked(deals.deleteOpportunity).mockRejectedValue(wrapped('23503'));
    vi.mocked(deals.countOpportunityDependents).mockResolvedValue({ requisitions: 2 });

    const response = await request(app)
      .delete(`/opportunities/${ID}`)
      .set('Authorization', adminAuth);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'This deal produced 2 requisitions. Detach or delete them first.'
    );
  });

  it('does not say "0 requisitions" when the blocker is gone by count time', async () => {
    vi.mocked(deals.deleteOpportunity).mockRejectedValue(wrapped('23503'));
    vi.mocked(deals.countOpportunityDependents).mockResolvedValue({ requisitions: 0 });

    const response = await request(app)
      .delete(`/opportunities/${ID}`)
      .set('Authorization', adminAuth);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Something still refers to this deal.');
  });

  it('answers a malformed id with a 400 and does not run the count', async () => {
    vi.mocked(deals.deleteOpportunity).mockRejectedValue(wrapped('22P02'));

    const response = await request(app)
      .delete('/opportunities/not-a-uuid')
      .set('Authorization', adminAuth);

    expect(response.status).toBe(400);
    expect(deals.countOpportunityDependents).not.toHaveBeenCalled();
  });
});

describe('DELETE /admin/users/:id', () => {
  it('names every kind of work the user is attached to', async () => {
    vi.mocked(users.deleteUser).mockRejectedValue(wrapped('23503'));
    vi.mocked(users.countUserDependents).mockResolvedValue({
      entries: 4,
      history: 0,
      activities: 12,
      deals: 5,
      invites: 0,
    });

    const response = await request(app)
      .delete(`/admin/users/${ID}`)
      .set('x-admin-token', rootAdminToken());

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'This user is the recruiter on 4 pipeline entries, owns 5 deals and appears on 12 activities.'
    );
  });

  it('answers a malformed id with a 400 and does not run the count', async () => {
    vi.mocked(users.deleteUser).mockRejectedValue(wrapped('22P02'));

    const response = await request(app)
      .delete('/admin/users/not-a-uuid')
      .set('x-admin-token', rootAdminToken());

    expect(response.status).toBe(400);
    expect(users.countUserDependents).not.toHaveBeenCalled();
  });

  it('still refuses without the root admin token', async () => {
    const response = await request(app).delete(`/admin/users/${ID}`);

    expect(response.status).toBe(403);
    expect(users.deleteUser).not.toHaveBeenCalled();
  });
});
