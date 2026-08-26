import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  organization_id: uuid('organization_id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  user_id: uuid('user_id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role', { enum: ['OrgAdmin', 'OrgEmployee'] }).default('OrgEmployee').notNull(),
  sso_id: text('sso_id').unique(),
  password: text('password'),
  is_active: boolean('is_active').default(true).notNull(),
  organization_id: uuid('organization_id')
    .references(() => organizations.organization_id)
    .notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const statusConfig = pgTable('status_config', {
  status_id: uuid('status_id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  order_index: integer('order_index').notNull(),
  is_terminal: boolean('is_terminal').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const companies = pgTable('companies', {
  company_id: uuid('company_id').defaultRandom().primaryKey(),
  organization_id: uuid('organization_id')
    .references(() => organizations.organization_id)
    .notNull(),
  name: text('name').notNull(),
  linkedin_url: text('linkedin_url'),
  domain: text('domain'),
  industry: text('industry'),
  headcount: text('headcount'),
  location: text('location'),
  relationship: text('relationship', {
    enum: ['prospect', 'client', 'former', 'do_not_contact'],
  })
    .default('prospect')
    .notNull(),
  contact_email: text('contact_email'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const people = pgTable('people', {
  person_id: uuid('person_id').defaultRandom().primaryKey(),
  organization_id: uuid('organization_id')
    .references(() => organizations.organization_id)
    .notNull(),
  full_name: text('full_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  linkedin_url: text('linkedin_url'),
  headline: text('headline'),
  location: text('location'),
  current_company_id: uuid('current_company_id').references(() => companies.company_id),
  current_title: text('current_title'),
  skills: jsonb('skills').$type<string[]>().default([]).notNull(),
  notes: text('notes'),
  source: text('source', { enum: ['manual', 'linkedin_capture', 'import'] })
    .default('manual')
    .notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const bdOpportunities = pgTable('bd_opportunities', {
  opportunity_id: uuid('opportunity_id').defaultRandom().primaryKey(),
  organization_id: uuid('organization_id')
    .references(() => organizations.organization_id)
    .notNull(),
  company_id: uuid('company_id')
    .references(() => companies.company_id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  stage: text('stage', {
    enum: ['prospect', 'contacted', 'meeting', 'proposal', 'negotiation', 'signed', 'lost'],
  })
    .default('prospect')
    .notNull(),
  fee_percent: numeric('fee_percent'),
  est_annual_value: numeric('est_annual_value'),
  expected_close: text('expected_close'),
  owner_id: uuid('owner_id').references(() => users.user_id),
  lost_reason: text('lost_reason'),
  closed_at: timestamp('closed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const opportunityContacts = pgTable(
  'opportunity_contacts',
  {
    opportunity_id: uuid('opportunity_id')
      .references(() => bdOpportunities.opportunity_id, { onDelete: 'cascade' })
      .notNull(),
    person_id: uuid('person_id')
      .references(() => people.person_id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role', { enum: ['champion', 'decision_maker', 'influencer', 'blocker', 'intro'] }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.opportunity_id, table.person_id] }),
  })
);

export const jobRequisitions = pgTable('job_requisitions', {
  job_id: uuid('job_id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  department: text('department'),
  location: text('location'),
  status: text('status').default('open').notNull(),
  description: text('description'),
  close_date: text('close_date'),
  deal_amount: numeric('deal_amount'),
  weighted_deal_amount: numeric('weighted_deal_amount'),
  owner_name: text('owner_name'),
  stage: text('stage'),
  company_id: uuid('company_id').references(() => companies.company_id),
  opportunity_id: uuid('opportunity_id').references(() => bdOpportunities.opportunity_id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const jobDealSplits = pgTable('job_deal_splits', {
  split_id: uuid('split_id').defaultRandom().primaryKey(),
  job_id: uuid('job_id')
    .references(() => jobRequisitions.job_id, { onDelete: 'cascade' })
    .notNull(),
  teammate_name: text('teammate_name').notNull(),
  teammate_status: text('teammate_status').default('active').notNull(),
  split_percent: numeric('split_percent').notNull(),
  role: text('role').default('lead').notNull(),
  total_deal: numeric('total_deal').notNull(),
  weighted_deal: numeric('weighted_deal').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const pipelineEntries = pgTable('pipeline_entries', {
  entry_id: uuid('entry_id').defaultRandom().primaryKey(),
  organization_id: uuid('organization_id')
    .references(() => organizations.organization_id)
    .notNull(),
  person_id: uuid('person_id')
    .references(() => people.person_id, { onDelete: 'cascade' })
    .notNull(),
  company_id: uuid('company_id')
    .references(() => companies.company_id)
    .notNull(),
  job_id: uuid('job_id').references(() => jobRequisitions.job_id),
  current_status_id: uuid('current_status_id')
    .references(() => statusConfig.status_id)
    .notNull(),
  recruiter_id: uuid('recruiter_id')
    .references(() => users.user_id)
    .notNull(),
  flags: jsonb('flags').$type<string[]>().default([]).notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const entryStatusHistory = pgTable('entry_status_history', {
  history_id: uuid('history_id').defaultRandom().primaryKey(),
  entry_id: uuid('entry_id')
    .references(() => pipelineEntries.entry_id, { onDelete: 'cascade' })
    .notNull(),
  from_status_id: uuid('from_status_id').references(() => statusConfig.status_id),
  to_status_id: uuid('to_status_id')
    .references(() => statusConfig.status_id)
    .notNull(),
  change_date: timestamp('change_date', { withTimezone: true }).defaultNow().notNull(),
  changed_by: uuid('changed_by').references(() => users.user_id),
});

export const activities = pgTable('activities', {
  activity_id: uuid('activity_id').defaultRandom().primaryKey(),
  organization_id: uuid('organization_id')
    .references(() => organizations.organization_id)
    .notNull(),
  person_id: uuid('person_id').references(() => people.person_id, { onDelete: 'cascade' }),
  company_id: uuid('company_id').references(() => companies.company_id, { onDelete: 'cascade' }),
  opportunity_id: uuid('opportunity_id').references(() => bdOpportunities.opportunity_id, {
    onDelete: 'cascade',
  }),
  entry_id: uuid('entry_id').references(() => pipelineEntries.entry_id, {
    onDelete: 'cascade',
  }),
  channel: text('channel').notNull(),
  direction: text('direction').default('outbound').notNull(),
  occurred_at: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  subject: text('subject'),
  body: text('body'),
  created_by: uuid('created_by').references(() => users.user_id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const organizationSkills = pgTable('organization_skills', {
  skill_id: uuid('skill_id').defaultRandom().primaryKey(),
  organization_id: uuid('organization_id')
    .references(() => organizations.organization_id)
    .notNull(),
  name: text('name').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const orgInviteCodes = pgTable('org_invite_codes', {
  code_id: uuid('code_id').defaultRandom().primaryKey(),
  organization_id: uuid('organization_id')
    .references(() => organizations.organization_id)
    .notNull(),
  code: text('code').notNull().unique(),
  role: text('role').notNull(),
  max_uses: integer('max_uses').default(1).notNull(),
  used_count: integer('used_count').default(0).notNull(),
  status: text('status').default('active').notNull(),
  created_by: uuid('created_by').references(() => users.user_id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revoked_at: timestamp('revoked_at', { withTimezone: true }),
  revoked_by: uuid('revoked_by').references(() => users.user_id),
  metadata: jsonb('metadata').default({}).notNull(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  companies: many(companies),
  people: many(people),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organization_id],
    references: [organizations.organization_id],
  }),
  pipelineEntries: many(pipelineEntries),
  activities: many(activities),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [companies.organization_id],
    references: [organizations.organization_id],
  }),
  people: many(people),
  opportunities: many(bdOpportunities),
  requisitions: many(jobRequisitions),
  pipelineEntries: many(pipelineEntries),
  activities: many(activities),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [people.organization_id],
    references: [organizations.organization_id],
  }),
  currentCompany: one(companies, {
    fields: [people.current_company_id],
    references: [companies.company_id],
  }),
  pipelineEntries: many(pipelineEntries),
  opportunityContacts: many(opportunityContacts),
  activities: many(activities),
}));

export const bdOpportunitiesRelations = relations(bdOpportunities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [bdOpportunities.organization_id],
    references: [organizations.organization_id],
  }),
  company: one(companies, {
    fields: [bdOpportunities.company_id],
    references: [companies.company_id],
  }),
  owner: one(users, {
    fields: [bdOpportunities.owner_id],
    references: [users.user_id],
  }),
  contacts: many(opportunityContacts),
  activities: many(activities),
}));

export const opportunityContactsRelations = relations(opportunityContacts, ({ one }) => ({
  opportunity: one(bdOpportunities, {
    fields: [opportunityContacts.opportunity_id],
    references: [bdOpportunities.opportunity_id],
  }),
  person: one(people, {
    fields: [opportunityContacts.person_id],
    references: [people.person_id],
  }),
}));

export const jobRequisitionsRelations = relations(jobRequisitions, ({ one, many }) => ({
  company: one(companies, {
    fields: [jobRequisitions.company_id],
    references: [companies.company_id],
  }),
  opportunity: one(bdOpportunities, {
    fields: [jobRequisitions.opportunity_id],
    references: [bdOpportunities.opportunity_id],
  }),
  splits: many(jobDealSplits),
  pipelineEntries: many(pipelineEntries),
}));

export const pipelineEntriesRelations = relations(pipelineEntries, ({ one, many }) => ({
  person: one(people, {
    fields: [pipelineEntries.person_id],
    references: [people.person_id],
  }),
  company: one(companies, {
    fields: [pipelineEntries.company_id],
    references: [companies.company_id],
  }),
  job: one(jobRequisitions, {
    fields: [pipelineEntries.job_id],
    references: [jobRequisitions.job_id],
  }),
  status: one(statusConfig, {
    fields: [pipelineEntries.current_status_id],
    references: [statusConfig.status_id],
  }),
  recruiter: one(users, {
    fields: [pipelineEntries.recruiter_id],
    references: [users.user_id],
  }),
  history: many(entryStatusHistory),
  activities: many(activities),
}));
