import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CandidateCard } from './CandidateCard';
import type { CandidateWithMeta } from 'src/common';

const candidate = {
  candidate_id: 'c1',
  name: 'Priya Raghunathan',
  email: 'priya.r@example.com',
  current_status_id: 's1',
  target_agency_id: 'a1',
  recruiter_id: 'u1',
  flags: ['Referral'],
  skills: ['Python', 'Django', 'Redis'],
  agency_name: 'Northgate Staffing',
  job_title: 'Senior Backend Engineer',
} as CandidateWithMeta;

function renderCard(props: Record<string, unknown> = {}) {
  render(
    <MemoryRouter>
      <CandidateCard candidate={candidate} {...props} />
    </MemoryRouter>,
  );
}

describe('CandidateCard', () => {
  it('shows the name and job title', () => {
    renderCard();
    expect(screen.getByText('Priya Raghunathan')).toBeInTheDocument();
    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
  });

  it('shows at most two skills plus an overflow count', () => {
    renderCard();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('Django')).toBeInTheDocument();
    expect(screen.queryByText('Redis')).toBeNull();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('renders skills as plain strings, not objects', () => {
    renderCard();
    expect(screen.queryByText('[object Object]')).toBeNull();
  });

  it('marks the selected card', () => {
    render(
      <MemoryRouter>
        <CandidateCard candidate={candidate} selected />
      </MemoryRouter>,
    );
    expect(document.querySelector('[data-selected="true"]')).not.toBeNull();
  });

  it('survives a candidate with no skills', () => {
    const bare = { ...candidate, skills: [] } as CandidateWithMeta;
    render(
      <MemoryRouter>
        <CandidateCard candidate={bare} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Priya Raghunathan')).toBeInTheDocument();
  });
});
