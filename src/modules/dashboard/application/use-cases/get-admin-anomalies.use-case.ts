import { AnomaliesResult, OperationsQueryPort } from '../ports/operations-query.port';

export class GetAdminAnomaliesUseCase {
  constructor(private readonly query: OperationsQueryPort) {}

  execute(): Promise<AnomaliesResult> {
    return this.query.getAnomalies();
  }
}
