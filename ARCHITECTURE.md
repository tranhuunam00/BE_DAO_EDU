# Backend Architecture

The backend is organized as a modular monolith. Each business capability owns
its NestJS module and wiring, while `AppModule` is only the composition root.

## Dependency Rule

Dependencies point inward:

```text
presentation -> application -> domain
infrastructure -> application/domain
```

The domain must not import NestJS, TypeORM, controllers, or infrastructure.
Application code accesses external systems through ports. Infrastructure
implements those ports and is selected by feature-module providers.

## Bounded Contexts

- `identity`: authentication and user accounts
- `students`: student profile lifecycle
- `teachers`: teacher profile lifecycle
- `centers`: centers and rooms
- `academics`: courses, classes, sessions, enrollment, and attendance
- `assignments`: assignments, submissions, attachments, and grading
- `notifications`: user notifications
- `dashboard`: cross-context read models
- `billing`: payment periods, tuition, and salary calculation
- `payments`: tuition payment requests and VietQR integration

## Layers

- `domain`: entities, value objects, domain services, and repository contracts
- `application`: use cases, DTOs, and outbound ports
- `infrastructure`: TypeORM adapters, security, configuration, and storage
- `presentation`: HTTP controllers and transport-specific error mapping

`billing` and `payments` already keep their layers inside their context
directories. The other contexts are registered as independent modules while
their legacy layer files are migrated incrementally without changing API
contracts.

### Academics Consistency

The `academics` context uses domain schedule policies and application use
cases for enrollment and resource allocation.

- Enrollment changes run in `SERIALIZABLE` transactions.
- Class and student rows are locked before capacity or status changes.
- Attendance creation/removal is committed with the enrollment change.
- Recurring schedules are checked for room and teacher conflicts.
- Concrete sessions are protected by PostgreSQL exclusion constraints, which
  close the race between concurrent requests.
- Serialization failures are retried up to three times.

## Migration Rules

1. New business logic belongs in a context under `src/modules/<context>`.
2. Controllers must delegate mutations to application use cases.
3. Application use cases must not inject TypeORM repositories or concrete
   infrastructure services.
4. ORM entities stay persistence-only and must not become domain entities.
5. Cross-context writes go through an application port, not another context's
   repository.
6. Architecture tests are mandatory for every new context.
