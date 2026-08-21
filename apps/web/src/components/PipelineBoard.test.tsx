import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PipelineBoard } from './PipelineBoard';
import type { PipelineEntryWithMeta, StatusDTO } from 'src/common';

const statuses = [
  { status_id: 's1', name: 'Sourced', order_index: 0, is_terminal: false },
  { status_id: 's2', name: 'Placed', order_index: 4, is_terminal: true },
] as StatusDTO[];

const candidates = [
  {
    entry_id: 'c1',
    person_id: 'p1',
    full_name: 'Maya Okonkwo',
    email: 'm@example.com',
    current_status_id: 's1',
    company_id: 'a1',
    recruiter_id: 'u1',
    flags: [],
    skills: ['Go'],
  },
] as PipelineEntryWithMeta[];

function renderBoard(props: Record<string, unknown> = {}) {
  render(
    <MemoryRouter>
      <PipelineBoard statuses={statuses} candidates={candidates} onMove={vi.fn()} {...props} />
    </MemoryRouter>,
  );
}

describe('PipelineBoard', () => {
  it('renders one column per status with a count', () => {
    renderBoard();
    expect(screen.getByText('Sourced')).toBeInTheDocument();
    expect(screen.getByText('Placed')).toBeInTheDocument();
    expect(screen.getByTestId('column-count-s1')).toHaveTextContent('1');
    expect(screen.getByTestId('column-count-s2')).toHaveTextContent('0');
  });

  it('places each candidate in its status column', () => {
    renderBoard();
    expect(screen.getByTestId('column-s1')).toHaveTextContent('Maya Okonkwo');
    expect(screen.getByTestId('column-s2')).not.toHaveTextContent('Maya Okonkwo');
  });
});
