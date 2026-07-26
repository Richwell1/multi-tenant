import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import {
  EmptyState,
  NoResultsState,
  ErrorState,
  PackageUnavailableState,
  InstallationFailure,
  ConfirmDialog,
} from './index';

describe('UI-state components', () => {
  it('EmptyState renders title and description', () => {
    render(<EmptyState title="No employees yet" description="Add one to start." />);
    expect(screen.getByText('No employees yet')).toBeInTheDocument();
    expect(screen.getByText('Add one to start.')).toBeInTheDocument();
  });

  it('NoResultsState echoes the query', () => {
    render(<NoResultsState query="acme" />);
    expect(screen.getByText(/acme/)).toBeInTheDocument();
  });

  it('ErrorState retry button invokes onRetry', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('PackageUnavailableState names the package (gating message)', () => {
    render(<PackageUnavailableState packageName="Leave Management" />);
    expect(screen.getByText('Package not enabled')).toBeInTheDocument();
    expect(screen.getByText(/Leave Management is not enabled for this company/i)).toBeInTheDocument();
  });

  it('InstallationFailure exposes a retry action', () => {
    const onRetry = vi.fn();
    render(<InstallationFailure packageName="Attendance" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /retry installation/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('ConfirmDialog traps focus and returns focus to the trigger', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          <ConfirmDialog
            open={open}
            title="Confirm action"
            description="This action cannot be undone."
            onCancel={() => setOpen(false)}
            onConfirm={vi.fn()}
          />
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    const descriptionId = dialog.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId ?? '')).toHaveTextContent('This action cannot be undone.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(trigger).toHaveFocus();
  });

  it('keeps a critical mutation open and prevents duplicate dismissal', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { unmount } = render(
      <ConfirmDialog
        open
        title="Install update"
        description={<div>{Array.from({ length: 20 }, (_, i) => <p key={i}>Long impact detail {i}</p>)}</div>}
        pending
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.firstElementChild).toHaveClass('max-h-[90vh]');
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(dialog);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
