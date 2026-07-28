import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announcementsService, type AnnouncementFormValues } from '@/services/announcements-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { notify } from '@/lib/notify';

export function useAnnouncements() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.announcements.list(companyId ?? 'none'),
    queryFn: () => announcementsService.list(companyId!),
    enabled: !!companyId,
  });
}

export function useCreateAnnouncement() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnnouncementFormValues) => announcementsService.create(companyId!, input),
    onSuccess: () => {
      notify.recordCreated('Announcement');
      qc.invalidateQueries({ queryKey: queryKeys.announcements.list(companyId!) });
    },
    // Errors are shown inline beside the form; no duplicate toast here.
  });
}
