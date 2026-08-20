import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, SectionLabel } from './Card';

describe('Card', () => {
  it('renders a bordered surface', () => {
    const { container } = render(<Card>body</Card>);
    expect(container.firstChild).toHaveClass('border-border');
    expect(container.firstChild).toHaveClass('rounded-card');
  });

  it('merges an extra className', () => {
    const { container } = render(<Card className="p-8">body</Card>);
    expect(container.firstChild).toHaveClass('p-8');
  });
});

describe('SectionLabel', () => {
  it('renders uppercase label text', () => {
    render(<SectionLabel>Skills</SectionLabel>);
    expect(screen.getByText('Skills')).toHaveClass('uppercase');
  });
});
