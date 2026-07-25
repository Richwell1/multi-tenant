import type { CreatePositionInput, Position, UpdatePositionInput } from './types';

/** Company-scoped position data access. RLS + composite FK are the real boundary. */
export interface PositionRepository {
  list(companyId: string): Promise<Position[]>;
  getById(companyId: string, id: string): Promise<Position | undefined>;
  create(companyId: string, input: CreatePositionInput): Promise<Position>;
  update(companyId: string, id: string, input: UpdatePositionInput): Promise<Position>;
  disable(companyId: string, id: string): Promise<void>;
}
