import type { Employee } from '@/data/types';

export type { Employee };

export type EmploymentType = 'full_time' | 'part_time' | 'contract';
export type EmployeeStatus = 'active' | 'on_leave' | 'terminated';

export interface CreateEmployeeInput {
  employeeNumber: string;
  fullName: string;
  workEmail: string;
  departmentId?: string;
  positionId?: string;
  employmentType: EmploymentType;
}

export interface UpdateEmployeeInput {
  fullName?: string;
  workEmail?: string;
  departmentId?: string;
  positionId?: string;
  employmentType?: EmploymentType;
  status?: EmployeeStatus;
}

export interface TerminateEmployeeInput {
  reason?: string;
}
