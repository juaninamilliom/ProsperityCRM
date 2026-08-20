import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StageStepper } from './StageStepper';
import type { StatusDTO } from 'src/common';

const statuses = [
  { status_id: 's1', name: 'Sourced', order_index: 0, is_terminal: false },
  { status_id: 's2', name: 'Screening', order_index: 1, is_terminal: false },
  { status_id: 's3', name: 'Interviewing', order_index: 2, is_terminal: false },
] as StatusDTO[];

describe('StageStepper', () => {
  it('marks earlier stages complete and the current one active', () => {
    render(<StageStepper statuses={statuses} currentStatusId="s2" />);
    expect(screen.getByTestId('step-s1')).toHaveAttribute('data-state', 'done');
    expect(screen.getByTestId('step-s2')).toHaveAttribute('data-state', 'current');
    expect(screen.getByTestId('step-s3')).toHaveAttribute('data-state', 'todo');
  });

  it('orders by order_index, not array order', () => {
    const shuffled = [statuses[2], statuses[0], statuses[1]];
    render(<StageStepper statuses={shuffled} currentStatusId="s1" />);
    const names = screen.getAllByTestId(/^step-/).map((el) => el.textContent);
    expect(names).toEqual(['Sourced', 'Screening', 'Interviewing']);
  });

  it('treats an unknown current status as nothing completed', () => {
    render(<StageStepper statuses={statuses} currentStatusId="gone" />);
    expect(screen.getByTestId('step-s1')).toHaveAttribute('data-state', 'todo');
  });
});
