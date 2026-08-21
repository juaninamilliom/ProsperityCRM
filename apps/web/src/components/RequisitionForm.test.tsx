import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RequisitionForm } from './RequisitionForm';

const companies = [
  { company_id: 'c1', name: 'Meridian Software' },
  { company_id: 'c2', name: 'Halcyon Health' },
];

function renderForm(props: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  render(<RequisitionForm companies={companies} onSubmit={onSubmit} onClose={vi.fn()} {...props} />);
  return onSubmit;
}

describe('RequisitionForm', () => {
  it('titles itself for a new requisition', () => {
    renderForm();
    expect(screen.getByRole('heading', { name: 'New requisition' })).toBeInTheDocument();
  });

  it('titles itself for an edit and pre-fills the requisition', () => {
    renderForm({
      job: {
        job_id: 'j1',
        title: 'Senior Platform Engineer',
        department: 'Engineering',
        location: 'Austin, TX',
        status: 'open',
        deal_amount: '42000',
      },
    });
    expect(screen.getByRole('heading', { name: 'Edit requisition' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Senior Platform Engineer');
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers the three requisition states', () => {
    renderForm();
    for (const label of ['Open', 'On hold', 'Closed']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('hides the company picker when the company is already known', () => {
    renderForm({ companyId: 'c1' });
    expect(screen.queryByLabelText('Company')).toBeNull();
  });

  it('will not submit without a title', () => {
    const onSubmit = renderForm({ companyId: 'c1' });
    fireEvent.click(screen.getByRole('button', { name: 'Create requisition' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the fee as a number and a blank one as null', () => {
    const onSubmit = renderForm({ companyId: 'c1' });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Staff Data Engineer' } });
    fireEvent.change(screen.getByLabelText('Fee'), { target: { value: '46000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create requisition' }));

    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({ company_id: 'c1', title: 'Staff Data Engineer', deal_amount: 46000 }),
    );
    expect(payload.close_date).toBeNull();
  });
});
