import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CandidateFormLayout } from './CandidateFormLayout';

function renderLayout(overrides: Record<string, unknown> = {}) {
  const props = {
    title: 'New candidate',
    subtitle: 'Only a name and email are required.',
    checklist: [
      { label: 'Name and email', done: true },
      { label: 'At least one skill', done: false },
    ],
    saveHint: 'Saving adds this candidate to Screening.',
    onCancel: vi.fn(),
    submitting: false,
    preview: <p>preview</p>,
    children: <p>fields</p>,
    ...overrides,
  };
  render(<CandidateFormLayout {...props} />);
  return props;
}

describe('CandidateFormLayout', () => {
  it('renders the title, fields and preview', () => {
    renderLayout();
    expect(screen.getByRole('heading', { name: 'New candidate' })).toBeInTheDocument();
    expect(screen.getByText('fields')).toBeInTheDocument();
    expect(screen.getByText('preview')).toBeInTheDocument();
  });

  it('reports checklist progress', () => {
    renderLayout();
    expect(screen.getByTestId('checklist-progress')).toHaveTextContent('1 of 2');
  });

  it('disables the submit button while submitting', () => {
    renderLayout({ submitting: true });
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });

  it('cancels', async () => {
    const props = renderLayout();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('handles an empty checklist without dividing by zero', () => {
    renderLayout({ checklist: [] });
    expect(screen.getByTestId('checklist-progress')).toHaveTextContent('0 of 0');
  });
});
