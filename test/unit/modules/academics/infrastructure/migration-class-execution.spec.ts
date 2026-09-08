import { QueryRunner } from 'typeorm';
import { AddFinancialSnapshotColumnsAndInvariants1787060000000 } from '../../../../../src/infrastructure/persistence/typeorm/migrations/1787060000000-AddFinancialSnapshotColumnsAndInvariants';

describe('AddFinancialSnapshotColumnsAndInvariants1787060000000 Migration Class Execution Spec', () => {
  let migration: AddFinancialSnapshotColumnsAndInvariants1787060000000;
  let mockQueryRunner: jest.Mocked<QueryRunner>;
  let executedQueries: string[];

  beforeEach(() => {
    migration = new AddFinancialSnapshotColumnsAndInvariants1787060000000();
    executedQueries = [];
    mockQueryRunner = {
      query: jest.fn().mockImplementation((query: string) => {
        executedQueries.push(query.trim());
        return Promise.resolve();
      }),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  describe('Migration Metadata', () => {
    it('MIG-01: should have correct migration class name matching timestamp', () => {
      expect(migration.name).toBe('AddFinancialSnapshotColumnsAndInvariants1787060000000');
    });
  });

  describe('Migration up() Execution', () => {
    it('MIG-02: should execute all 17 migration steps in exact logical sequence', async () => {
      await migration.up(mockQueryRunner);
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(17);
    });

    it('MIG-03: should add billed_amount to student_attendance with IF NOT EXISTS and numeric(12,2)', async () => {
      await migration.up(mockQueryRunner);
      const q = executedQueries[0];
      expect(q).toContain('ALTER TABLE "student_attendance"');
      expect(q).toContain('ADD COLUMN IF NOT EXISTS "billed_amount" numeric(12,2)');
    });

    it('MIG-04: should add billed_teacher_wage and billed_assistant_wage to class_sessions', async () => {
      await migration.up(mockQueryRunner);
      const qTeacher = executedQueries[1];
      const qAssistant = executedQueries[2];

      expect(qTeacher).toContain('ALTER TABLE "class_sessions"');
      expect(qTeacher).toContain('ADD COLUMN IF NOT EXISTS "billed_teacher_wage" numeric(12,2)');

      expect(qAssistant).toContain('ALTER TABLE "class_sessions"');
      expect(qAssistant).toContain('ADD COLUMN IF NOT EXISTS "billed_assistant_wage" numeric(12,2)');
    });

    it('MIG-05: should add role column to teacher_monthly_wage_items with default teacher', async () => {
      await migration.up(mockQueryRunner);
      const q = executedQueries[3];
      expect(q).toContain('ALTER TABLE "teacher_monthly_wage_items"');
      expect(q).toContain('ADD COLUMN IF NOT EXISTS "role" varchar(20) DEFAULT \'teacher\'');
    });

    it('MIG-06: should backfill CH-05 assistant role from assistant_wage_id before computing wages', async () => {
      await migration.up(mockQueryRunner);
      const q = executedQueries[4];
      expect(q).toContain('UPDATE teacher_monthly_wage_items wi');
      expect(q).toContain('SET "role" = \'assistant\'');
      expect(q).toContain('WHERE EXISTS (');
      expect(q).toContain('cs.assistant_wage_id = wi.wage_id');
    });

    it('MIG-07: should backfill student_attendance with pricing date-matching, fallback to bi.rate, and clean orphans', async () => {
      await migration.up(mockQueryRunner);
      const qBackfill = executedQueries[5];
      const qFallback = executedQueries[6];
      const qOrphan = executedQueries[7];

      expect(qBackfill).toContain('UPDATE student_attendance sa');
      expect(qBackfill).toContain('SET billed_amount = COALESCE(');
      expect(qBackfill).toContain('p.effective_from <= cs.date');
      expect(qBackfill).toContain('student_monthly_bill_items bi');
      expect(qBackfill).toContain('class_sessions cs');
      expect(qBackfill).toContain('WHERE cs.id = sa.class_session_id');

      expect(qFallback).toContain('UPDATE student_attendance');
      expect(qFallback).toContain('SET billed_amount = 0');
      expect(qFallback).toContain('WHERE bill_id IS NOT NULL AND billed_amount IS NULL');

      expect(qOrphan).toContain('UPDATE student_attendance');
      expect(qOrphan).toContain('SET billed_amount = NULL');
      expect(qOrphan).toContain('WHERE bill_id IS NULL AND billed_amount IS NOT NULL');
    });

    it('MIG-08: should backfill teacher wage with role filter (teacher only), fallback, and orphan cleanup', async () => {
      await migration.up(mockQueryRunner);
      const qBackfill = executedQueries[8];
      const qFallback = executedQueries[9];
      const qOrphan = executedQueries[10];

      expect(qBackfill).toContain('UPDATE class_sessions cs');
      expect(qBackfill).toContain('SET billed_teacher_wage = COALESCE(');
      expect(qBackfill).toContain('(wi.role = \'teacher\' OR wi.role IS NULL)');

      expect(qFallback).toContain('UPDATE class_sessions');
      expect(qFallback).toContain('SET billed_teacher_wage = 0');
      expect(qFallback).toContain('WHERE wage_id IS NOT NULL AND billed_teacher_wage IS NULL');

      expect(qOrphan).toContain('UPDATE class_sessions');
      expect(qOrphan).toContain('SET billed_teacher_wage = NULL');
      expect(qOrphan).toContain('WHERE wage_id IS NULL AND billed_teacher_wage IS NOT NULL');
    });

    it('MIG-09: should backfill assistant wage with role filter (assistant only), fallback, and orphan cleanup', async () => {
      await migration.up(mockQueryRunner);
      const qBackfill = executedQueries[11];
      const qFallback = executedQueries[12];
      const qOrphan = executedQueries[13];

      expect(qBackfill).toContain('UPDATE class_sessions cs');
      expect(qBackfill).toContain('SET billed_assistant_wage = COALESCE(');
      expect(qBackfill).toContain('wi.role = \'assistant\'');

      expect(qFallback).toContain('UPDATE class_sessions');
      expect(qFallback).toContain('SET billed_assistant_wage = 0');
      expect(qFallback).toContain('WHERE assistant_wage_id IS NOT NULL AND billed_assistant_wage IS NULL');

      expect(qOrphan).toContain('UPDATE class_sessions');
      expect(qOrphan).toContain('SET billed_assistant_wage = NULL');
      expect(qOrphan).toContain('WHERE assistant_wage_id IS NULL AND billed_assistant_wage IS NOT NULL');
    });

    it('MIG-10: should create all 3 DB check constraints with pg_constraint existence check', async () => {
      await migration.up(mockQueryRunner);
      const qAttConstraint = executedQueries[14];
      const qTchConstraint = executedQueries[15];
      const qAstConstraint = executedQueries[16];

      // Student Attendance Constraint
      expect(qAttConstraint).toContain('chk_student_attendance_billed_amount');
      expect(qAttConstraint).toContain('(bill_id IS NULL AND billed_amount IS NULL)');
      expect(qAttConstraint).toContain('(bill_id IS NOT NULL AND billed_amount IS NOT NULL AND billed_amount >= 0)');

      // Teacher Wage Constraint
      expect(qTchConstraint).toContain('chk_class_session_teacher_wage');
      expect(qTchConstraint).toContain('(wage_id IS NULL AND billed_teacher_wage IS NULL)');
      expect(qTchConstraint).toContain('(wage_id IS NOT NULL AND billed_teacher_wage IS NOT NULL AND billed_teacher_wage >= 0)');

      // Assistant Wage Constraint
      expect(qAstConstraint).toContain('chk_class_session_assistant_wage');
      expect(qAstConstraint).toContain('(assistant_wage_id IS NULL AND billed_assistant_wage IS NULL)');
      expect(qAstConstraint).toContain('(assistant_wage_id IS NOT NULL AND billed_assistant_wage IS NOT NULL AND billed_assistant_wage >= 0)');
    });
  });

  describe('Migration down() Rollback Execution', () => {
    it('MIG-11: should execute rollback in exact reverse order (drop constraints first, then columns)', async () => {
      await migration.down(mockQueryRunner);
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(7);

      // Constraints dropped first
      expect(executedQueries[0]).toContain('DROP CONSTRAINT IF EXISTS "chk_student_attendance_billed_amount"');
      expect(executedQueries[1]).toContain('DROP CONSTRAINT IF EXISTS "chk_class_session_teacher_wage"');
      expect(executedQueries[2]).toContain('DROP CONSTRAINT IF EXISTS "chk_class_session_assistant_wage"');

      // Columns dropped after
      expect(executedQueries[3]).toContain('DROP COLUMN IF EXISTS "role"');
      expect(executedQueries[4]).toContain('DROP COLUMN IF EXISTS "billed_assistant_wage"');
      expect(executedQueries[5]).toContain('DROP COLUMN IF EXISTS "billed_teacher_wage"');
      expect(executedQueries[6]).toContain('DROP COLUMN IF EXISTS "billed_amount"');
    });

    it('MIG-12: should propagate error when queryRunner fails during migration up to trigger transaction rollback', async () => {
      mockQueryRunner.query.mockRejectedValueOnce(new Error('Postgres Deadlock / Connection Error'));
      await expect(migration.up(mockQueryRunner)).rejects.toThrow('Postgres Deadlock / Connection Error');
    });
  });
});
