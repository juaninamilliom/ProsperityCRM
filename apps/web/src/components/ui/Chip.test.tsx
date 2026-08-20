import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip';

describe('Chip', () => {
  it('renders its label', () => {
    render(<Chip>Python</Chip>);
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('applies the accent tone', () => {
    const { container } = render(<Chip tone="accent">Python</Chip>);
    expect(container.firstChild).toHaveClass('bg-accent-soft');
  });

  it('calls onRemove when the remove control is clicked', async () => {
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove}>Python</Chip>);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Python' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders no remove control without onRemove', () => {
    render(<Chip>Python</Chip>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
