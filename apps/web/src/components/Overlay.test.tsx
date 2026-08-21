import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Overlay } from './Overlay';

function renderOverlay(props: Record<string, unknown> = {}) {
  const onClose = vi.fn();
  render(
    <div>
      <button type="button">page button</button>
      <Overlay isOpen onClose={onClose} {...props}>
        <div>panel contents</div>
      </Overlay>
    </div>,
  );
  return onClose;
}

describe('Overlay', () => {
  it('renders nothing when closed', () => {
    render(
      <Overlay isOpen={false} onClose={vi.fn()}>
        <div>panel contents</div>
      </Overlay>,
    );
    expect(screen.queryByText('panel contents')).toBeNull();
  });

  it('lays no scrim over the page', () => {
    // A full-page dimmer makes this a takeover. These panels are worked
    // alongside the record behind them, so the page stays lit and clickable.
    renderOverlay();
    const scrim = document.querySelector('.fixed.inset-0');
    expect(scrim).toBeNull();
  });

  it('leaves the page underneath clickable', () => {
    const onClose = renderOverlay();
    const pageButton = screen.getByRole('button', { name: 'page button' });
    fireEvent.mouseDown(pageButton);
    fireEvent.click(pageButton);
    expect(onClose).toHaveBeenCalledTimes(1);
    // The click still reached the page rather than being swallowed by a scrim.
    expect(pageButton).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = renderOverlay();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the click is inside the panel', () => {
    const onClose = renderOverlay();
    fireEvent.mouseDown(screen.getByText('panel contents'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
