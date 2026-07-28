import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/onboarding-checklist', () => ({
  useChecklistItems: vi.fn(),
  useCreateChecklistItem: vi.fn(),
  useSetChecklistItemDone: vi.fn(),
}));

import { OnboardingChecklistCard } from './onboarding-checklist-card';
import { useChecklistItems, useCreateChecklistItem, useSetChecklistItemDone } from '@/hooks/onboarding-checklist';

const create = vi.fn();
const setDone = vi.fn();
function setup(items: Array<{ id: string; label: string; done: boolean }>) {
  vi.mocked(useChecklistItems).mockReturnValue({ data: items, isPending: false } as unknown as ReturnType<typeof useChecklistItems>);
  vi.mocked(useCreateChecklistItem).mockReturnValue({ mutate: create, isPending: false } as unknown as ReturnType<typeof useCreateChecklistItem>);
  vi.mocked(useSetChecklistItemDone).mockReturnValue({ mutate: setDone, isPending: false } as unknown as ReturnType<typeof useSetChecklistItemDone>);
}

describe('OnboardingChecklistCard', () => {
  beforeEach(() => { create.mockClear(); setDone.mockClear(); });

  it('shows progress and toggles an item', () => {
    setup([
      { id: 'i1', label: 'Sign contract', done: true },
      { id: 'i2', label: 'Set up laptop', done: false },
    ]);
    render(<OnboardingChecklistCard />);
    expect(screen.getByText('1/2 done')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark "Set up laptop" done' }));
    expect(setDone).toHaveBeenCalledWith({ id: 'i2', done: true });
  });

  it('adds a new checklist item', () => {
    setup([]);
    render(<OnboardingChecklistCard />);
    fireEvent.change(screen.getByLabelText('New checklist item'), { target: { value: 'Order badge' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(create).toHaveBeenCalledWith({ label: 'Order badge' }, expect.objectContaining({ onSuccess: expect.any(Function) }));
  });
});
