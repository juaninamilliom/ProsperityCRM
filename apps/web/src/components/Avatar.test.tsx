import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('shows two initials', () => {
    render(<Avatar name="Juan Guardado" />);
    expect(screen.getByText('JG')).toBeInTheDocument();
  });

  it('handles a single-word name', () => {
    render(<Avatar name="Prosperity" />);
    expect(screen.getByText('P')).toBeInTheDocument();
  });

  it('falls back when the name is missing', () => {
    render(<Avatar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('ignores extra whitespace rather than emitting a blank initial', () => {
    render(<Avatar name="  Juan   Guardado  " />);
    expect(screen.getByText('JG')).toBeInTheDocument();
  });

  it('uses the accent tint, not brand fuchsia', () => {
    const { container } = render(<Avatar name="Juan Guardado" />);
    expect((container.firstChild as HTMLElement).className).not.toContain('brand-fuchsia');
  });
});
