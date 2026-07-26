import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentNotesService, type DocumentNoteFormValues } from '@/services/document-notes-service';
import { useCompanyId } from './use-company-id';
import { queryKeys } from '@/lib/query-keys';
import { notify } from '@/lib/notify';
import type { NetworkError } from '@/data/api';

export function useDocumentNotes() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: queryKeys.documentNotes.list(companyId ?? 'none'),
    queryFn: () => documentNotesService.list(companyId!),
    enabled: !!companyId,
  });
}

export function useCreateDocumentNote() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DocumentNoteFormValues) => documentNotesService.create(companyId!, input),
    onSuccess: () => {
      notify.recordCreated('Note');
      qc.invalidateQueries({ queryKey: queryKeys.documentNotes.list(companyId!) });
    },
    onError: (e: NetworkError) => notify.networkFailure(e.message),
  });
}
