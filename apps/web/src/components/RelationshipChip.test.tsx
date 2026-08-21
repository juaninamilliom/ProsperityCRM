import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RelationshipChip } from './RelationshipChip';

describe('RelationshipChip', () => {
  it('labels each relationship in words a person would use', () => {
    const cases: [string, string][] = [
      ['prospect', 'Prospect'],
      ['client', 'Client'],
      ['former', 'Former'],
      ['do_not_contact', 'Do not contact'],
    ];
    for (const [value, label] of cases) {
      const { unmount } = render(<RelationshipChip relationship={value} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('falls back to prospect for an unknown value rather than throwing', () => {
    render(<RelationshipChip relationship="lead" />);
    expect(screen.getByText('Prospect')).toBeInTheDocument();
  });
});
