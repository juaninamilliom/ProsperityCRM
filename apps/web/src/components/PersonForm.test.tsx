import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PersonForm } from './PersonForm';

const companies = [{ company_id: 'c1', name: 'Meridian Software' }];

function renderForm(props: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  render(<PersonForm companies={companies} onSubmit={onSubmit} onClose={vi.fn()} {...props} />);
  return onSubmit;
}

describe('PersonForm', () => {
  it('titles itself for a new person', () => {
    renderForm();
    expect(screen.getByRole('heading', { name: 'Add person' })).toBeInTheDocument();
  });

  it('pre-fills an existing person', () => {
    renderForm({
      person: { person_id: 'p1', full_name: 'Priya Raman', current_title: 'Director, Platform', skills: ['Go'] },
    });
    expect(screen.getByRole('heading', { name: 'Edit person' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('Priya Raman');
    expect(screen.getByLabelText('Current title')).toHaveValue('Director, Platform');
  });

  it('will not submit without a name', () => {
    const onSubmit = renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends an empty email as null, which is the LinkedIn case', () => {
    // people.email is nullable with a partial unique index; '' would collide
    // on the second person saved without an address.
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Nadia Brooks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }));
    expect(onSubmit.mock.calls[0][0].email).toBeNull();
  });

  it('splits comma-separated skills into a list', () => {
    const onSubmit = renderForm();
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Marcus Oyelaran' } });
    fireEvent.change(screen.getByLabelText('Skills'), { target: { value: 'Python, dbt , Airflow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add person' }));
    expect(onSubmit.mock.calls[0][0].skills).toEqual(['Python', 'dbt', 'Airflow']);
  });
});
