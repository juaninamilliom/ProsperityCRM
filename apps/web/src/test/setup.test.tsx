import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('renders React into jsdom and exposes jest-dom matchers', () => {
    render(<p>pipeline</p>);
    expect(screen.getByText('pipeline')).toBeInTheDocument();
  });
});
