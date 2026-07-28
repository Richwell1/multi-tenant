import { departmentService } from '@/services/department-service';

export interface BulkImportResult {
  total: number;
  created: number;
  failed: number;
  errors: string[];
}

/** Parse pasted text into trimmed, de-duplicated, non-empty lines. */
export function parseImportLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export const bulkImportService = {
  /**
   * Bulk-create departments through the normal department service (validation +
   * RLS apply per row). Failures are isolated per row and reported in a summary;
   * one bad row never aborts the batch.
   */
  importDepartments: async (companyId: string, names: string[]): Promise<BulkImportResult> => {
    const result: BulkImportResult = { total: names.length, created: 0, failed: 0, errors: [] };
    for (const name of names) {
      try {
        await departmentService.create(companyId, { name });
        result.created += 1;
      } catch (e) {
        result.failed += 1;
        if (result.errors.length < 5) {
          result.errors.push(`${name}: ${e instanceof Error ? e.message : 'failed'}`);
        }
      }
    }
    return result;
  },
};
