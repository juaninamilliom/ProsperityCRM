import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { asUser, bearerFor, buildApp, restoreEnvironment } from '../../test/app-harness.js';

/** Creating a duplicate entry for the same person and requisition was an
 *  unexplained 500, where person and company both answer a 409 carrying the
 *  existing row. The unique index is idx_entries_person_job (0010:104-105).
 *
 *  Reproducible from the seed: Ines is already on Senior Platform Engineer
 *  (seed.sql:125), so posting that pair again hits it. */

vi.mock('./entry.service.js', () => ({
  listEntries: vi.fn(),
  createEntry: vi.fn(),
  findDuplicateEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  getEntryById: vi.fn(),
  moveEntry: vi.fn(),
}));

vi.mock('../user/user.service.js', () => ({
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

const PERSON = '55555555-5555-5555-5555-555555555555';
const COMPANY = '66666666-6666-6666-6666-666666666666';
const JOB = '77777777-7777-7777-7777-777777777777';
const STATUS = '88888888-8888-8888-8888-888888888888';
const RECRUITER = '99999999-9999-9999-9999-999999999999';

const body = {
  person_id: PERSON,
  company_id: COMPANY,
  job_id: JOB,
  current_status_id: STATUS,
  recruiter_id: RECRUITER,
};

const user = asUser();

let app: Express;
let auth: string;
let entries: typeof import('./entry.service.js');
let users: typeof import('../user/user.service.js');

beforeAll(async () => {
  app = await buildApp();
  auth = await bearerFor(user);
  entries = await import('./entry.service.js');
  users = await import('../user/user.service.js');
});

afterAll(() => {
  restoreEnvironment();
});

beforeEach(() => {
  vi.mocked(users.getUserById).mockReset().mockResolvedValue(user);
  vi.mocked(entries.createEntry).mockReset();
  vi.mocked(entries.findDuplicateEntry).mockReset();
});

/** Wrapped the way drizzle hands a driver error on: `.code` on the outer error
 *  is undefined, and the text carries the SQL and the bound parameters. */
const wrapped = (code: string) => {
  const driver = Object.assign(new Error('driver text that must not be echoed'), {
    code,
    constraint: 'idx_entries_person_job',
    detail: 'Key (person_id, job_id)=(...) already exists.',
  });
  const wrapper = new Error('Failed query: insert into "pipeline_entries" ... params: 5555');
  (wrapper as { cause?: unknown }).cause = driver;
  return wrapper;
};

describe('POST /pipeline-entries', () => {
  it('creates an entry', async () => {
    vi.mocked(entries.createEntry).mockResolvedValue({ entry_id: 'e1' } as never);

    const response = await request(app)
      .post('/pipeline-entries')
      .set('Authorization', auth)
      .send(body);

    expect(response.status).toBe(201);
    expect(entries.findDuplicateEntry).not.toHaveBeenCalled();
  });

  it('answers a duplicate with a 409 carrying the existing entry', async () => {
    vi.mocked(entries.createEntry).mockRejectedValue(wrapped('23505'));
    vi.mocked(entries.findDuplicateEntry).mockResolvedValue({
      entry_id: 'existing-1',
      full_name: 'Ines Duarte',
      job_title: 'Senior Platform Engineer',
    } as never);

    const response = await request(app)
      .post('/pipeline-entries')
      .set('Authorization', auth)
      .send(body);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('This person is already on this requisition');
    expect(response.body.existing.entry_id).toBe('existing-1');
    // Enriched, so the caller can name who and what rather than showing an id.
    expect(response.body.existing.full_name).toBe('Ines Duarte');
    expect(JSON.stringify(response.body)).not.toContain('driver text');
  });

  it('looks the duplicate up by the pair the index constrains', async () => {
    vi.mocked(entries.createEntry).mockRejectedValue(wrapped('23505'));
    vi.mocked(entries.findDuplicateEntry).mockResolvedValue(null);

    await request(app).post('/pipeline-entries').set('Authorization', auth).send(body);

    expect(entries.findDuplicateEntry).toHaveBeenCalledWith(PERSON, JOB);
  });

  it('answers a bad reference with a 400 rather than a 500', async () => {
    // 23503: one of the five id columns points at a row that does not exist.
    vi.mocked(entries.createEntry).mockRejectedValue(wrapped('23503'));

    const response = await request(app)
      .post('/pipeline-entries')
      .set('Authorization', auth)
      .send(body);

    expect(response.status).toBe(400);
    expect(entries.findDuplicateEntry).not.toHaveBeenCalled();
  });

  it('answers a non-uuid id with a 400 rather than a 500', async () => {
    // createEntrySchema validates person_id as z.string().min(1), so a non-uuid
    // passes zod and reaches the driver as 22P02.
    vi.mocked(entries.createEntry).mockRejectedValue(wrapped('22P02'));

    const response = await request(app)
      .post('/pipeline-entries')
      .set('Authorization', auth)
      .send({ ...body, person_id: 'not-a-uuid' });

    expect(response.status).toBe(400);
    expect(entries.findDuplicateEntry).not.toHaveBeenCalled();
  });

  it('lets an error that is not a Postgres error reach the error handler', async () => {
    vi.mocked(entries.createEntry).mockRejectedValue(new Error('something else entirely'));

    const response = await request(app)
      .post('/pipeline-entries')
      .set('Authorization', auth)
      .send(body);

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('something else entirely');
  });
});
