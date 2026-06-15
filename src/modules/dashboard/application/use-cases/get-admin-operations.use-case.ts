import { ClassRecommendationPolicy } from '../../domain/services/class-recommendation.policy';
import { StudentRiskPolicy } from '../../domain/services/student-risk.policy';
import { OperationsQueryPort } from '../ports/operations-query.port';

export class GetAdminOperationsUseCase {
  constructor(
    private readonly query: OperationsQueryPort,
    private readonly riskPolicy: StudentRiskPolicy,
    private readonly recommendationPolicy: ClassRecommendationPolicy,
  ) {}

  async execute() {
    const [riskInputs, waitingStudents, candidates, tasks] = await Promise.all([
      this.query.getRiskInputs(),
      this.query.getWaitingStudents(),
      this.query.getCandidateClasses(),
      this.query.getTasks(),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      atRiskStudents: riskInputs
        .map((input) => this.riskPolicy.evaluate(input))
        .filter((student) => student.score >= 35)
        .sort((a, b) => b.score - a.score),
      classSuggestions: waitingStudents.map((student) => ({
        studentId: student.id,
        studentCode: student.studentCode,
        studentName: student.studentName,
        suggestions: this.recommendationPolicy.recommend(student.age, candidates),
      })),
      tasks,
    };
  }
}
