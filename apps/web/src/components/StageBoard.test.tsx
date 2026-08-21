import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StageBoard } from './StageBoard';

const columns = [
  { key: 'prospect', label: 'Prospect', token: 'var(--bd-prospect)' },
  { key: 'signed', label: 'Signed', token: 'var(--bd-signed)' },
];

const items = [
  { id: 'd1', stage: 'prospect', name: 'Northwind Robotics' },
  { id: 'd2', stage: 'prospect', name: 'Vantage Logistics' },
];

function renderBoard(props: Record<string, unknown> = {}) {
  render(
    <StageBoard
      columns={columns}
      items={items}
      itemKey={(d) => d.id}
      itemStage={(d) => d.stage}
      onMove={vi.fn()}
      renderCard={(d) => <span>{d.name}</span>}
      {...props}
    />,
  );
}

describe('StageBoard', () => {
  it('renders one column per stage with a count', () => {
    renderBoard();
    expect(screen.getByTestId('column-count-prospect')).toHaveTextContent('2');
    expect(screen.getByTestId('column-count-signed')).toHaveTextContent('0');
  });

  it('renders each item through renderCard', () => {
    renderBoard();
    expect(screen.getByText('Northwind Robotics')).toBeInTheDocument();
    expect(screen.getByText('Vantage Logistics')).toBeInTheDocument();
  });

  it('renders an empty column rather than hiding it', () => {
    renderBoard();
    expect(screen.getByText('Signed')).toBeInTheDocument();
  });

  it('shows a per-column subtitle when one is supplied', () => {
    renderBoard({ columnSubtitle: (key: string) => (key === 'prospect' ? '$64k' : 'no deals') });
    expect(screen.getByText('$64k')).toBeInTheDocument();
    expect(screen.getByText('no deals')).toBeInTheDocument();
  });
});
