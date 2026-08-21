import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DealForm } from './DealForm';

const companies = [
  { company_id: 'c1', name: 'Meridian Software' },
  { company_id: 'c2', name: 'Northwind Robotics' },
];

function renderForm(props: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  render(<DealForm companies={companies} onSubmit={onSubmit} onClose={vi.fn()} {...props} />);
  return onSubmit;
}

describe('DealForm', () => {
  it('offers every stage a new deal may start in', () => {
    renderForm();
    for (const label of ['Prospect', 'Contacted', 'Meeting', 'Proposal', 'Negotiation']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('does not offer signed or lost as a starting stage', () => {
    // Reaching signed promotes the company and logs the win; that has to go
    // through the stage route, not be set at creation.
    renderForm();
    expect(screen.queryByRole('button', { name: 'Signed' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lost' })).toBeNull();
  });

  it('hides the company picker when the company is already known', () => {
    renderForm({ companyId: 'c1' });
    expect(screen.queryByLabelText('Company')).toBeNull();
  });

  it('will not submit without a name or a company', () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('Deal name'), { target: { value: 'Engineering retainer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create deal' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits numbers as numbers, not strings', () => {
    // The API schema types fee_percent and est_annual_value as numbers; a
    // string would fail validation with a 400 the user cannot read.
    const onSubmit = renderForm({ companyId: 'c1' });
    fireEvent.change(screen.getByLabelText('Deal name'), { target: { value: 'Engineering retainer' } });
    fireEvent.change(screen.getByLabelText('Fee %'), { target: { value: '22' } });
    fireEvent.change(screen.getByLabelText('Est. annual value'), { target: { value: '96000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create deal' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: 'c1',
        name: 'Engineering retainer',
        fee_percent: 22,
        est_annual_value: 96000,
        stage: 'prospect',
      }),
    );
  });

  it('titles itself for an edit and pre-fills the deal', () => {
    renderForm({
      companyId: 'c1',
      deal: {
        opportunity_id: 'o1',
        company_id: 'c1',
        name: 'Engineering retainer',
        stage: 'meeting',
        fee_percent: '22',
        est_annual_value: '96000',
        expected_close: '2026-09-12',
      },
    });
    expect(screen.getByRole('heading', { name: 'Edit deal' })).toBeInTheDocument();
    expect(screen.getByLabelText('Deal name')).toHaveValue('Engineering retainer');
    expect(screen.getByLabelText('Fee %')).toHaveValue('22');
    expect(screen.getByRole('button', { name: 'Meeting' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers signed and lost only when editing', () => {
    // Creating a deal already signed would skip the promotion; changing an
    // existing deal to signed goes through the stage route, which does it.
    renderForm({ companyId: 'c1', deal: { opportunity_id: 'o1', name: 'X', stage: 'meeting' } });
    expect(screen.getByRole('button', { name: 'Signed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lost' })).toBeInTheDocument();
  });

  it('reports a stage change separately, so the caller can route it', () => {
    const onSubmit = renderForm({
      companyId: 'c1',
      deal: { opportunity_id: 'o1', name: 'X', stage: 'meeting' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Proposal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const payload = onSubmit.mock.calls[0][0];
    expect(payload.stage).toBe('proposal');
    expect(payload.stageChanged).toBe(true);
  });

  it('does not flag a stage change when the stage was left alone', () => {
    const onSubmit = renderForm({
      companyId: 'c1',
      deal: { opportunity_id: 'o1', name: 'X', stage: 'meeting' },
    });
    fireEvent.change(screen.getByLabelText('Deal name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSubmit.mock.calls[0][0].stageChanged).toBe(false);
  });

  it('sends a blank number as null rather than zero', () => {
    const onSubmit = renderForm({ companyId: 'c1' });
    fireEvent.change(screen.getByLabelText('Deal name'), { target: { value: 'Scoping' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create deal' }));
    expect(onSubmit.mock.calls[0][0].fee_percent).toBeNull();
  });
});
