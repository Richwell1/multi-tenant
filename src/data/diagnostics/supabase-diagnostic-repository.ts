import { getSupabaseClient } from '@/lib/supabase';
import { mapSupabaseError } from '@/data/errors';
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
    if (error) throw mapSupabaseError(error);
    const reports = (data ?? []) as unknown as Row[];
    if (!reports.length) return [];

    const [{ data: versions, error: versionError }, { data: checks, error: checkError }] = await Promise.all([
      client.from('package_versions').select('id,package_key').in('id', reports.map((r) => r.package_version_id)),
      client.from('diagnostic_checks').select('report_id,dimension,status,required,detail').in('report_id', reports.map((r) => r.id)),
    ]);
    if (versionError) throw mapSupabaseError(versionError);
    if (checkError) throw mapSupabaseError(checkError);

    const packageKeys = new Map(((versions ?? []) as unknown as VersionRow[]).map((v) => [v.id, v.package_key]));
    const checksByReport = new Map<string, DiagnosticCheck[]>();
    for (const row of (checks ?? []) as unknown as CheckRow[]) {
      const current = checksByReport.get(row.report_id) ?? [];
      current.push(toCheck(row));
      checksByReport.set(row.report_id, current);
    }
    return reports.map((report) => toDomain(report, packageKeys.get(report.package_version_id), checksByReport.get(report.id) ?? []));
  }

  async getById(id: string): Promise<DiagnosticReport | undefined> {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('diagnostic_reports')
      .select(REPORT_COLS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    if (!data) return undefined;
    const report = data as unknown as Row;
    const [{ data: version, error: versionError }, { data: checks, error: checkError }] = await Promise.all([
      client.from('package_versions').select('id,package_key').eq('id', report.package_version_id).maybeSingle(),
      client.from('diagnostic_checks').select('report_id,dimension,status,required,detail').eq('report_id', report.id),
    ]);
    if (versionError) throw mapSupabaseError(versionError);
    if (checkError) throw mapSupabaseError(checkError);
    return toDomain(
      report,
      (version as unknown as VersionRow | null)?.package_key,
      ((checks ?? []) as unknown as CheckRow[]).map(toCheck),
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
    if (reportError) throw mapSupabaseError(reportError);

    const reportId = (report as { id: string }).id;
    const { error: checksError } = await client.from('diagnostic_checks').insert(
      DIAGNOSTIC_DIMENSIONS.map((dimension) => ({
        report_id: reportId,
        dimension,
        status: 'PASS',
        detail: 'No issues detected.',
      })),
    );
    if (checksError) throw mapSupabaseError(checksError);

    const created = await this.getById(reportId);
    if (!created) throw mapSupabaseError({ message: 'Diagnostic not found after creation' });
    return created;
  }
}
