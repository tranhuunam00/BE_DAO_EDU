import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOldMinioUrls1787039000000 implements MigrationInterface {
  name = 'UpdateOldMinioUrls1787039000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const externalEndpoint = process.env.MINIO_EXTERNAL_ENDPOINT || 'https://imgeducare.home-care.vn';
    // Clean target url (remove trailing slash if any, ensure it starts with protocol)
    let targetUrl = externalEndpoint;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`; // Default to https if no protocol specified
    }
    if (targetUrl.endsWith('/')) {
      targetUrl = targetUrl.slice(0, -1);
    }

    // Update students
    await queryRunner.query(`
      UPDATE "students"
      SET "avatar" = REPLACE("avatar", 'http://103.90.227.173:9008', '${targetUrl}')
      WHERE "avatar" LIKE 'http://103.90.227.173:9008%';

      UPDATE "students"
      SET "avatar" = REPLACE("avatar", 'http://localhost:9008', '${targetUrl}')
      WHERE "avatar" LIKE 'http://localhost:9008%';

      UPDATE "students"
      SET "avatar" = REPLACE("avatar", 'http://127.0.0.1:9008', '${targetUrl}')
      WHERE "avatar" LIKE 'http://127.0.0.1:9008%';

      UPDATE "students"
      SET "avatar" = REPLACE("avatar", 'http://localhost:9005', '${targetUrl}')
      WHERE "avatar" LIKE 'http://localhost:9005%';
    `);

    // Update teachers
    await queryRunner.query(`
      UPDATE "teachers"
      SET "avatar" = REPLACE("avatar", 'http://103.90.227.173:9008', '${targetUrl}')
      WHERE "avatar" LIKE 'http://103.90.227.173:9008%';

      UPDATE "teachers"
      SET "avatar" = REPLACE("avatar", 'http://localhost:9008', '${targetUrl}')
      WHERE "avatar" LIKE 'http://localhost:9008%';

      UPDATE "teachers"
      SET "avatar" = REPLACE("avatar", 'http://127.0.0.1:9008', '${targetUrl}')
      WHERE "avatar" LIKE 'http://127.0.0.1:9008%';

      UPDATE "teachers"
      SET "avatar" = REPLACE("avatar", 'http://localhost:9005', '${targetUrl}')
      WHERE "avatar" LIKE 'http://localhost:9005%';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const externalEndpoint = process.env.MINIO_EXTERNAL_ENDPOINT || 'https://imgeducare.home-care.vn';
    let targetUrl = externalEndpoint;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }
    if (targetUrl.endsWith('/')) {
      targetUrl = targetUrl.slice(0, -1);
    }

    await queryRunner.query(`
      UPDATE "students"
      SET "avatar" = REPLACE("avatar", '${targetUrl}', 'http://103.90.227.173:9008')
      WHERE "avatar" LIKE '${targetUrl}%';

      UPDATE "teachers"
      SET "avatar" = REPLACE("avatar", '${targetUrl}', 'http://103.90.227.173:9008')
      WHERE "avatar" LIKE '${targetUrl}%';
    `);
  }
}
