import { MigrationInterface, QueryRunner, Table, TableIndex, TableUnique } from 'typeorm';

export class CreateStudentReportApprovalsTable1787090000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'student_report_approvals',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'student_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'report_type',
            type: 'varchar',
            length: '10',
            isNullable: false,
          },
          {
            name: 'period_number',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'year',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'is_approved',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'approved_by_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approved_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'sent_to_zalo_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'commendation',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'suggestion',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['student_id'],
            referencedTableName: 'students',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['approved_by_user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    await queryRunner.createUniqueConstraint(
      'student_report_approvals',
      new TableUnique({
        name: 'uq_student_report_period',
        columnNames: ['student_id', 'report_type', 'period_number', 'year'],
      }),
    );

    await queryRunner.createIndex(
      'student_report_approvals',
      new TableIndex({
        name: 'idx_report_approval_student_id',
        columnNames: ['student_id'],
      }),
    );

    await queryRunner.createIndex(
      'student_report_approvals',
      new TableIndex({
        name: 'idx_report_approval_is_approved',
        columnNames: ['is_approved'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('student_report_approvals', true);
  }
}
