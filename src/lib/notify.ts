import { toast } from 'sonner';

/**
 * Centralized toast messages for the domain events the spec enumerates.
 * Critical failures (network/install) ALSO get an inline ErrorState/FailedState
 * at the call site — toasts never stand alone for those.
 */
export const notify = {
  recordCreated: (what = 'Record') => toast.success(`${what} created`),
  recordUpdated: (what = 'Record') => toast.success(`${what} updated`),
  recordDisabled: (what = 'Record') => toast.success(`${what} disabled`),
  requestStatusChanged: (status: string) => toast.success(`Request status changed to ${status}`),
  packageAssigned: (name: string) => toast.success(`Package assigned: ${name}`),
  updateStarted: (name: string) => toast(`Update started: ${name}`),
  updateInstalled: (name: string) => toast.success(`Update installed: ${name}`),
  updateFailed: (name: string) => toast.error(`Update failed: ${name}`),
  validationFailure: (message = 'Please fix the highlighted fields') => toast.error(message),
  networkFailure: (message = 'Network error. Please retry.') => toast.error(message),
};
