---
name: tdd
description: Test-driven development with mandatory Performance Benchmark tests and User Test Review. Use when building features or fixing bugs test-first, mentions "red-green-refactor", performance tests, or integration tests.
---

# Test-Driven Development (TDD) with Performance Benchmarking & User Review

TDD is the RED → USER REVIEW → GREEN → REFACTOR loop.

---

## Mandatory Rules of the TDD Loop

1. **Red before Green**: Write failing tests (`.spec.ts`) FIRST before any implementation code.
2. **Performance Benchmark Included**: Every feature or service handling arrays, calculation, or bulk data MUST include a performance benchmark assertion (e.g. `performance.now() - startTime < SLA_MS`).
3. **Mandatory User Test Review**: Stop after writing tests. Present test cases and SLA benchmarks to the **USER for review and approval** BEFORE writing implementation code.
4. **Green**: Write minimal implementation code to pass both functional assertions and performance SLA benchmarks.
5. **Refactor**: Clean code without breaking test suite or exceeding performance limits.

---

## What a Good Test Is

Tests verify behavior through public interfaces, not implementation details. A good test reads like a specification — e.g. "calculates tuition for 10,000 attendance records under 50ms (Performance Benchmark)" — and survives refactors because it tests public seams.

---

## Performance Benchmarking in TDD (Example)

```typescript
it('handles bulk calculation for 10,000 items under 50ms SLA (Performance Benchmark)', () => {
  const dataset = generateLargeDataset(10000);
  const startTime = performance.now();
  
  const result = Service.calculate(dataset);
  const duration = performance.now() - startTime;

  expect(result).toBeDefined();
  expect(duration).toBeLessThan(50); // Performance SLA constraint
});
```
