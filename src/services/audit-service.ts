import { auditRepository, type AuditFilters } from '@/data/audit';

export const auditService = {
  list: (filters?: AuditFilters) => auditRepository.list(filters),
};
