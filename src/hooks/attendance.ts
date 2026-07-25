import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { attendanceService, type AttendanceFormValues } from '@/services/attendance-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { invalidationTargets } from '@/data/invalidation';
import { notify } from '@/lib/notify';
import type { NetworkError } from '@/data/api';
import type { AttendanceRecord } from '@/data/attendance';

function invalidate(qc: ReturnType<typeof useQueryClient>, keys: readonly QueryKey[]) {
  keys.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
}

export function useAttendanceRecords() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.attendance.records(companyId ?? 'none'),
    queryFn: () => attendanceService.list(companyId!),
    enabled: !!companyId,
  });
}

export function useCreateAttendance() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AttendanceFormValues) => attendanceService.create(companyId!, input),
    onSuccess: () => {
      notify.recordCreated('Attendance record');
      invalidate(qc, invalidationTargets.createAttendance(companyId!));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}

export function useCheckOutAttendance() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: AttendanceRecord) => attendanceService.checkOut(companyId!, record.id, record),
    onSuccess: () => {
      notify.recordUpdated('Attendance');
      invalidate(qc, invalidationTargets.checkOutAttendance(companyId!));
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}
