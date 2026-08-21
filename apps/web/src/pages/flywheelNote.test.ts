import { describe, expect, it } from 'vitest';
import { flywheelNote } from './flywheelNote';

const placed = {
  status_name: 'Placed',
  is_terminal: true,
  company_name: 'Halcyon Health',
  created_at: '2024-03-18T00:00:00Z',
};
const rejected = {
  status_name: 'Rejected',
  is_terminal: true,
  company_name: 'Cobalt Interactive',
  created_at: '2023-11-02T00:00:00Z',
};
const dealAt = (company: string) => ({ company_name: company });

describe('flywheelNote', () => {
  it('is null when the person has no history on either side', () => {
    expect(flywheelNote({ entries: [], deals: [] })).toBeNull();
  });

  it('is null for someone who is only ever a candidate', () => {
    expect(flywheelNote({ entries: [placed], deals: [] })).toBeNull();
  });

  it('is null for a BD contact who was never in the pipeline', () => {
    expect(flywheelNote({ entries: [], deals: [dealAt('Meridian Software')] })).toBeNull();
  });

  it('fires when someone placed is now a contact on a deal', () => {
    const note = flywheelNote({ entries: [placed], deals: [dealAt('Meridian Software')] });
    expect(note).not.toBeNull();
    expect(note!.placedAt).toBe('Halcyon Health');
    expect(note!.placedYear).toBe(2024);
    expect(note!.companies).toEqual(['Meridian Software']);
  });

  it('does not count a rejected entry as a placement', () => {
    expect(flywheelNote({ entries: [rejected], deals: [dealAt('Meridian Software')] })).toBeNull();
  });

  it('lists each BD company once even across several deals', () => {
    const note = flywheelNote({
      entries: [placed],
      deals: [dealAt('Meridian Software'), dealAt('Meridian Software'), dealAt('Cobalt Interactive')],
    });
    expect(note!.companies).toEqual(['Meridian Software', 'Cobalt Interactive']);
  });
});
