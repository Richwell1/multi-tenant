import type { Position } from '@/data/types';

export type { Position };

export type PositionStatus = 'active' | 'disabled';

export interface CreatePositionInput {
  title: string;
  code: string;
  /** Department id within the SAME company (DB-enforced); omit for unassigned. */
  departmentId?: string;
  reportsTo?: string;
}

export interface UpdatePositionInput {
  title?: string;
  code?: string;
  departmentId?: string;
  reportsTo?: string;
  status?: PositionStatus;
}
