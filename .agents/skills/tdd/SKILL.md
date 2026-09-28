---
name: tdd
description: Test-driven development with mandatory Performance Benchmark tests and User Test Review. Use when building features or fixing bugs test-first, mentions red-green-refactor, performance tests, or integration tests.
---

# Test-Driven Development (TDD) with Performance Benchmarking & User Review

TDD is the RED -> USER REVIEW -> GREEN -> REFACTOR loop.

---

## Mandatory Rules of the TDD Loop

1. **Red before Green**: Write failing tests (.spec.ts) FIRST before any implementation code.
2. **Performance Benchmark Included**: Every feature or service handling arrays, calculation, or bulk data MUST include a performance benchmark assertion (e.g. performance.now() - startTime < SLA_MS).
3. **Mandatory User Test Review**: Stop after writing tests. Present test cases and SLA benchmarks to the **USER for review and approval** BEFORE writing implementation code.
4. **Green**: Write minimal implementation code to pass both functional assertions and performance SLA benchmarks.
5. **Refactor**: Clean code without breaking test suite or exceeding performance limits.

---

## What a Good Test Is

Tests verify behavior through public interfaces, not implementation details. A good test reads like a specification — e.g. calculates tuition for 10,000 attendance records under 50ms (Performance Benchmark) — and survives refactors because it tests public seams.

---

## Performance Benchmarking in TDD (Example)

`	ypescript
it('handles bulk calculation for 10,000 items under 50ms SLA (Performance Benchmark)', () => {
  const dataset = generateLargeDataset(10000);
  const startTime = performance.now();

  const result = Service.calculate(dataset);
  const duration = performance.now() - startTime;

  expect(result).toBeDefined();
  expect(duration).toBeLessThan(50); // Performance SLA constraint
});
`

---

## Shared Mock DB Constant Pattern (BAT BUOC)

**Quy tac:** Toan bo file .spec.ts trong cung 1 module/feature **BAT BUOC** dung chung 1 bo constant mock dataset,
KHONG duoc tu dinh nghia input rieng trong tung file test.

### Cau truc bat buoc

`
src/modules/<context>/
└── __mocks__/
    └── <context>.mock-db.ts   <- 1 file duy nhat, shared toan bo
`

### Tai sao?

| Van de khi moi file tu dinh nghia input | Loi ich khi dung shared mock DB |
|---|---|
| Inconsistent data giua cac test | Nhat quan, 1 nguon su that |
| Thay doi schema -> sua N file | Chi sua 1 file mock-db.ts |
| Test pass rieng le nhung fail khi tong hop | Phat hien loi cheo giua use cases |
| Kho build performance dataset lon | Generate 1 lan, dung moi noi |

### Template __mocks__/<context>.mock-db.ts

`	ypescript
// ============================================================
// SHARED MOCK DB -- dung chung toan bo test files cua module
// ============================================================

export const MOCK_STUDENTS = [
  { id: 'stu-1', studentCode: 'HS001', fullName: 'Nguyen Van A', status: 'Active' },
  { id: 'stu-2', studentCode: 'HS002', fullName: 'Tran Thi B',   status: 'Active' },
  // them du case: edge cases, ties, inactive...
] as const;

export const MOCK_SESSIONS = [
  { id: 'ses-1', classId: 'cls-1', date: '2026-09-01' },
] as const;

export const MOCK_ATTENDANCE = [
  { studentId: 'stu-1', sessionId: 'ses-1', isPresent: true },
] as const;

// Dataset lon cho Performance Benchmark
export function generateLargeMockAttendance(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    studentId: stu-perf-,
    sessionId: ses-perf-,
    isPresent: i % 3 !== 0,
  }));
}
`

### Cach import trong tung file spec

`	ypescript
// Dung -- import tu shared mock DB
import {
  MOCK_STUDENTS,
  MOCK_ATTENDANCE,
  generateLargeMockAttendance,
} from '../__mocks__/reports.mock-db';

// SAI -- tu dinh nghia input trong file test, KHONG DUOC
const students = [{ id: '1', name: 'Test' }];
`
