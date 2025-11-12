insert into status_config (name, order_index, is_terminal)
values
  ('Sourced', 0, false),
  ('Screening', 1, false),
  ('Interviewing', 2, false),
  ('Offer Extended', 3, false),
  ('Placed', 4, true),
  ('Rejected', 5, true)
on conflict (name) do nothing;
