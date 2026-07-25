import { describe, it, expect } from 'vitest';
import { MockAttendanceRepository } from './mock-attendance-repository';
import { attendanceProgress, canCheckOut, totalHoursBetween } from './transitions';
import { attendanceService, attendanceFormSchema } from '@/services/attendance-service';
import { invalidationTargets } from '@/data/invalidation';
import { queryKeys } from '@/lib/query-keys';

describe('attendance transitions', () => {
  it('derives progress from check-in/out presence', () => {
    expect(attendanceProgress({ checkIn: '', checkOut: '' })).toBe('not_checked_in');
    expect(attendanceProgress({ checkIn: '09:00', checkOut: '' })).toBe('checked_in');
    expect(attendanceProgress({ checkIn: '09:00', checkOut: '17:00' })).toBe('checked_out');
  });

  it('only allows check-out from checked_in', () => {
    expect(canCheckOut({ checkIn: '09:00', checkOut: '' })).toBe(true);
    expect(canCheckOut({ checkIn: '', checkOut: '' })).toBe(false);
    expect(canCheckOut({ checkIn: '09:00', checkOut: '17:00' })).toBe(false);
  });

  it('computes total hours, guarding incomplete/negative spans', () => {
    expect(totalHoursBetween('09:00', '17:30')).toBe(8.5);
    expect(totalHoursBetween('09:00', '')).toBe(0);
    expect(totalHoursBetween('17:00', '09:00')).toBe(0);
  });
});

describe('MockAttendanceRepository', () => {
  it('lists only the requested company (tenant-scoped)', async () => {
    const repo = new MockAttendanceRepository();
    const alpha = await repo.list('alpha');
    const beta = await repo.list('beta');
    expect(alpha.every((a) => a.tenantId === 'alpha')).toBe(true);
    expect(beta.every((a) => a.tenantId === 'beta')).toBe(true);
  });

  it('create resolves the employee name and starts without a check-out', async () => {
    const repo = new MockAttendanceRepository();
    const created = await repo.create('alpha', {
      employeeId: 'e1',
      date: '2026-08-01',
      status: 'present',
      checkIn: '09:00',
    });
    expect(created).toMatchObject({ employee: 'Maria Santos', checkIn: '09:00', checkOut: '', totalHours: 0 });
  });

  it('rejects a duplicate same-day record for an employee', async () => {
    const repo = new MockAttendanceRepository();
    await repo.create('alpha', { employeeId: 'e2', date: '2026-08-02', status: 'present', checkIn: '09:00' });
    await expect(
      repo.create('alpha', { employeeId: 'e2', date: '2026-08-02', status: 'late', checkIn: '10:00' }),
    ).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('check-out sets the time and derives total hours', async () => {
    const repo = new MockAttendanceRepository();
    const created = await repo.create('alpha', {
      employeeId: 'e3',
      date: '2026-08-03',
      status: 'present',
      checkIn: '09:00',
    });
    const out = await repo.checkOut('alpha', created.id, { checkOut: '17:00' });
    expect(out).toMatchObject({ checkOut: '17:00', totalHours: 8 });
  });

  it('rejects checking out a record that is not checked in', async () => {
    const repo = new MockAttendanceRepository();
    const absent = await repo.create('alpha', { employeeId: 'e1', date: '2026-08-04', status: 'absent' });
    await expect(repo.checkOut('alpha', absent.id, { checkOut: '17:00' })).rejects.toMatchObject({
      kind: 'conflict',
    });
  });
});

describe('attendanceService', () => {
  it('requires a check-in time unless the employee is absent', () => {
    expect(
      attendanceFormSchema.safeParse({ employeeId: 'e1', date: '2026-08-10', status: 'present' }).success,
    ).toBe(false);
    expect(
      attendanceFormSchema.safeParse({ employeeId: 'e1', date: '2026-08-10', status: 'absent' }).success,
    ).toBe(true);
  });

  it('rejects a malformed check-in time', () => {
    expect(
      attendanceFormSchema.safeParse({ employeeId: 'e1', date: '2026-08-10', status: 'present', checkIn: '9am' })
        .success,
    ).toBe(false);
  });

  it('blocks check-out of a record that cannot be checked out', async () => {
    const record = {
      id: 'x',
      tenantId: 'alpha',
      employeeId: 'e1',
      employee: 'Maria',
      date: '2026-08-11',
      checkIn: '09:00',
      checkOut: '17:00',
      totalHours: 8,
      status: 'present' as const,
    };
    await expect(attendanceService.checkOut('alpha', 'x', record)).rejects.toMatchObject({
      kind: 'validation',
    });
  });
});

describe('attendance cache invalidation is tenant-scoped', () => {
  it('embeds company id and never targets another tenant', () => {
    const targets = invalidationTargets.createAttendance('alpha');
    expect(targets).toContainEqual(queryKeys.attendance.all('alpha'));
    expect(targets).not.toContainEqual(queryKeys.attendance.all('beta'));
  });

  it('scopes record keys per tenant', () => {
    expect(queryKeys.attendance.records('alpha')).toEqual(['attendance', 'alpha', 'records']);
    expect(queryKeys.attendance.records('alpha')).not.toEqual(queryKeys.attendance.records('beta'));
  });
});
