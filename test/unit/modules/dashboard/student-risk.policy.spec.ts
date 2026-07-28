import { StudentRiskPolicy } from '../../../../src/modules/dashboard/domain/services/student-risk.policy';

describe('StudentRiskPolicy', () => {
  let policy: StudentRiskPolicy;

  beforeEach(() => {
    policy = new StudentRiskPolicy();
  });

  it('returns 0 score and empty reasons when student has no locked attendance and no assignments', () => {
    const result = policy.evaluate({
      studentId: 's1',
      studentCode: 'HV001',
      studentName: 'Nguyen Van A',
      mobile: '0901234567',
      attendance: [],
      assignmentCount: 0,
      submittedCount: 0,
    });

    expect(result.score).toBe(0);
    expect(result.level).toBe('low');
    expect(result.reasons).toEqual([]);
  });

  it('calculates risk score correctly for a student with consecutive absences in locked sessions', () => {
    const result = policy.evaluate({
      studentId: 's2',
      studentCode: 'HV002',
      studentName: 'Bui Ngoc Linh',
      mobile: '0901234568',
      attendance: [false, false, false, true, true], // 3 consecutive absences recently
      assignmentCount: 5,
      submittedCount: 5,
    });

    // 3 absent / 5 total = 0.6 absence rate
    // score = 0.6 * 55 + 25 (consecutive >= 3) = 33 + 25 = 58
    expect(result.score).toBe(58);
    expect(result.level).toBe('medium');
    expect(result.reasons).toContain('Vắng 3/5 buổi');
    expect(result.reasons).toContain('Vắng liên tiếp 3 buổi gần nhất');
  });
});
