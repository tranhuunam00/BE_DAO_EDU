---
name: dao-edu-nestjs-typeorm
description: Implement NestJS 11 and TypeORM persistence features in the DAO EDU backend. Use when adding controllers, validation DTOs, providers, TypeORM entities, adapters, transactions, PostgreSQL constraints, or database migrations.
---

# DAO EDU NestJS And TypeORM

## Match Existing Patterns

- Read the closest feature implementation before creating files.
- Keep NestJS decorators at presentation and module wiring boundaries.
- Use `class-validator` and `class-transformer` for request validation.
- Map transport DTOs to application inputs instead of passing HTTP objects inward.
- Register adapters through provider tokens owned by the application layer.

## Persistence

- Keep TypeORM entities and mappings in persistence infrastructure.
- Implement application ports with adapters; do not expose TypeORM repositories to use cases.
- Put multi-write consistency inside explicit transactions.
- Lock rows and choose isolation levels when business invariants can race.
- Convert database-specific failures into application or domain errors at the adapter boundary.

## Migrations

- Create a new timestamped migration for every schema change.
- **Tách biệt cấu trúc (Schema) và Dữ liệu mẫu (Seed Data)**:
  - Các file migrations chỉ chứa cấu trúc cơ sở dữ liệu (DDL: `CREATE TABLE`, `ALTER TABLE`, `ADD INDEX`, `ADD CONSTRAINT`).
  - **Không** viết các lệnh chèn dữ liệu mẫu, dữ liệu thử nghiệm hoặc tài khoản ảo (`INSERT INTO`) trong migrations để tránh ô nhiễm dữ liệu trên Production và lỗi xung đột ràng buộc dữ liệu.
- **Tập trung Seed vào thư mục `seeds/`**:
  - Dữ liệu mẫu Dev lưu tại `seeds/dev.js`.
  - Dữ liệu khởi tạo Production lưu tại `seeds/prod.js`.
- Never edit an already-applied migration to represent a new change.
- Write reversible `up` and `down` operations where safely possible.
- Add indexes, unique constraints, foreign keys, and PostgreSQL constraints needed to enforce invariants.
- Check migration status before running migrations against a configured database.

## Verification

- Add unit tests around domain and use-case behavior.
- Add adapter tests for transactions, mapping, constraints, or non-trivial queries.
- Run the narrow tests first, then `npm run build`.
- Run migration commands only when the task requires database application and configuration is available.
