import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bulkImportService, type BulkImportResult } from '@/services/bulk-import-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { notify } from '@/lib/notify';

/**
 * Bulk-import departments. Runs through the department service (per-row RLS +
 * validation), then invalidates the departments list once and surfaces a single
 * summary toast — never one per row.
 */
export function useBulkImportDepartments() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (names: string[]) => bulkImportService.importDepartments(companyId!, names),
    onSuccess: (result: BulkImportResult) => {
      qc.invalidateQueries({ queryKey: queryKeys.departments.all(companyId!) });
      if (result.created > 0) notify.recordCreated(`${result.created} department${result.created === 1 ? '' : 's'}`);
      if (result.failed > 0) notify.validationFailure(`${result.failed} row${result.failed === 1 ? '' : 's'} could not be imported.`);
    },
  });
}
