interface Entry {
  status_name?: string;
  company_name?: string;
  created_at?: string;
}

interface Deal {
  company_name?: string;
}

export interface FlywheelNote {
  placedAt: string;
  placedYear: number;
  companies: string[];
}

/** The one-people-table decision only pays off if the app says so out loud:
 *  someone placed years ago turning up as a contact on a live deal is the
 *  recruiting flywheel, and it is invisible in a two-table model. */
export function flywheelNote(person: { entries: Entry[]; deals: Deal[] }): FlywheelNote | null {
  const placement = person.entries.find(
    (entry) => (entry.status_name ?? '').toLowerCase() === 'placed',
  );
  if (!placement || person.deals.length === 0) return null;

  const companies: string[] = [];
  for (const deal of person.deals) {
    const name = deal.company_name;
    if (name && !companies.includes(name)) companies.push(name);
  }

  return {
    placedAt: placement.company_name ?? 'a client',
    placedYear: new Date(placement.created_at ?? Date.now()).getUTCFullYear(),
    companies,
  };
}
