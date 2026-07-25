import { departments, positions } from '@/data/mock';
import type { PositionRepository } from './position-repository';
import type { CreatePositionInput, Position, UpdatePositionInput } from './types';

const delay = () => new Promise((r) => setTimeout(r, 300));
const clone = <T>(v: T): T => structuredClone(v);

function departmentName(companyId: string, departmentId?: string): string {
  if (!departmentId) return '';
  return departments.find((d) => d.tenantId === companyId && d.id === departmentId)?.name ?? '';
}

/** Mock adapter — reads the static seed; mutations are simulated (no persistence). */
export class MockPositionRepository implements PositionRepository {
  async list(companyId: string): Promise<Position[]> {
    await delay();
    return clone(positions.filter((p) => p.tenantId === companyId));
  }

  async getById(companyId: string, id: string): Promise<Position | undefined> {
    await delay();
    return clone(positions.find((p) => p.tenantId === companyId && p.id === id));
  }

  async create(companyId: string, input: CreatePositionInput): Promise<Position> {
    await delay();
    return {
      id: `p-${Date.now()}`,
      tenantId: companyId,
      title: input.title,
      code: input.code,
      department: departmentName(companyId, input.departmentId),
      reportsTo: input.reportsTo ?? '',
      status: 'active',
    };
  }

  async update(companyId: string, id: string, input: UpdatePositionInput): Promise<Position> {
    await delay();
    const existing = positions.find((p) => p.tenantId === companyId && p.id === id);
    return {
      id,
      tenantId: companyId,
      title: input.title ?? existing?.title ?? '',
      code: input.code ?? existing?.code ?? '',
      department: input.departmentId ? departmentName(companyId, input.departmentId) : (existing?.department ?? ''),
      reportsTo: input.reportsTo ?? existing?.reportsTo ?? '',
      status: input.status ?? existing?.status ?? 'active',
    };
  }

  async disable(): Promise<void> {
    await delay();
  }
}
