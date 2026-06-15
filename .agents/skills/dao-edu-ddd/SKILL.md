---
name: dao-edu-ddd
description: Apply domain-driven design in the DAO EDU NestJS backend. Use when adding or changing business rules, entities, value objects, domain services, repository contracts, bounded contexts, or cross-context behavior under src/modules.
---

# DAO EDU Domain-Driven Design

## Model The Domain

- Identify the owning bounded context before editing code.
- Put business invariants in domain entities, value objects, or domain services.
- Keep domain code as plain TypeScript without NestJS, TypeORM, HTTP, or storage imports.
- Use domain-specific names from the education business instead of transport or database terminology.
- Represent invalid business operations with explicit domain errors.

## Preserve Context Ownership

- Keep each capability under `src/modules/<context>`.
- Let one context own each write model and its invariants.
- Use an application port for cross-context writes; never reach into another context's repository.
- Prefer identifiers or small read models across boundaries instead of sharing mutable entities.

## Implement Changes

1. Read the context's existing entity, service, use case, port, adapter, module, and tests.
2. State the invariant being added or changed.
3. Implement the invariant in the innermost appropriate layer.
4. Expose persistence or external needs through an application/domain contract.
5. Add focused domain tests for success, boundary, and rejection cases.

## Guardrails

- Do not turn TypeORM entities into domain entities.
- Do not place business decisions in controllers, modules, or persistence adapters.
- Do not introduce a new abstraction unless it protects a real invariant or boundary.
- Preserve existing API contracts unless the task explicitly changes them.
