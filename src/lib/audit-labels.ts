// ---------------------------------------------------------------------------
// Human-readable labels for raw audit/event action codes. Users should never
// see internal codes like `marketplace.installed` or `diagnostic.created`.
// Unknown codes get a graceful prettified fallback rather than leaking as-is.
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  'company.registered': 'Company registered',
  'package.created': 'Package created',
  'package_version.created': 'Package version created',
  'release.published': 'Package release published',
  'release.planned': 'Package release planned',
  'installation.planned': 'Installation planned',
  'installation.installed': 'Package installed',
  'installation.failed': 'Installation failed',
  'installation.retried': 'Installation retried',
  'installation.rolled_back': 'Installation rolled back',
  'marketplace.installed': 'Marketplace extension installed',
  'marketplace.updated': 'Marketplace extension updated',
  'update.installed': 'Update installed',
  'request.created': 'Request created',
  'request.status_changed': 'Request status changed',
  'request.updated': 'Request updated',
  'diagnostic.created': 'Diagnostic report created',
  'diagnostic.evaluated': 'Diagnostic evaluated',
  'leave.requested': 'Leave requested',
  'leave.approved': 'Leave approved',
  'leave.rejected': 'Leave rejected',
  'leave.cancelled': 'Leave cancelled',
  'attendance.checked_in': 'Checked in',
  'attendance.checked_out': 'Checked out',
};

/** Map a raw action code to a human label (with a safe prettified fallback). */
export function actionLabel(action: string): string {
  if (!action) return '—';
  const known = ACTION_LABELS[action];
  if (known) return known;
  const words = action.replace(/[._]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : action;
}

/** Coarse category from the action prefix (for grouping/iconography). */
export function actionCategory(action: string): string {
  return (action.split('.')[0] ?? '').trim();
}
