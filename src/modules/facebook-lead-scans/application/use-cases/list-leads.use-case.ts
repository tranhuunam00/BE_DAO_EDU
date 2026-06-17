import { LeadCrmPersistencePort } from '../ports/lead-crm-persistence.port';

export class ListLeadsUseCase {
  constructor(private readonly persistence: LeadCrmPersistencePort) {}

  async execute(input: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    platform?: string;
    excludeAnonymous?: string;
    leadLevel?: string;
  }) {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.limit ?? 20));
    return this.persistence.listLeads({
      page,
      limit,
      status: input.status,
      search: input.search,
      platform: input.platform,
      excludeAnonymous: input.excludeAnonymous === 'true',
      leadLevel: input.leadLevel,
    });
  }
}
