import type { Department } from '@/data/types';

export type { Department };

export interface CreateDepartmentInput {
  name: string;
  /** Optional — provided by the Custom Department Code Field extension. */
  code?: string;
  head?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
  head?: string;
  status?: 'active' | 'disabled';
}
