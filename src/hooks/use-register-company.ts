import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { registrationRepository, type RegisterCompanyInput } from '@/data/registration';
import { RepositoryError } from '@/data/errors';
import { isValidSlug } from '@/lib/slug';
import { notify } from '@/lib/notify';

/**
 * Registration mutation. The page uses this hook, never the Edge Function
 * directly. Toasts on success and on unexpected failures; field-level conflicts
 * (slug/subdomain/email) are surfaced inline by the page, so we don't also toast
 * those — a duplicate slug isn't a "network error".
 */
export function useRegisterCompany() {
  return useMutation({
    mutationFn: (input: RegisterCompanyInput) => registrationRepository.register(input),
    onSuccess: () => notify.recordCreated('Company'),
    onError: (e: unknown) => {
      const isFieldConflict = e instanceof RepositoryError && e.kind === 'conflict' && !!e.field;
      if (!isFieldConflict) {
        notify.networkFailure(e instanceof Error ? e.message : 'Registration failed. Please try again.');
      }
    },
  });
}

/** Debounce a changing value so we only query availability once typing settles. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Live slug availability. Debounced + only runs for well-formed slugs, through
 * the registration repository (never a direct backend call). `verified: false`
 * from the hosted adapter means "confirmed on submit", which the UI respects.
 */
export function useSlugAvailability(slug: string) {
  const debounced = useDebouncedValue(slug.trim(), 400);
  const enabled = isValidSlug(debounced);
  return useQuery({
    queryKey: ['slug-availability', debounced],
    queryFn: () => registrationRepository.checkSlugAvailability(debounced),
    enabled,
    staleTime: 30_000,
  });
}
