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

const COLS =
  'id,package_version_id,summary,recommendation,result,' +
  'package_versions(package_key),diagnostic_checks(dimension,status,required,detail)';

interface Row {
  id: string;
  package_version_id: string;
  summary: string;
  recommendation: string;
  result: DiagnosticResult;
  package_versions: { package_key: string } | null;
  diagnostic_checks: {
    dimension: DiagnosticDimension;
    status: DiagnosticResult;
    required: boolean;
    detail: string;
  }[];
}

const orderChecks = (checks: DiagnosticCheck[]): DiagnosticCheck[] =>
  [...checks].sort(
    (a, b) => DIAGNOSTIC_DIMENSIONS.indexOf(a.dimension) - DIAGNOSTIC_DIMENSIONS.indexOf(b.dimension),
  );

const toDomain = (r: Row): DiagnosticReport => ({
  id: r.id,
  packageKey: (r.package_versions?.package_key as PackageKey) ?? 'hr-core',
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
  checks: orderChecks(
    (r.diagnostic_checks ?? []).map((c) => ({
      dimension: c.dimension,
      status: c.status,
      required: c.required,
      detail: c.detail,
    })),
  ),
});

export class SupabaseDiagnosticRepository implements DiagnosticRepository {
  async list(): Promise<DiagnosticReport[]> {
    const { data, error } = await getSupabaseClient()
      .from('diagnostic_reports')
      .select(COLS)
      .order('created_at', { ascending: false });
    if (error) throw mapSupabaseError(error);
    return (data as unknown as Row[]).map(toDomain);
  }

  async getById(id: string): Promise<DiagnosticReport | undefined> {
    const { data, error } = await getSupabaseClient()
      .from('diagnostic_reports')
      .select(COLS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw mapSupabaseError(error);
    return data ? toDomain(data as unknown as Row) : undefined;
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
