import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityComposer } from './ActivityComposer';

const person = { person_id: 'p1', full_name: 'Priya Raman', current_title: 'Director, Platform' };

function renderComposer(props: Record<string, unknown> = {}) {
  const onSubmit = vi.fn();
  render(<ActivityComposer person={person} onSubmit={onSubmit} onClose={vi.fn()} {...props} />);
  return onSubmit;
}

describe('ActivityComposer', () => {
  it('offers all seven channels', () => {
    renderComposer();
    for (const label of ['Message', 'InMail', 'Connect', 'Email', 'Call', 'Meeting', 'Note']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('defaults to a LinkedIn message going outbound', () => {
    renderComposer();
    expect(screen.getByRole('button', { name: 'Message' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Outbound' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('forces direction to internal when the channel is a note', () => {
    // A note is not outreach. Letting it count as an outbound touch would make
    // the follow-up view lie about contact that never happened.
    renderComposer();
    fireEvent.click(screen.getByRole('button', { name: 'Note' }));
    expect(screen.getByRole('button', { name: 'Internal' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Outbound' })).toBeDisabled();
  });

  it('says the extension can log the LinkedIn channels', () => {
    renderComposer();
    expect(screen.getByText(/extension can log this for you/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    expect(screen.queryByText(/extension can log this for you/i)).toBeNull();
  });

  it('submits the chosen channel, direction and body', () => {
    const onSubmit = renderComposer();
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inbound' }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'They called back.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log activity' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        person_id: 'p1',
        channel: 'call',
        direction: 'inbound',
        body: 'They called back.',
      }),
    );
  });

  it('will not submit an empty note', () => {
    const onSubmit = renderComposer();
    fireEvent.click(screen.getByRole('button', { name: 'Log activity' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
