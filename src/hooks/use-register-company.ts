import { useMutation } from '@tanstack/react-query';
import { registrationRepository, type RegisterCompanyInput } from '@/data/registration';
import type { NetworkError } from '@/data/api';
import { notify } from '@/lib/notify';

/**
 * Registration mutation. The page uses this hook, never the Edge Function
 * directly. Success/error toasts here; the page also renders an inline error.
 */
export function useRegisterCompany() {
  return useMutation({
    mutationFn: (input: RegisterCompanyInput) => registrationRepository.register(input),
    onSuccess: () => notify.recordCreated('Company'),
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}
