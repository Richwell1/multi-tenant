// ---------------------------------------------------------------------------
// Diagnostics application service. The release-gate rule lives in
// `@/data/diagnostics` (deriveResult / isReleaseBlocked) and is mirrored by the
// database; the publish service consults it for fail-fast UX.
// ---------------------------------------------------------------------------

import { RepositoryError } from '@/data/errors';
import { diagnosticRepository, type RunDiagnosticInput } from '@/data/diagnostics';

export const diagnosticService = {
  list: () => diagnosticRepository.list(),

  getById: (id: string) => diagnosticRepository.getById(id),

  run: async (input: RunDiagnosticInput) => {
    if (!input.packageVersionId) {
      throw new RepositoryError('Select a package version to diagnose.', 'validation');
    }
    return diagnosticRepository.run(input);
  },
};
