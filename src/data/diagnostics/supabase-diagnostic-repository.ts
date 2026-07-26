import { getSupabaseClient } from '@/lib/supabase';
import { logSupabaseError, mapSupabaseError } from '@/data/errors';
import type { PackageKey } from '@/data/types';
import { DIAGNOSTIC_DIMENSIONS } from './types';
import type { DiagnosticRepository } from './diagnostic-repository';
import type {
  DiagnosticCheck,
  DiagnosticDimension,
  DiagnosticReport,
  DiagnosticResult,
  RunDiagnosticInput,
} from './types';

const REPORT_COLS = 'id,package_version_id,summary,recommendation,result';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalData<T>(
  result: PromiseSettledResult<{ data: T | null; error: unknown | null }>,
  operation: string,
): T | null {
  if (result.status === 'rejected') {
    logSupabaseError(operation, result.reason);
    return null;
  }
  if (result.value.error) {
    logSupabaseError(operation, result.value.error);
    return null;
  }
  return result.value.data;
}

interface Row {
  id: string;
  package_version_id: string;
  summary: string;
  recommendation: string;
  result: DiagnosticResult;
}

interface VersionRow {
  id: string;
  package_key: string;
}

interface CheckRow {
  report_id: string;
  dimension: DiagnosticDimension;
  status: DiagnosticResult;
  required: boolean;
  detail: string;
}

const orderChecks = (checks: DiagnosticCheck[]): DiagnosticCheck[] =>
  [...checks].sort(
    (a, b) => DIAGNOSTIC_DIMENSIONS.indexOf(a.dimension) - DIAGNOSTIC_DIMENSIONS.indexOf(b.dimension),
  );

const toDomain = (r: Row, packageKey: string | undefined, checks: DiagnosticCheck[]): DiagnosticReport => ({
  id: r.id,
  packageKey: (packageKey as PackageKey | undefined) ?? 'hr-core',
  packageVersionId: r.package_version_id,
  targetCompanyId: null,
  affectedFrontend: [],
  affectedBackend: [],
  affectedTables: [],
  requiredPermissions: [],
  dependencies: [],
  estimatedDataImpact: 'none',
  compatibility: '',
  result: r.result,
  recommendation: r.recommendation,
  checks: orderChecks(checks),
});

const toCheck = (row: CheckRow): DiagnosticCheck => ({
  dimension: row.dimension,
  status: row.status,
  required: row.required,
  detail: row.detail,
});

export class SupabaseDiagnosticRepository implements DiagnosticRepository {
  async list(): Promise<DiagnosticReport[]> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('diagnostic_reports')
      .select(REPORT_COLS)
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error, 'admin.diagnostics.list');
    const reports = (data ?? []) as unknown as Row[];
    if (!reports.length) return [];

    const [versionResult, checkResult] = await Promise.allSettled([
      client.from('package_versions').select('id,package_key').in('id', reports.map((r) => r.package_version_id)),
      client.from('diagnostic_checks').select('report_id,dimension,status,required,detail').in('report_id', reports.map((r) => r.id)),
    ]);
    const versions = optionalData<VersionRow[]>(versionResult, 'admin.diagnostics.versions');
    const checks = optionalData<CheckRow[]>(checkResult, 'admin.diagnostics.checks');

    const packageKeys = new Map((versions ?? []).map((v) => [v.id, v.package_key]));
    const checksByReport = new Map<string, DiagnosticCheck[]>();
    for (const row of checks ?? []) {
      const current = checksByReport.get(row.report_id) ?? [];
      current.push(toCheck(row));
      checksByReport.set(row.report_id, current);
    }
    return reports.map((report) => toDomain(report, packageKeys.get(report.package_version_id), checksByReport.get(report.id) ?? []));
  }

  async getById(id: string): Promise<DiagnosticReport | undefined> {
    if (!UUID_PATTERN.test(id)) return undefined;
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('diagnostic_reports')
      .select(REPORT_COLS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw mapSupabaseError(error, 'admin.diagnostics.detail');
    if (!data) return undefined;
    const report = data as unknown as Row;
    const [versionResult, checkResult] = await Promise.allSettled([
      client.from('package_versions').select('id,package_key').eq('id', report.package_version_id).maybeSingle(),
      client.from('diagnostic_checks').select('report_id,dimension,status,required,detail').eq('report_id', report.id),
    ]);
    const version = optionalData<VersionRow | null>(versionResult, 'admin.diagnostics.detail.version');
    const checks = optionalData<CheckRow[]>(checkResult, 'admin.diagnostics.detail.checks');
    return toDomain(
      report,
      version?.package_key,
      (checks ?? []).map(toCheck),
    );
  }

  async run(input: RunDiagnosticInput): Promise<DiagnosticReport> {
    const client = getSupabaseClient();
    const { data: report, error: reportError } = await client
      .from('diagnostic_reports')
      .insert({
        package_version_id: input.packageVersionId,
        summary: input.summary ?? '',
        recommendation: input.recommendation ?? 'Safe to release.',
      })
      .select('id')
      .single();
    if (reportError) throw mapSupabaseError(reportError, 'admin.diagnostics.create');

    const reportId = (report as { id: string }).id;
    const { error: checksError } = await client.from('diagnostic_checks').insert(
      DIAGNOSTIC_DIMENSIONS.map((dimension) => ({
        report_id: reportId,
        dimension,
        status: 'PASS',
        detail: 'No issues detected.',
      })),
    );
    if (checksError) throw mapSupabaseError(checksError, 'admin.diagnostics.create_checks');

    const created = await this.getById(reportId);
    if (!created) throw mapSupabaseError({ message: 'Diagnostic not found after creation' }, 'admin.diagnostics.verify_create');
    return created;
  }
}
