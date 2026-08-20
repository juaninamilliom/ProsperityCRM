import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './Field';

describe('Field', () => {
  it('associates the label with the control', () => {
    render(<Field label="Full name" />);
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
  });

  it('renders a textarea when asked', () => {
    render(<Field label="Notes" as="textarea" />);
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
  });

  it('shows the hint text', () => {
    render(<Field label="Email" hint="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('passes typing through to onChange', async () => {
    const onChange = vi.fn();
    render(<Field label="Full name" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Full name'), 'Priya');
    expect(onChange).toHaveBeenCalled();
  });
});
