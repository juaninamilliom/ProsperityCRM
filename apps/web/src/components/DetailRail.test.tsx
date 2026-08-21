import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DetailRail } from './DetailRail';
import type { PipelineEntryWithMeta, StatusDTO } from 'src/common';

const statuses = [
  { status_id: 's1', name: 'Sourced', order_index: 0, is_terminal: false },
  { status_id: 's2', name: 'Screening', order_index: 1, is_terminal: false },
] as StatusDTO[];

const candidate = {
  entry_id: 'c1',
  full_name: 'Priya Raghunathan',
  email: 'priya.r@example.com',
  phone: '628-555-0193',
  current_status_id: 's2',
  company_id: 'a1',
  recruiter_id: 'u1',
  flags: ['Referral'],
  skills: ['Python'],
  company_name: 'Northgate Staffing',
  job_title: 'Senior Backend Engineer',
} as PipelineEntryWithMeta;

function renderRail(overrides: Partial<PipelineEntryWithMeta> = {}, onClose = vi.fn()) {
  render(
    <MemoryRouter>
      <DetailRail
        candidate={{ ...candidate, ...overrides } as PipelineEntryWithMeta}
        statuses={statuses}
        onClose={onClose}
      />
    </MemoryRouter>,
  );
  return onClose;
}

describe('DetailRail', () => {
  it('shows contact details, skills and flags', () => {
    renderRail();
    expect(screen.getByText('priya.r@example.com')).toBeInTheDocument();
    expect(screen.getByText('Northgate Staffing')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Referral')).toBeInTheDocument();
  });

  it('closes', async () => {
    const onClose = renderRail();
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('links to the edit page', () => {
    renderRail();
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      '/candidates/c1/edit',
    );
  });

  it('omits detail rows with no value', () => {
    renderRail({ phone: null, company_name: undefined });
    expect(screen.queryByText('Phone')).toBeNull();
    expect(screen.queryByText('Agency')).toBeNull();
  });
});
