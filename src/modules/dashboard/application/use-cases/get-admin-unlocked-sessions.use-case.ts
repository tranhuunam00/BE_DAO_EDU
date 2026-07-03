import { UnlockedSession, OperationsQueryPort } from '../ports/operations-query.port';

export class GetAdminUnlockedSessionsUseCase {
  constructor(private readonly query: OperationsQueryPort) {}

  execute(): Promise<UnlockedSession[]> {
    return this.query.getUnlockedSessions();
  }
}
