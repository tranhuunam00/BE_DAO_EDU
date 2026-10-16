import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSessionResourceConflictsConstraints1787100000000
  implements MigrationInterface
{
  name = 'RemoveSessionResourceConflictsConstraints1787100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      DROP CONSTRAINT IF EXISTS "EX_class_sessions_teacher_time"
    `);
    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      DROP CONSTRAINT IF EXISTS "EX_class_sessions_room_time"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "btree_gist"`);
    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      ADD CONSTRAINT "EX_class_sessions_room_time"
      EXCLUDE USING gist (
        "room_id" WITH =,
        tsrange("date" + "start_time", "date" + "end_time", '[)') WITH &&
      )
      WHERE (
        "room_id" IS NOT NULL
        AND "status" NOT IN ('Cancelled', 'Canceled')
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "class_sessions"
      ADD CONSTRAINT "EX_class_sessions_teacher_time"
      EXCLUDE USING gist (
        "teacher_id" WITH =,
        tsrange("date" + "start_time", "date" + "end_time", '[)') WITH &&
      )
      WHERE (
        "teacher_id" IS NOT NULL
        AND "status" NOT IN ('Cancelled', 'Canceled')
      )
    `);
  }
}
