import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('defaults to the secondary variant', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-surface');
  });

  it('applies the primary variant', () => {
    render(<Button variant="primary">Save</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-accent');
  });

  it('never uses a fully round radius', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button').className).not.toContain('rounded-full');
  });

  it('forwards arbitrary button props', () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
