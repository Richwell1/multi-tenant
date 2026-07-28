import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/department-service', () => ({
  departmentService: { create: vi.fn() },
}));

import { parseImportLines, bulkImportService } from './bulk-import-service';
import { departmentService } from '@/services/department-service';

describe('parseImportLines', () => {
  it('trims, drops blanks, and de-duplicates case-insensitively', () => {
    expect(parseImportLines('Engineering\n  Sales \n\nengineering\nSupport')).toEqual([
      'Engineering',
      'Sales',
      'Support',
    ]);
  });
});

describe('bulkImportService.importDepartments', () => {
  beforeEach(() => vi.mocked(departmentService.create).mockReset());

  it('creates every row and reports the summary', async () => {
    vi.mocked(departmentService.create).mockResolvedValue({} as never);
    const r = await bulkImportService.importDepartments('alpha', ['A', 'B', 'C']);
    expect(r).toMatchObject({ total: 3, created: 3, failed: 0 });
    expect(departmentService.create).toHaveBeenCalledTimes(3);
  });

  it('isolates a failing row without aborting the batch', async () => {
    vi.mocked(departmentService.create)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error('That value is already taken.'))
      .mockResolvedValueOnce({} as never);
    const r = await bulkImportService.importDepartments('alpha', ['A', 'B', 'C']);
    expect(r).toMatchObject({ total: 3, created: 2, failed: 1 });
    expect(r.errors[0]).toContain('B');
  });
});
