import type { RequestStatus } from './types';

// Delivery-pipeline state machine, mirrored by the DB function
// `public.request_status_can_transition`. 'rejected' and 'closed' are terminal;
// 'closed' is reachable from any active state so a request can always be retired.
export const REQUEST_TRANSITIONS: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
  received: ['under_review', 'rejected', 'closed'],
  under_review: ['approved', 'rejected', 'closed'],
  approved: ['in_development', 'rejected', 'closed'],
  in_development: ['testing', 'closed'],
  testing: ['ready_for_release', 'in_development', 'closed'],
  ready_for_release: ['released', 'closed'],
  released: ['installed', 'closed'],
  installed: ['closed'],
  rejected: [],
  closed: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return from === to || REQUEST_TRANSITIONS[from].includes(to);
}

/** The statuses an admin may move a request to next (excludes the current one). */
export function allowedNextStatuses(from: RequestStatus): readonly RequestStatus[] {
  return REQUEST_TRANSITIONS[from];
}
