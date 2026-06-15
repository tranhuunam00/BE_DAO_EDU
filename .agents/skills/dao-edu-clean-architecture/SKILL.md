---
name: dao-edu-clean-architecture
description: Preserve Clean Architecture boundaries in the DAO EDU modular-monolith backend. Use when creating modules, controllers, use cases, ports, adapters, integrations, or reviewing dependency direction and layer ownership.
---

# DAO EDU Clean Architecture

## Follow Dependency Direction

Use the repository rule:

```text
presentation -> application -> domain
infrastructure -> application/domain
```

- Keep `AppModule` as the composition root.
- Let feature modules wire controllers, use cases, ports, and adapters.
- Keep domain independent from NestJS, TypeORM, HTTP, and infrastructure.
- Keep application use cases dependent on contracts, not concrete adapters.

## Place Code

- `domain`: entities, value objects, domain services, errors, repository contracts.
- `application`: use cases, command/query DTOs, transaction boundaries, outbound ports.
- `infrastructure`: TypeORM adapters, storage, security, messaging, external clients.
- `presentation`: controllers, request validation, authentication metadata, HTTP error mapping.

## Feature Workflow

1. Locate the bounded context under `src/modules`.
2. Define or update domain behavior.
3. Orchestrate the behavior in an application use case.
4. Add ports for database or external-system access.
5. Implement adapters in infrastructure.
6. Wire providers in the context module.
7. Keep controllers thin and transport-focused.
8. Add architecture tests for a new context or boundary.

## Review Checklist

- Controllers do not contain mutation business logic.
- Use cases do not inject TypeORM repositories or concrete services.
- ORM entities remain persistence-only.
- Cross-context writes use application ports.
- Imports point inward and no circular context dependency is introduced.
- Existing response and error contracts remain stable unless intentionally changed.
