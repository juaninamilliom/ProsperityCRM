import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompanyForm } from './CompanyForm';

function renderForm(props: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  render(<CompanyForm onSubmit={onSubmit} onClose={vi.fn()} {...props} />);
  return onSubmit;
}

describe('CompanyForm', () => {
  it('titles itself for a new company', () => {
    renderForm();
    expect(screen.getByRole('heading', { name: 'New company' })).toBeInTheDocument();
  });

  it('titles itself for an edit and pre-fills what exists', () => {
    renderForm({
      company: {
        company_id: 'c1',
        name: 'Meridian Software',
        domain: 'meridiansoftware.com',
        relationship: 'client',
        industry: null,
        location: null,
      },
    });
    expect(screen.getByRole('heading', { name: 'Edit company' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Meridian Software');
    expect(screen.getByLabelText('Domain')).toHaveValue('meridiansoftware.com');
    expect(screen.getByRole('button', { name: 'Client' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('defaults a new company to prospect', () => {
    renderForm();
    expect(screen.getByRole('button', { name: 'Prospect' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('will not submit without a name', () => {
    const onSubmit = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create company' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the fields that were filled in', () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Vantage Logistics' } });
    fireEvent.change(screen.getByLabelText('Domain'), { target: { value: 'vantage.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Client' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create company' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Vantage Logistics',
        domain: 'vantage.com',
        relationship: 'client',
      }),
    );
  });

  it('sends empty optional fields as null rather than empty strings', () => {
    // An empty string would defeat the partial unique index on domain, which
    // only ignores NULL - two blank domains would collide.
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Fern & Co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create company' }));

    const payload = onSubmit.mock.calls[0][0];
    expect(payload.domain).toBeNull();
    expect(payload.linkedin_url).toBeNull();
  });
});
