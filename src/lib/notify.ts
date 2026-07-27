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
  recordDeleted: (what = 'Record') => toast.success(`${what} deleted`),
  requestStatusChanged: (status: string) => toast.success(`Request status changed to ${status}`),
  requestApproved: () => toast.success('Request approved'),
  requestRejected: () => toast.success('Request rejected'),
  requestCancelled: () => toast.success('Request cancelled'),
  packageAssigned: (name: string) => toast.success(`Package assigned: ${name}`),
  packagePublished: (name: string) => toast.success(`Package release published: ${name}`),
  packageInstalled: (name: string) => toast.success(`Package installed: ${name}`),
  updateStarted: (name: string) => toast(`Update started: ${name}`),
  updateInstalled: (name: string) => toast.success(`Update installed: ${name}`),
  updateFailed: (name: string) => toast.error(`Update failed: ${name}`),
  signedIn: () => toast.success('Signed in successfully'),
  loginFailure: (message = 'Sign-in failed. Please check your credentials.') => toast.error(message),
  logoutSuccess: () => toast.success('Signed out successfully'),
  permissionDenied: (message = 'You do not have permission to perform that action.') => toast.error(message),
  validationFailure: (message = 'Please fix the highlighted fields') => toast.error(message),
  networkFailure: (message = 'Network error. Please retry.') => toast.error(message),
  retryFailure: (what = 'Request') => toast.error(`${what} could not be retried. Please try again.`),
};
