-- Development data for the two funnels.
--
-- NEVER run against real data: it truncates the BD and pipeline tables.
-- It deliberately does NOT touch organizations, users or status_config - the
-- login and the status ladder already exist and are resolved by lookup, so
-- re-seeding never costs you your account.

do $$
declare
  v_org   uuid;
  v_user  uuid;
  s_sourced uuid; s_screening uuid; s_interviewing uuid;
  s_offer uuid; s_placed uuid; s_rejected uuid;

  c_meridian uuid; c_halcyon uuid; c_northwind uuid;
  c_cobalt uuid; c_pelham uuid; c_kestrel uuid;

  p_priya uuid; p_nadia uuid; p_quentin uuid; p_marcus uuid; p_ines uuid;

  o_supplier uuid; o_datateam uuid; o_retainer uuid; o_design uuid; o_clinical uuid;

  j_platform uuid; j_data uuid; j_clinical uuid;

  e_priya_placed uuid; e_priya_declined uuid; e_marcus uuid; e_ines_a uuid; e_ines_b uuid;
begin
  select organization_id into v_org from organizations order by created_at limit 1;
  select user_id into v_user from users where organization_id = v_org order by created_at limit 1;
  if v_org is null or v_user is null then
    raise exception 'Seed needs an organisation and a user. Sign up first.';
  end if;

  select status_id into s_sourced      from status_config where name = 'Sourced';
  select status_id into s_screening    from status_config where name = 'Screening';
  select status_id into s_interviewing from status_config where name = 'Interviewing';
  select status_id into s_offer        from status_config where name = 'Offer Extended';
  select status_id into s_placed       from status_config where name = 'Placed';
  select status_id into s_rejected     from status_config where name = 'Rejected';

  truncate activities, opportunity_contacts, bd_opportunities,
           entry_status_history, pipeline_entries cascade;
  delete from job_requisitions;
  delete from people;
  delete from companies;

  -- Companies span every relationship value so the filter has content.
  insert into companies (organization_id, name, domain, industry, headcount, location, relationship) values
    (v_org, 'Meridian Software',  'meridiansoftware.com',   'Enterprise software', '201-500',  'Austin, TX',    'client'),
    (v_org, 'Halcyon Health',     'halcyonhealth.org',      'Healthcare',          '501-1000', 'Denver, CO',    'client'),
    (v_org, 'Northwind Robotics', 'northwind-robotics.com', 'Robotics',            '51-200',   'Pittsburgh, PA','prospect'),
    (v_org, 'Cobalt Interactive', 'cobalt.io',              'Product design',      '11-50',    'Remote',        'prospect'),
    (v_org, 'Pelham Group',       'pelhamgroup.co',         'Logistics',           '201-500',  'Newark, NJ',    'former'),
    (v_org, 'Kestrel Systems',    'kestrelsystems.com',     'Defence',             '1000+',    'Arlington, VA', 'do_not_contact');

  select company_id into c_meridian  from companies where name = 'Meridian Software';
  select company_id into c_halcyon   from companies where name = 'Halcyon Health';
  select company_id into c_northwind from companies where name = 'Northwind Robotics';
  select company_id into c_cobalt    from companies where name = 'Cobalt Interactive';
  select company_id into c_pelham    from companies where name = 'Pelham Group';
  select company_id into c_kestrel   from companies where name = 'Kestrel Systems';

  -- Priya is the flywheel case: placed in 2024, now a contact at a client.
  insert into people (organization_id, full_name, email, phone, linkedin_url, headline, location, current_company_id, current_title, skills, source) values
    (v_org, 'Priya Raman',    'priya@example.test',   '555-0101', 'https://www.linkedin.com/in/priyaraman',    'Platform engineering leader',  'Austin, TX', c_meridian, 'Director, Platform', '["Distributed systems","Go","Kubernetes","Postgres"]'::jsonb, 'manual'),
    (v_org, 'Nadia Brooks',   null,                   null,       'https://www.linkedin.com/in/nadiabrooks',   'VP Engineering at Meridian',   'Austin, TX', c_meridian, 'VP Engineering',     '[]'::jsonb, 'linkedin_capture'),
    (v_org, 'Quentin Shaw',   'quentin@example.test', null,       'https://www.linkedin.com/in/quentinshaw',   'Head of Talent',               'Austin, TX', c_meridian, 'Head of Talent',     '[]'::jsonb, 'manual'),
    (v_org, 'Marcus Oyelaran','marcus@example.test',  '555-0104', 'https://www.linkedin.com/in/marcusoyelaran','Staff data engineer',          'Remote',     null,       null,                 '["Python","dbt","Airflow"]'::jsonb, 'manual'),
    (v_org, 'Ines Delacroix', null,                   null,       'https://www.linkedin.com/in/inesdelacroix', 'Senior platform engineer',     'Denver, CO', null,       null,                 '["Go","Terraform"]'::jsonb, 'linkedin_capture');

  select person_id into p_priya   from people where full_name = 'Priya Raman';
  select person_id into p_nadia   from people where full_name = 'Nadia Brooks';
  select person_id into p_quentin from people where full_name = 'Quentin Shaw';
  select person_id into p_marcus  from people where full_name = 'Marcus Oyelaran';
  select person_id into p_ines    from people where full_name = 'Ines Delacroix';

  insert into bd_opportunities (organization_id, company_id, name, stage, fee_percent, est_annual_value, expected_close, owner_id, closed_at) values
    (v_org, c_meridian,  'Preferred supplier agreement', 'signed',      23, 140000, date '2026-08-08', v_user, timestamptz '2026-08-08 16:00+00'),
    (v_org, c_meridian,  'Data team build-out',          'meeting',     21,  74000, date '2026-09-30', v_user, null),
    (v_org, c_northwind, 'Engineering retainer',         'contacted',   22,  96000, date '2026-09-12', v_user, null),
    (v_org, c_cobalt,    'Product and design desk',      'proposal',    22,  88000, date '2026-09-05', v_user, null),
    (v_org, c_halcyon,   'Clinical contract',            'negotiation', 20,  54000, date '2026-10-01', v_user, null);

  select opportunity_id into o_supplier from bd_opportunities where name = 'Preferred supplier agreement';
  select opportunity_id into o_datateam from bd_opportunities where name = 'Data team build-out';
  select opportunity_id into o_retainer from bd_opportunities where name = 'Engineering retainer';
  select opportunity_id into o_design   from bd_opportunities where name = 'Product and design desk';
  select opportunity_id into o_clinical from bd_opportunities where name = 'Clinical contract';

  insert into opportunity_contacts (opportunity_id, person_id, role) values
    (o_supplier, p_nadia,   'champion'),
    (o_supplier, p_quentin, 'decision_maker'),
    (o_supplier, p_priya,   'influencer'),
    (o_datateam, p_priya,   'intro');

  insert into job_requisitions (company_id, opportunity_id, title, department, location, status, stage, deal_amount, close_date, owner_name) values
    (c_meridian, o_supplier, 'Senior Platform Engineer', 'Engineering', 'Austin, TX', 'open', 'Interviewing', 42000, date '2026-09-20', 'Juan Guardado'),
    (c_meridian, o_supplier, 'Staff Data Engineer',      'Engineering', 'Remote',     'open', 'Sourcing',     46000, date '2026-10-15', 'Juan Guardado'),
    (c_halcyon,  null,       'Clinical Data Manager',    'Clinical',    'Denver, CO', 'open', 'Sourcing',     38000, date '2026-11-01', 'Juan Guardado');

  select job_id into j_platform from job_requisitions where title = 'Senior Platform Engineer';
  select job_id into j_data     from job_requisitions where title = 'Staff Data Engineer';
  select job_id into j_clinical from job_requisitions where title = 'Clinical Data Manager';

  -- Priya carries three entries against three different roles: the thing the
  -- old single job_requisition_id could not express.
  insert into pipeline_entries (organization_id, person_id, company_id, job_id, current_status_id, recruiter_id, flags, notes) values
    (v_org, p_priya,  c_halcyon,  null,       s_placed,       v_user, '[]'::jsonb,                'Placed March 2024. Fee invoiced at 22%.'),
    (v_org, p_priya,  c_cobalt,   null,       s_rejected,     v_user, '[]'::jsonb,                'Declined the offer over remote policy.'),
    (v_org, p_marcus, c_meridian, j_data,     s_screening,    v_user, '["Hot Prospect"]'::jsonb,  'Strong dbt background.'),
    (v_org, p_ines,   c_meridian, j_platform, s_interviewing, v_user, '[]'::jsonb,                'Second interview booked.'),
    (v_org, p_ines,   c_halcyon,  j_clinical, s_sourced,      v_user, '[]'::jsonb,                'Also a fit for the Halcyon role.');

  select entry_id into e_priya_placed   from pipeline_entries where person_id = p_priya and company_id = c_halcyon;
  select entry_id into e_marcus         from pipeline_entries where person_id = p_marcus;
  select entry_id into e_ines_a         from pipeline_entries where person_id = p_ines and job_id = j_platform;

  insert into entry_status_history (entry_id, from_status_id, to_status_id, changed_by)
  values (e_ines_a, s_screening, s_interviewing, v_user);

  -- Priya's timeline spans both funnels, which is what the person page shows.
  insert into activities (organization_id, person_id, company_id, opportunity_id, entry_id, channel, direction, occurred_at, subject, body, created_by) values
    (v_org, p_priya,   c_meridian, o_datateam, null,           'li_message', 'inbound',  timestamptz '2026-07-24 15:00+00', 'Intro offer',     'Offered to introduce me to Nadia - three platform roles opening.', v_user),
    (v_org, p_priya,   c_meridian, null,       null,           'meeting',    'outbound', timestamptz '2026-07-11 17:30+00', 'Coffee',          'Two years into the Halcyon placement, moved to Meridian in January.', v_user),
    (v_org, p_priya,   null,       null,       e_priya_placed, 'note',       'internal', timestamptz '2024-03-18 12:00+00', 'Placement',       'Started as Senior Platform Engineer. Fee invoiced at 22%.', v_user),
    (v_org, p_nadia,   c_meridian, o_supplier, null,           'li_message', 'inbound',  timestamptz '2026-08-18 09:15+00', 'Third req',       'Wants to add a platform req in October.', v_user),
    (v_org, p_quentin, c_meridian, o_supplier, null,           'email',      'outbound', timestamptz '2026-08-15 14:00+00', 'Fee schedule',    'Sent the updated fee schedule and two profiles.', v_user),
    (v_org, null,      c_meridian, o_supplier, null,           'note',       'internal', timestamptz '2026-08-08 16:00+00', 'Deal won',        'Preferred supplier agreement signed. Prospect became client.', v_user),
    (v_org, p_marcus,  null,       null,       e_marcus,       'li_inmail',  'outbound', timestamptz '2026-08-12 10:00+00', 'Staff Data role', 'Cold InMail about the Meridian data role.', v_user),
    (v_org, p_ines,    null,       null,       e_ines_a,       'call',       'outbound', timestamptz '2026-08-19 16:45+00', 'Interview prep',  'Walked through the platform team structure before round two.', v_user),
    (v_org, p_quentin, c_meridian, o_supplier, null,           'call',       'outbound', timestamptz '2026-08-01 11:00+00', 'Contract review', 'Procurement pushed back on the 25% ask; landed at 23%.', v_user),
    (v_org, null,      c_northwind,o_retainer, null,           'li_connect', 'outbound', timestamptz '2026-08-17 08:30+00', 'Connection',      'Connection request sent to their VP Eng.', v_user);

  raise notice 'Seeded % companies, % people, % deals',
    (select count(*) from companies), (select count(*) from people), (select count(*) from bd_opportunities);
end $$;
